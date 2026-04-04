import { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { WallPoint, WallSegment } from '@/lib/types';
import { calculatePolylineLength, generateWallName } from '@/lib/wallCalculations';
import { Map, Pencil, Trash2, Undo2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { v4Fallback } from '@/lib/idUtils';

interface MapCanvasProps {
  mapboxToken: string;
  center: [number, number] | null;
  walls: WallSegment[];
  onWallsChange: (walls: WallSegment[]) => void;
  activeWallId: string | null;
  onActiveWallChange: (id: string | null) => void;
}

type MapStyle = 'streets' | 'satellite';

const MAP_STYLES: Record<MapStyle, string> = {
  streets: 'mapbox://styles/mapbox/light-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

const MapCanvas = ({ mapboxToken, center, walls, onWallsChange, activeWallId, onActiveWallChange }: MapCanvasProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapStyle, setMapStyle] = useState<MapStyle>('satellite');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<WallPoint[]>([]);
  const [wallToDelete, setWallToDelete] = useState<WallSegment | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[mapStyle],
      center: center || [133.7751, -25.2744], // Australia center
      zoom: center ? 20 : 4,
      pitch: 0,
      bearing: 0,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100 }), 'bottom-left');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to center when it changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.flyTo({ center, zoom: 18, duration: 2000 });
    }
  }, [center]);

  // Update style
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[mapStyle]);
      // Re-draw walls after style change
      mapRef.current.once('style.load', () => drawAllWalls());
    }
  }, [mapStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw walls on map
  const drawAllWalls = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clear existing wall layers/sources
    walls.forEach((_, i) => {
      const id = `wall-line-${i}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getLayer(`${id}-label`)) map.removeLayer(`${id}-label`);
      if (map.getSource(id)) map.removeSource(id);
    });

    // Clear markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    walls.forEach((wall, i) => {
      if (wall.points.length < 2) return;

      const id = `wall-line-${i}`;
      const isActive = wall.id === activeWallId;
      const coordinates = wall.points.map(p => [p.lng, p.lat]);

      map.addSource(id, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { name: wall.name },
          geometry: { type: 'LineString', coordinates },
        },
      });

      map.addLayer({
        id,
        type: 'line',
        source: id,
        paint: {
          'line-color': isActive ? '#2d6a4f' : '#52796f',
          'line-width': isActive ? 4 : 3,
          'line-dasharray': [2, 1],
        },
      });

      // Add node markers
      wall.points.forEach((p) => {
        const el = document.createElement('div');
        el.className = 'w-3 h-3 rounded-full border-2 cursor-pointer';
        el.style.backgroundColor = isActive ? '#2d6a4f' : '#52796f';
        el.style.borderColor = '#fff';
        const marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        markersRef.current.push(marker);
      });

      // Add label at midpoint
      if (wall.points.length >= 2) {
        const mid = Math.floor(wall.points.length / 2);
        const mp = wall.points[mid];
        const el = document.createElement('div');
        el.className = 'px-2 py-1 rounded text-xs font-medium shadow-sm pointer-events-none';
        el.style.backgroundColor = '#fff';
        el.style.color = '#2d6a4f';
        el.style.border = '1px solid #e0e0e0';
        el.textContent = `${wall.name}: ${wall.length.toFixed(1)}m`;
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, -10] })
          .setLngLat([mp.lng, mp.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    });

    // Draw current points being drawn
    if (currentPoints.length > 0) {
      const tempId = 'wall-line-temp';
      if (map.getLayer(tempId)) map.removeLayer(tempId);
      if (map.getSource(tempId)) map.removeSource(tempId);

      if (currentPoints.length >= 2) {
        map.addSource(tempId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: currentPoints.map(p => [p.lng, p.lat]),
            },
          },
        });
        map.addLayer({
          id: tempId,
          type: 'line',
          source: tempId,
          paint: { 'line-color': '#2d6a4f', 'line-width': 3, 'line-opacity': 0.6 },
        });
      }

      currentPoints.forEach((p) => {
        const el = document.createElement('div');
        el.className = 'w-3 h-3 rounded-full';
        el.style.backgroundColor = '#2d6a4f';
        el.style.border = '2px solid #fff';
        const marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        markersRef.current.push(marker);
      });
    }
  }, [walls, activeWallId, currentPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onStyleLoad = () => drawAllWalls();
    if (map.isStyleLoaded()) {
      drawAllWalls();
    } else {
      map.once('style.load', onStyleLoad);
    }
  }, [drawAllWalls]);

  // Handle map click for drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (!isDrawing) return;
      const point: WallPoint = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      setCurrentPoints(prev => [...prev, point]);
    };

    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [isDrawing]);

  // Change cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = isDrawing ? 'crosshair' : '';
  }, [isDrawing]);

  const finishWall = () => {
    if (currentPoints.length < 2) {
      setCurrentPoints([]);
      setIsDrawing(false);
      return;
    }

    const length = calculatePolylineLength(currentPoints);
    const newWall: WallSegment = {
      id: v4Fallback(),
      name: generateWallName(walls.length),
      points: currentPoints,
      wallType: 'concrete-sleeper',
      length,
      averageHeight: 1.0,
      maxHeight: 1.2,
      offsetFromDwelling: 0,
      offsetFromBoundary: 0,
      hasSurcharge: false,
      hasFenceAbove: false,
      hasDrainageRequired: true,
      notes: '',
      materialAssumptions: '',
    };

    onWallsChange([...walls, newWall]);
    onActiveWallChange(newWall.id);
    setCurrentPoints([]);
    setIsDrawing(false);

    toast.success(`${newWall.name} added`, {
      description: `${length.toFixed(1)}m retaining wall`,
    });
  };

  const confirmDeleteWall = (wall: WallSegment) => {
    setWallToDelete(wall);
  };

  const deleteWall = () => {
    if (!wallToDelete) return;
    const name = wallToDelete.name;
    onWallsChange(walls.filter(w => w.id !== wallToDelete.id));
    if (activeWallId === wallToDelete.id) onActiveWallChange(null);
    setWallToDelete(null);
    toast("Wall deleted", { description: `${name} has been removed` });
  };

  const undoLastPoint = () => {
    setCurrentPoints(prev => prev.slice(0, -1));
  };

  if (!mapboxToken) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl border border-border bg-card shadow-card lg:h-[600px]">
        <div className="text-center">
          <Map className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium text-foreground">Map View</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your Mapbox token to enable the interactive map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Map container — responsive height */}
      <div ref={mapContainer} className="h-[400px] w-full rounded-2xl shadow-card sm:h-[500px] lg:h-[700px]" />

      {/* Empty state overlay when no address */}
      {!center && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[2px]">
          <div className="text-center">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-base font-medium text-foreground">Search for your property</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the search bar above to find your address
            </p>
          </div>
        </div>
      )}

      {/* Map controls overlay */}
      <div className="absolute left-3 top-3 flex flex-col gap-2 sm:left-4 sm:top-4">
        {/* Style toggle */}
        <div className="flex overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <button
            onClick={() => setMapStyle('streets')}
            className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 sm:py-2 sm:text-xs ${mapStyle === 'streets' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}
          >
            Standard
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 sm:py-2 sm:text-xs ${mapStyle === 'satellite' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Drawing controls */}
      {center && (
        <div className="absolute right-3 top-3 flex flex-col gap-2 sm:right-4 sm:top-4">
          {!isDrawing ? (
            <Button
              onClick={() => setIsDrawing(true)}
              size="sm"
              className="gap-2 rounded-lg shadow-card"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Draw Wall</span>
              <span className="sm:hidden">Draw</span>
            </Button>
          ) : (
            <>
              <Button onClick={finishWall} size="sm" className="gap-2 rounded-lg shadow-card">
                Finish Wall
              </Button>
              <Button onClick={undoLastPoint} size="sm" variant="outline" className="gap-2 rounded-lg bg-card shadow-card" disabled={currentPoints.length === 0}>
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
              <Button onClick={() => { setCurrentPoints([]); setIsDrawing(false); }} size="sm" variant="outline" className="gap-2 rounded-lg bg-card shadow-card">
                Cancel
              </Button>
            </>
          )}
        </div>
      )}

      {/* Drawing instructions */}
      {isDrawing && (
        <div className="absolute bottom-3 left-1/2 max-w-[calc(100%-6rem)] -translate-x-1/2 rounded-xl bg-card px-3 py-2 shadow-elevated sm:bottom-4 sm:max-w-none sm:px-4 sm:py-2.5">
          <p className="text-center text-xs font-medium text-foreground sm:text-sm">
            Click on the map to place wall points.{' '}
            {currentPoints.length >= 2 && (
              <span className="text-primary">
                Length: {calculatePolylineLength(currentPoints).toFixed(1)}m — Click "Finish Wall" when done.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Wall list */}
      {walls.length > 0 && !isDrawing && (
        <div className="absolute bottom-3 left-3 max-h-[140px] max-w-[200px] space-y-1 overflow-y-auto sm:bottom-4 sm:left-4 sm:max-h-none sm:max-w-xs">
          {walls.map(wall => (
            <div
              key={wall.id}
              onClick={() => onActiveWallChange(wall.id)}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs shadow-card transition-colors sm:px-3 sm:py-2 sm:text-sm ${
                activeWallId === wall.id ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'
              }`}
            >
              <span className="font-medium">{wall.name}: {wall.length.toFixed(1)}m</span>
              <button
                onClick={(e) => { e.stopPropagation(); confirmDeleteWall(wall); }}
                className="ml-2 opacity-60 hover:opacity-100"
              >
                <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!wallToDelete} onOpenChange={(open) => !open && setWallToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {wallToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {wallToDelete?.name} ({wallToDelete?.length.toFixed(1)}m) from your plan.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteWall} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Wall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MapCanvas;
