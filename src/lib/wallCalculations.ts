import { WallSegment, WallType, MaterialEstimate, WallPoint } from './types';

/**
 * Calculate distance between two geographic points (Haversine formula)
 * Returns distance in metres
 */
export function calculateDistance(p1: WallPoint, p2: WallPoint): number {
  const R = 6371000; // Earth radius in metres
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate total polyline length in metres
 */
export function calculatePolylineLength(points: WallPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i], points[i + 1]);
  }
  return total;
}

/**
 * Generate approximate material estimates for a wall segment
 */
export function estimateMaterials(wall: WallSegment): MaterialEstimate[] {
  const length = wall.length;
  const height = wall.maxHeight || 1;
  const area = length * height;

  switch (wall.wallType) {
    case 'concrete-sleeper':
      return [
        { item: 'Concrete Sleepers (200mm)', quantity: Math.ceil(area / (1.5 * 0.2)).toString(), unit: 'sleepers', notes: 'Based on 1500mm sleeper length' },
        { item: 'Steel H-Posts', quantity: Math.ceil(length / 2.4 + 1).toString(), unit: 'posts', notes: 'At 2.4m centres' },
        { item: 'Concrete (post footings)', quantity: (Math.ceil(length / 2.4 + 1) * 0.12).toFixed(2), unit: 'm³', notes: '400mm dia x 900mm deep' },
        { item: 'Drainage Aggregate', quantity: (length * 0.3 * height * 0.3).toFixed(2), unit: 'm³', notes: '300mm wide behind wall' },
        { item: 'Ag Pipe (100mm slotted)', quantity: Math.ceil(length).toString(), unit: 'lin.m', notes: 'Full length of wall' },
        { item: 'Geofabric', quantity: Math.ceil(length * (height + 0.6)).toString(), unit: 'm²', notes: 'Behind wall drainage zone' },
      ];

    case 'reinforced-masonry':
      return [
        { item: 'Concrete Blocks (200mm)', quantity: Math.ceil(area / (0.4 * 0.2)).toString(), unit: 'blocks', notes: '400x200mm blocks' },
        { item: 'Reinforcement (N12 bars)', quantity: Math.ceil(length / 0.4 * height / 0.4).toString(), unit: 'bars', notes: 'Vertical and horizontal' },
        { item: 'Grout Fill', quantity: (area * 0.2 * 0.5).toFixed(2), unit: 'm³', notes: 'Core fill allowance' },
        { item: 'Concrete Footing', quantity: (length * 0.6 * 0.3).toFixed(2), unit: 'm³', notes: '600mm wide x 300mm deep' },
        { item: 'Ag Pipe', quantity: Math.ceil(length).toString(), unit: 'lin.m', notes: 'Full length' },
        { item: 'Geofabric', quantity: Math.ceil(length * (height + 0.6)).toString(), unit: 'm²', notes: 'Drainage zone' },
      ];

    case 'reinforced-concrete':
      return [
        { item: 'Concrete (wall stem)', quantity: (length * 0.2 * height).toFixed(2), unit: 'm³', notes: '200mm thick stem' },
        { item: 'Concrete (base slab)', quantity: (length * (height * 0.7) * 0.3).toFixed(2), unit: 'm³', notes: 'Base = 0.7x height, 300mm thick' },
        { item: 'Reinforcement', quantity: Math.ceil(area * 15).toString(), unit: 'kg', notes: 'Approx 15kg/m² of wall' },
        { item: 'Formwork', quantity: Math.ceil(area * 2.2).toString(), unit: 'm²', notes: 'Both faces + base' },
        { item: 'Ag Pipe', quantity: Math.ceil(length).toString(), unit: 'lin.m', notes: 'Full length' },
        { item: 'Geofabric', quantity: Math.ceil(length * (height + 0.6)).toString(), unit: 'm²', notes: 'Drainage zone' },
      ];

    case 'timber':
      return [
        { item: 'Treated Timber Posts (125x125)', quantity: Math.ceil(length / 1.8 + 1).toString(), unit: 'posts', notes: 'At 1.8m centres' },
        { item: 'Treated Timber Rails (200x50)', quantity: Math.ceil(area / (2.4 * 0.2)).toString(), unit: 'rails', notes: '2.4m lengths' },
        { item: 'Concrete (post footings)', quantity: (Math.ceil(length / 1.8 + 1) * 0.08).toFixed(2), unit: 'm³', notes: '350mm dia x 800mm deep' },
        { item: 'Drainage Aggregate', quantity: (length * 0.2 * height * 0.3).toFixed(2), unit: 'm³', notes: '200mm behind wall' },
        { item: 'Ag Pipe', quantity: Math.ceil(length).toString(), unit: 'lin.m', notes: 'Full length' },
      ];

    case 'gabion':
      return [
        { item: 'Gabion Baskets (2x1x1m)', quantity: Math.ceil(length / 2 * Math.ceil(height)).toString(), unit: 'baskets', notes: 'Stacked to height' },
        { item: 'Gabion Stone Fill', quantity: (length * 1.0 * height).toFixed(2), unit: 'm³', notes: '1m deep baskets' },
        { item: 'Geofabric', quantity: Math.ceil(length * (height + 1)).toString(), unit: 'm²', notes: 'Behind baskets' },
      ];

    default:
      return [
        { item: 'Wall Area', quantity: area.toFixed(1), unit: 'm²', notes: 'Custom wall - specify materials' },
        { item: 'Wall Length', quantity: length.toFixed(1), unit: 'lin.m', notes: '' },
      ];
  }
}

/**
 * Get total wall length across all segments
 */
export function getTotalWallLength(walls: WallSegment[]): number {
  return walls.reduce((sum, w) => sum + w.length, 0);
}

/**
 * Generate wall name (Wall A, Wall B, ...)
 */
export function generateWallName(index: number): string {
  return `Wall ${String.fromCharCode(65 + index)}`;
}
