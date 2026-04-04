import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, Marker, InfoWindow } from '@react-google-maps/api';
import { WallPoint, WallSegment } from '@/lib/types';
import { calculatePolylineLength } from '@/lib/wallCalculations';
import { Map, MapPin } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';

type MapTypeId = 'satellite' | 'hybrid';

const containerStyle = { width: '100%', height: '100%' };

const LIME_GREEN = '#33E65D';
const LIME_GREEN_DARK = '#2bc950';
const SNAP_THRESHOLD_PX = 15;

function angleBetweenWalls(shared: WallPoint, endA: WallPoint, endB: WallPoint): number {
  const dAx = endA.lng - shared.lng;
  const dAy = endA.lat - shared.lat;
  const dBx = endB.lng - shared.lng;
  const dBy = endB.lat - shared.lat;
  const angleA = Math.atan2(dAy, dAx);
  const angleB = Math.atan2(dBy, dBx);
  let angle = Math.abs((angleA - angleB) * (180 / Math.PI));
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function getEndpoints(walls: WallSegment[]): { wallId: string; pointIndex: number; point: WallPoint }[] {
  const endpoints: { wallId: string; pointIndex: number; point: WallPoint }[] = [];
  walls.forEach((wall) => {
    if (wall.points.length >= 2) {
      endpoints.push({ wallId: wall.id, pointIndex: 0, point: wall.points[0] });
      endpoints.push({ wallId: wall.id, pointIndex: wall.points.length - 1, point: wall.points[wall.points.length - 1] });
    }
  });
  return endpoints;
}

function findWallAngles(walls: WallSegment[]): { position: WallPoint; angle: number; wallNames: [string, string] }[] {
  const results: { position: WallPoint; angle: number; wallNames: [string, string] }[] = [];
  const threshold = 0.000005;
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wA = walls[i];
      const wB = walls[j];
      if (wA.points.length < 2 || wB.points.length < 2) continue;
      const endpointsA = [
        { pt: wA.points[0], other: wA.points[1] },
        { pt: wA.points[wA.points.length - 1], other: wA.points[wA.points.length - 2] },
      ];
      const endpointsB = [
        { pt: wB.points[0], other: wB.points[1] },
        { pt: wB.points[wB.points.length - 1], other: wB.points[wB.points.length - 2] },
      ];
      for (const eA of endpointsA) {
        for (const eB of endpointsB) {
          if (Math.abs(eA.pt.lat - eB.pt.lat) < threshold && Math.abs(eA.pt.lng - eB.pt.lng) < threshold) {
            const angle = angleBetweenWalls(eA.pt, eA.other, eB.other);
            results.push({ position: eA.pt, angle, wallNames: [wA.name, wB.name] });
          }
        }
      }
    }
  }
  return results;
}

const MapCanvas = ({
  center,
  walls,
  onWallsChange,
  activeWallId,
  onActiveWallChange,
  isDrawing,
  onIsDrawingChange,
  currentPoints,
  onCurrentPointsChange,
}: {
  center: [number, number] | null;
  walls: WallSegment[];
  onWallsChange: (walls: WallSegment[]) => void;
  activeWallId: string | null;
  onActiveWallChange: (id: string | null) => void;
  isDrawing: boolean;
  onIsDrawingChange: (v: boolean) => void;
  currentPoints: WallPoint[];
  onCurrentPointsChange: (points: WallPoint[] | ((prev: WallPoint[]) => WallPoint[])) => void;
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<MapTypeId>('hybrid');
  const [wallToDelete, setWallToDelete] = useState<WallSegment | null>(null);
  const [snapTarget, setSnapTarget] = useState<WallPoint | null>(null);
  const [heightPrompt, setHeightPrompt] = useState<{ point: WallPoint; index: number } | null>(null);
  const [heightInput, setHeightInput] = useState('');

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setMapTypeId('hybrid');
  }, []);

  const lastCenterRef = useRef<string | null>(null);
  useEffect(() => {
    if (mapRef.current && center) {
      const key = `${center[0]},${center[1]}`;
      if (lastCenterRef.current !== key) {
        lastCenterRef.current = key;
        mapRef.current.panTo({ lat: center[1], lng: center[0] });
        mapRef.current.setZoom(20);
      }
    }
  }, [center]);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapType);
  }, [mapType]);

  useEffect(() => {
    if (!mapRef.current) return;
    const mapDiv = mapRef.current.getDiv();
    if (isDrawing) {
      mapDiv.style.cursor = 'crosshair';
      const inner = mapDiv.querySelector('div[style]') as HTMLElement;
      if (inner) inner.style.cursor = 'crosshair';
    } else {
      mapDiv.style.cursor = '';
      const inner = mapDiv.querySelector('div[style]') as HTMLElement;
      if (inner) inner.style.cursor = '';
    }
  }, [isDrawing]);

  const findSnapPoint = useCallback(
    (latLng: google.maps.LatLng): WallPoint | null => {
      if (!mapRef.current) return null;
      const endpoints = getEndpoints(walls);
      const projection = mapRef.current.getProjection();
      if (!projection) return null;
      const clickPixel = projection.fromLatLngToPoint(latLng);
      if (!clickPixel) return null;
      const zoom = mapRef.current.getZoom() ?? 20;
      const scale = Math.pow(2, zoom);
      let nearest: WallPoint | null = null;
      let nearestDist = Infinity;
      for (const ep of endpoints) {
        const epLatLng = new google.maps.LatLng(ep.point.lat, ep.point.lng);
        const epPixel = projection.fromLatLngToPoint(epLatLng);
        if (!epPixel) continue;
        const dx = (clickPixel.x - epPixel.x) * scale;
        const dy = (clickPixel.y - epPixel.y) * scale;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SNAP_THRESHOLD_PX && dist < nearestDist) {
          nearestDist = dist;
          nearest = ep.point;
        }
      }
      return nearest;
    },
    [walls]
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!isDrawing || !e.latLng) return;
      const snapped = findSnapPoint(e.latLng);
      const point: WallPoint = snapped
        ? { lng: snapped.lng, lat: snapped.lat }
        : { lng: e.latLng.lng(), lat: e.latLng.lat() };

      if (snapped) {
        setSnapTarget(snapped);
        setTimeout(() => setSnapTarget(null), 1500);
        toast.info('Snapped to wall endpoint', { duration: 1500 });
      }

      // Add point first, then prompt for height
      onCurrentPointsChange((prev) => {
        const newPoints = [...prev, point];
        return newPoints;
      });
      
      // Show height prompt
      setHeightInput('');
      setHeightPrompt({ point, index: currentPoints.length });
    },
    [isDrawing, onCurrentPointsChange, findSnapPoint, currentPoints.length]
  );

  const handleHeightSubmit = useCallback(() => {
    if (heightPrompt === null) return;
    const height = parseFloat(heightInput) || 0;
    onCurrentPointsChange((prev) => {
      const updated = [...prev];
      if (updated[heightPrompt.index]) {
        updated[heightPrompt.index] = { ...updated[heightPrompt.index], height };
      }
      return updated;
    });
    setHeightPrompt(null);
    setHeightInput('');
  }, [heightPrompt, heightInput, onCurrentPointsChange]);

  const handleHeightSkip = useCallback(() => {
    setHeightPrompt(null);
    setHeightInput('');
  }, []);

  const handleNodeDragEnd = useCallback(
    (wallId: string, pointIndex: number, newPos: google.maps.LatLng) => {
      const updatedWalls = walls.map((wall) => {
        if (wall.id !== wallId) return wall;
        const newPoints = [...wall.points];
        newPoints[pointIndex] = { ...newPoints[pointIndex], lat: newPos.lat(), lng: newPos.lng() };
        return { ...wall, points: newPoints, length: calculatePolylineLength(newPoints) };
      });
      onWallsChange(updatedWalls);
    },
    [walls, onWallsChange]
  );

  const handleDrawNodeDragEnd = useCallback(
    (pointIndex: number, newPos: google.maps.LatLng) => {
      onCurrentPointsChange((prev) => {
        const updated = [...prev];
        updated[pointIndex] = { ...updated[pointIndex], lat: newPos.lat(), lng: newPos.lng() };
        return updated;
      });
    },
    [onCurrentPointsChange]
  );

  const confirmDeleteWall = (wall: WallSegment) => setWallToDelete(wall);

  const deleteWall = () => {
    if (!wallToDelete) return;
    const name = wallToDelete.name;
    onWallsChange(walls.filter((w) => w.id !== wallToDelete.id));
    if (activeWallId === wallToDelete.id) onActiveWallChange(null);
    setWallToDelete(null);
    toast('Wall deleted', { description: `${name} has been removed` });
  };

  const wallAngles = useMemo(() => findWallAngles(walls), [walls]);
  const endpoints = useMemo(() => (isDrawing ? getEndpoints(walls) : []), [isDrawing, walls]);

  const initialCenter = center ? { lat: center[1], lng: center[0] } : { lat: -25.2744, lng: 133.7751 };
  const initialZoom = center ? 20 : 4;

  if (!isLoaded) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl border border-border bg-card shadow-card lg:h-[700px]">
        <div className="text-center">
          <Map className="mx-auto mb-4 h-12 w-12 animate-spin text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="h-[400px] w-full overflow-hidden rounded-2xl shadow-card sm:h-[500px] lg:h-[700px]">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={initialCenter}
          zoom={initialZoom}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          mapTypeId={mapType}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            scaleControl: true,
            gestureHandling: 'greedy',
            tilt: 0,
            draggableCursor: isDrawing ? 'crosshair' : undefined,
            draggingCursor: isDrawing ? 'crosshair' : undefined,
            clickableIcons: false,
            styles: [
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
          }}
        >
          {/* Existing walls */}
          {walls.map((wall) => {
            const isActive = wall.id === activeWallId;
            const path = wall.points.map((p) => ({ lat: p.lat, lng: p.lng }));
            return (
              <div key={wall.id}>
                <Polyline
                  path={path}
                  options={{
                    strokeColor: isActive ? LIME_GREEN : LIME_GREEN_DARK,
                    strokeWeight: isActive ? 4 : 3,
                    strokeOpacity: 1,
                    clickable: true,
                  }}
                  onClick={() => onActiveWallChange(wall.id)}
                />
                {wall.points.map((p, i) => (
                  <Marker
                    key={`${wall.id}-node-${i}`}
                    position={{ lat: p.lat, lng: p.lng }}
                    draggable
                    onDragEnd={(e) => {
                      if (e.latLng) handleNodeDragEnd(wall.id, i, e.latLng);
                    }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 6,
                      fillColor: LIME_GREEN,
                      fillOpacity: 1,
                      strokeColor: '#fff',
                      strokeWeight: 2,
                    }}
                  />
                ))}
                {/* Height labels at each point */}
                {wall.points.map((p, i) => (
                  p.height && p.height > 0 ? (
                    <InfoWindow
                      key={`${wall.id}-height-${i}`}
                      position={{ lat: p.lat, lng: p.lng }}
                      options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -20) }}
                    >
                      <div style={{ padding: '1px 4px', fontSize: '10px', fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.7)', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                        {p.height}m
                      </div>
                    </InfoWindow>
                  ) : null
                ))}
                {wall.points.length >= 2 && (
                  <InfoWindow
                    position={(() => {
                      const mid = Math.floor(wall.points.length / 2);
                      return { lat: wall.points[mid].lat, lng: wall.points[mid].lng };
                    })()}
                    options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -15) }}
                  >
                    <div style={{ padding: '2px 6px', fontSize: '12px', fontWeight: 600, color: LIME_GREEN_DARK, whiteSpace: 'nowrap' }}>
                      {wall.name}: {wall.length.toFixed(1)}m
                    </div>
                  </InfoWindow>
                )}
              </div>
            );
          })}

          {/* Snap hint markers */}
          {endpoints.map((ep, i) => (
            <Marker
              key={`snap-hint-${i}`}
              position={{ lat: ep.point.lat, lng: ep.point.lng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: LIME_GREEN,
                fillOpacity: 0.3,
                strokeColor: LIME_GREEN,
                strokeWeight: 2,
              }}
              clickable={false}
            />
          ))}

          {/* Snap feedback */}
          {snapTarget && (
            <Marker
              position={{ lat: snapTarget.lat, lng: snapTarget.lng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                fillColor: LIME_GREEN,
                fillOpacity: 0.4,
                strokeColor: '#fff',
                strokeWeight: 3,
              }}
              clickable={false}
            />
          )}

          {/* Angle labels */}
          {wallAngles.map((wa, i) => (
            <InfoWindow
              key={`angle-${i}`}
              position={{ lat: wa.position.lat, lng: wa.position.lng }}
              options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -25) }}
            >
              <div style={{
                padding: '2px 6px', fontSize: '11px', fontWeight: 700, color: '#fff',
                background: 'rgba(0,0,0,0.7)', borderRadius: '4px', whiteSpace: 'nowrap',
              }}>
                {wa.angle.toFixed(1)}°
              </div>
            </InfoWindow>
          ))}

          {/* Currently drawing polyline */}
          {currentPoints.length >= 2 && (
            <Polyline
              path={currentPoints.map((p) => ({ lat: p.lat, lng: p.lng }))}
              options={{ strokeColor: LIME_GREEN, strokeWeight: 3, strokeOpacity: 0.8 }}
            />
          )}
          {currentPoints.map((p, i) => (
            <Marker
              key={`draw-${i}`}
              position={{ lat: p.lat, lng: p.lng }}
              draggable
              onDragEnd={(e) => {
                if (e.latLng) handleDrawNodeDragEnd(i, e.latLng);
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: LIME_GREEN,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              }}
            />
          ))}
        </GoogleMap>
      </div>

      {/* Empty state overlay */}
      {!center && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[2px]">
          <div className="text-center">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-base font-medium text-foreground">Search for your property</p>
            <p className="mt-1 text-sm text-muted-foreground">Use the search bar above to find your address</p>
          </div>
        </div>
      )}

      {/* Map style toggle */}
      <div className="absolute left-3 top-3 flex flex-col gap-2 sm:left-4 sm:top-4">
        <div className="flex overflow-hidden rounded-lg border border-border bg-card shadow-card">
          {(['satellite', 'hybrid'] as MapTypeId[]).map((t) => (
            <button
              key={t}
              onClick={() => setMapType(t)}
              className={`px-2.5 py-1.5 text-[11px] font-medium capitalize transition-colors sm:px-3 sm:py-2 sm:text-xs ${
                mapType === t ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
              }`}
            >
              {t === 'satellite' ? 'Satellite' : 'Hybrid'}
            </button>
          ))}
        </div>
      </div>

      {/* Drawing instructions */}
      {isDrawing && (
        <div className="absolute bottom-3 left-1/2 max-w-[calc(100%-6rem)] -translate-x-1/2 rounded-xl bg-card px-3 py-2 shadow-elevated sm:bottom-4 sm:max-w-none sm:px-4 sm:py-2.5">
          <p className="text-center text-xs font-medium text-foreground sm:text-sm">
            Click on the map to place wall points. Snap to existing endpoints for connected walls.{' '}
            {currentPoints.length >= 2 && (
              <span style={{ color: LIME_GREEN }}>
                Length: {calculatePolylineLength(currentPoints).toFixed(1)}m — Click "Finish Wall" when done.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Height prompt dialog */}
      <Dialog open={!!heightPrompt} onOpenChange={(open) => { if (!open) handleHeightSkip(); }}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-base">Wall Height at Point {heightPrompt ? heightPrompt.index + 1 : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm">Height at this point (metres)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 1.2"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleHeightSubmit(); }}
              autoFocus
              className="rounded-lg"
            />
            <p className="text-xs text-muted-foreground">Enter the retaining wall height at this specific point</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleHeightSkip}>Skip</Button>
            <Button size="sm" onClick={handleHeightSubmit}>Set Height</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!wallToDelete} onOpenChange={(open) => !open && setWallToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {wallToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {wallToDelete?.name} ({wallToDelete?.length.toFixed(1)}m) from your plan. This action cannot be undone.
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
