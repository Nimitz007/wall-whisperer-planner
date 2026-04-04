import { fetchElevations } from './elevationService';

export interface ElevationGridPoint {
  lat: number;
  lng: number;
  elevation: number;
}

/**
 * Fetch a grid of elevations covering the visible map bounds.
 * Uses the Google Maps JS ElevationService (no CORS issues).
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

  const results = await fetchElevations(points);
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

  const startLevel = Math.ceil(minElev / interval) * interval;
  const endLevel = Math.floor(maxElev / interval) * interval;

  const contours: { level: number; segments: { lat1: number; lng1: number; lat2: number; lng2: number }[] }[] = [];

  for (let level = startLevel; level <= endLevel; level += interval) {
    const segments: { lat1: number; lng1: number; lat2: number; lng2: number }[] = [];

    for (let r = 0; r < gridSize - 1; r++) {
      for (let c = 0; c < gridSize - 1; c++) {
        const tl = grid[r * gridSize + c];
        const tr = grid[r * gridSize + c + 1];
        const bl = grid[(r + 1) * gridSize + c];
        const br = grid[(r + 1) * gridSize + c + 1];

        const corners = [tl, tr, br, bl];
        const vals = corners.map((p) => p.elevation);

        let caseIndex = 0;
        if (vals[0] >= level) caseIndex |= 8;
        if (vals[1] >= level) caseIndex |= 4;
        if (vals[2] >= level) caseIndex |= 2;
        if (vals[3] >= level) caseIndex |= 1;

        if (caseIndex === 0 || caseIndex === 15) continue;

        const interp = (p1: ElevationGridPoint, p2: ElevationGridPoint) => {
          const t = (level - p1.elevation) / (p2.elevation - p1.elevation);
          return {
            lat: p1.lat + t * (p2.lat - p1.lat),
            lng: p1.lng + t * (p2.lng - p1.lng),
          };
        };

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
  const hue = 200 - t * 200;
  return `hsla(${hue}, 80%, 50%, 0.7)`;
}
