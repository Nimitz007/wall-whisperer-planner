import { GOOGLE_MAPS_API_KEY } from './googleMapsConfig';

export interface ElevationGridPoint {
  lat: number;
  lng: number;
  elevation: number;
}

/**
 * Fetch a grid of elevations covering the visible map bounds.
 * Returns a flat array of points with elevation data.
 */
export async function fetchElevationGrid(
  bounds: { north: number; south: number; east: number; west: number },
  gridSize: number = 15
): Promise<ElevationGridPoint[]> {
  const points: { lat: number; lng: number }[] = [];
  const latStep = (bounds.north - bounds.south) / (gridSize - 1);
  const lngStep = (bounds.east - bounds.west) / (gridSize - 1);

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      points.push({
        lat: bounds.south + r * latStep,
        lng: bounds.west + c * lngStep,
      });
    }
  }

  // Google Elevation API allows up to 512 locations per request
  const batchSize = 256;
  const results: ElevationGridPoint[] = [];

  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    const locations = batch.map((p) => `${p.lat},${p.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locations)}&key=${GOOGLE_MAPS_API_KEY}`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status !== 'OK' || !Array.isArray(data.results)) continue;

      data.results.forEach((r: any, idx: number) => {
        results.push({
          lat: batch[idx].lat,
          lng: batch[idx].lng,
          elevation: r.elevation as number,
        });
      });
    } catch (e) {
      console.error('Elevation grid fetch error', e);
    }
  }

  return results;
}

/**
 * Given elevation grid points, generate contour line segments at specified intervals.
 * Uses simple marching-squares on the grid.
 */
export function generateContourLines(
  grid: ElevationGridPoint[],
  gridSize: number,
  interval: number = 0.5
): { level: number; segments: { lat1: number; lng1: number; lat2: number; lng2: number }[] }[] {
  if (grid.length < gridSize * gridSize) return [];

  const elevations = grid.map((p) => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);

  // Round to interval
  const startLevel = Math.ceil(minElev / interval) * interval;
  const endLevel = Math.floor(maxElev / interval) * interval;

  const contours: { level: number; segments: { lat1: number; lng1: number; lat2: number; lng2: number }[] }[] = [];

  for (let level = startLevel; level <= endLevel; level += interval) {
    const segments: { lat1: number; lng1: number; lat2: number; lng2: number }[] = [];

    for (let r = 0; r < gridSize - 1; r++) {
      for (let c = 0; c < gridSize - 1; c++) {
        // Four corners of this cell
        const tl = grid[r * gridSize + c];
        const tr = grid[r * gridSize + c + 1];
        const bl = grid[(r + 1) * gridSize + c];
        const br = grid[(r + 1) * gridSize + c + 1];

        const corners = [tl, tr, br, bl];
        const vals = corners.map((p) => p.elevation);

        // Marching squares case index
        let caseIndex = 0;
        if (vals[0] >= level) caseIndex |= 8;
        if (vals[1] >= level) caseIndex |= 4;
        if (vals[2] >= level) caseIndex |= 2;
        if (vals[3] >= level) caseIndex |= 1;

        if (caseIndex === 0 || caseIndex === 15) continue;

        // Interpolate edge crossings
        const interp = (p1: ElevationGridPoint, p2: ElevationGridPoint) => {
          const t = (level - p1.elevation) / (p2.elevation - p1.elevation);
          return {
            lat: p1.lat + t * (p2.lat - p1.lat),
            lng: p1.lng + t * (p2.lng - p1.lng),
          };
        };

        // Edges: top(0-1), right(1-2), bottom(2-3), left(3-0)
        const edges: Record<string, { lat: number; lng: number }> = {};
        const getEdge = (a: number, b: number, key: string) => {
          if (!edges[key]) {
            if ((vals[a] >= level) !== (vals[b] >= level)) {
              edges[key] = interp(corners[a], corners[b]);
            }
          }
          return edges[key];
        };

        const top = () => getEdge(0, 1, 'top');
        const right = () => getEdge(1, 2, 'right');
        const bottom = () => getEdge(3, 2, 'bottom');
        const left = () => getEdge(3, 0, 'left');

        const addSeg = (p1: { lat: number; lng: number } | undefined, p2: { lat: number; lng: number } | undefined) => {
          if (p1 && p2) segments.push({ lat1: p1.lat, lng1: p1.lng, lat2: p2.lat, lng2: p2.lng });
        };

        // Standard marching squares line segments
        switch (caseIndex) {
          case 1: addSeg(left(), bottom()); break;
          case 2: addSeg(bottom(), right()); break;
          case 3: addSeg(left(), right()); break;
          case 4: addSeg(top(), right()); break;
          case 5: addSeg(top(), left()); addSeg(bottom(), right()); break;
          case 6: addSeg(top(), bottom()); break;
          case 7: addSeg(top(), left()); break;
          case 8: addSeg(top(), left()); break;
          case 9: addSeg(top(), bottom()); break;
          case 10: addSeg(top(), right()); addSeg(left(), bottom()); break;
          case 11: addSeg(top(), right()); break;
          case 12: addSeg(left(), right()); break;
          case 13: addSeg(bottom(), right()); break;
          case 14: addSeg(left(), bottom()); break;
        }
      }
    }

    if (segments.length > 0) {
      contours.push({ level: Math.round(level * 100) / 100, segments });
    }
  }

  return contours;
}

/**
 * Get a color for a contour level based on relative position between min and max.
 */
export function getContourColor(level: number, minElev: number, maxElev: number): string {
  const range = maxElev - minElev || 1;
  const t = (level - minElev) / range;
  // Low = blue-green, high = orange-red
  const hue = 200 - t * 200; // 200 (blue) -> 0 (red)
  return `hsla(${hue}, 80%, 50%, 0.7)`;
}
