import { useRef, useEffect, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, Marker, InfoWindow } from '@react-google-maps/api';
import { WallPoint, WallSegment } from '@/lib/types';
import { calculatePolylineLength } from '@/lib/wallCalculations';
import { Map, Trash2, MapPin } from 'lucide-react';
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
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';

type MapTypeId = 'roadmap' | 'satellite' | 'hybrid';

const containerStyle = { width: '100%', height: '100%' };

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
  center: [number, number] | null; // [lng, lat]
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

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Fly to center when it changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.panTo({ lat: center[1], lng: center[0] });
      mapRef.current.setZoom(20);
    }
  }, [center]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!isDrawing || !e.latLng) return;
      const point: WallPoint = { lng: e.latLng.lng(), lat: e.latLng.lat() };
      onCurrentPointsChange((prev) => [...prev, point]);
    },
    [isDrawing, onCurrentPointsChange]
  );

  const confirmDeleteWall = (wall: WallSegment) => setWallToDelete(wall);

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

  const googleCenter = center ? { lat: center[1], lng: center[0] } : { lat: -25.2744, lng: 133.7751 };
  const defaultZoom = center ? 20 : 4;

  return (
    <div className="relative">
      <div className="h-[400px] w-full overflow-hidden rounded-2xl shadow-card sm:h-[500px] lg:h-[700px]">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={googleCenter}
          zoom={defaultZoom}
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
                    strokeColor: isActive ? '#2d6a4f' : '#52796f',
                    strokeWeight: isActive ? 4 : 3,
                    strokeOpacity: 1,
                    clickable: true,
                  }}
                  onClick={() => onActiveWallChange(wall.id)}
                />
                {/* Node markers */}
                {wall.points.map((p, i) => (
                  <Marker
                    key={`${wall.id}-node-${i}`}
                    position={{ lat: p.lat, lng: p.lng }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 5,
                      fillColor: isActive ? '#2d6a4f' : '#52796f',
                      fillOpacity: 1,
                      strokeColor: '#fff',
                      strokeWeight: 2,
                    }}
                  />
                ))}
                {/* Label */}
                {wall.points.length >= 2 && (
                  <InfoWindow
                    position={(() => {
                      const mid = Math.floor(wall.points.length / 2);
                      return { lat: wall.points[mid].lat, lng: wall.points[mid].lng };
                    })()}
                    options={{ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -15) }}
                  >
                    <div style={{ padding: '2px 6px', fontSize: '12px', fontWeight: 600, color: '#2d6a4f', whiteSpace: 'nowrap' }}>
                      {wall.name}: {wall.length.toFixed(1)}m
                    </div>
                  </InfoWindow>
                )}
              </div>
            );
          })}

          {/* Currently drawing polyline */}
          {currentPoints.length >= 2 && (
            <Polyline
              path={currentPoints.map((p) => ({ lat: p.lat, lng: p.lng }))}
              options={{ strokeColor: '#2d6a4f', strokeWeight: 3, strokeOpacity: 0.6 }}
            />
          )}
          {currentPoints.map((p, i) => (
            <Marker
              key={`draw-${i}`}
              position={{ lat: p.lat, lng: p.lng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: '#2d6a4f',
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
          {(['roadmap', 'satellite', 'hybrid'] as MapTypeId[]).map((t) => (
            <button
              key={t}
              onClick={() => setMapType(t)}
              className={`px-2.5 py-1.5 text-[11px] font-medium capitalize transition-colors sm:px-3 sm:py-2 sm:text-xs ${
                mapType === t ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
              }`}
            >
              {t === 'roadmap' ? 'Standard' : t === 'satellite' ? 'Satellite' : 'Hybrid'}
            </button>
          ))}
        </div>
      </div>

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
          {walls.map((wall) => (
            <div
              key={wall.id}
              onClick={() => onActiveWallChange(wall.id)}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs shadow-card transition-colors sm:px-3 sm:py-2 sm:text-sm ${
                activeWallId === wall.id ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'
              }`}
            >
              <span className="font-medium">{wall.name}: {wall.length.toFixed(1)}m</span>
              <button onClick={(e) => { e.stopPropagation(); confirmDeleteWall(wall); }} className="ml-2 opacity-60 hover:opacity-100">
                <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

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
