import { WallSegment, WallType, MaterialEstimate, WallPoint } from './types';

export function calculateDistance(p1: WallPoint, p2: WallPoint): number {
  const R = 6371000;
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

export function calculatePolylineLength(points: WallPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i], points[i + 1]);
  }
  return total;
}

function mat(
  item: string,
  qty: number,
  unit: string,
  wastage: number,
  category: string,
  assumption: string,
  notes: string = ''
): MaterialEstimate {
  const qtyW = qty * (1 + wastage / 100);
  return {
    item,
    quantity: Number.isInteger(qty) ? qty.toString() : qty.toFixed(2),
    unit,
    notes,
    wastagePercent: wastage,
    qtyWithWastage: Number.isInteger(Math.ceil(qtyW)) ? Math.ceil(qtyW).toString() : qtyW.toFixed(2),
    category,
    assumption,
  };
}

export function estimateMaterials(wall: WallSegment): MaterialEstimate[] {
  const length = wall.length;
  const height = wall.maxHeight || 1;
  const area = length * height;
  const numPosts = Math.ceil(length / 2.4 + 1);

  switch (wall.wallType) {
    case 'concrete-sleeper':
      return [
        mat('Concrete Sleepers (200x1500mm)', Math.ceil(area / (1.5 * 0.2)), 'sleepers', 5, 'STRUCTURAL',
          'Sleeper size 1500x200mm; qty = wall area / sleeper face area (0.30 m2)',
          'Standard 1500mm sleepers stacked horizontally'),
        mat('Steel H-Posts (150UC23)', numPosts, 'posts', 0, 'STRUCTURAL',
          `Posts at 2.4m centres; qty = ceil(${length.toFixed(1)}m / 2.4) + 1`,
          'Galvanised 150UC23 steel H-columns'),
        mat('Concrete - Post Footings', +(numPosts * 0.12).toFixed(2), 'm3', 5, 'CONCRETE',
          `Each footing 400mm dia x 900mm deep = 0.12 m3; qty = ${numPosts} footings`,
          'N20/10 concrete, min 25 MPa'),
        mat('Drainage Aggregate (20mm)', +(length * 0.3 * height * 0.3).toFixed(2), 'm3', 10, 'DRAINAGE',
          '300mm wide x 300mm deep drainage zone behind wall face',
          'Clean crushed rock, no fines'),
        mat('Ag Pipe - 100mm Slotted', Math.ceil(length), 'lin.m', 5, 'DRAINAGE',
          'Full wall length at base of drainage zone',
          'Perforated PVC with geofabric sock'),
        mat('Geofabric Cloth', Math.ceil(length * (height + 0.6)), 'm2', 10, 'DRAINAGE',
          `Width = wall height + 0.6m return; area = ${length.toFixed(1)}m x (${height}m + 0.6m)`,
          'Non-woven geotextile, min 150 g/m2'),
        mat('Backfill - Select Material', +(length * 0.3 * height).toFixed(2), 'm3', 10, 'EARTHWORKS',
          '300mm deep compacted fill behind sleepers',
          'Compacted in 150mm layers to 95% MDD'),
      ];

    case 'reinforced-masonry': {
      const blocks = Math.ceil(area / (0.4 * 0.2));
      const vertBars = Math.ceil(length / 0.4);
      const horizBars = Math.ceil(height / 0.2);
      return [
        mat('Concrete Blocks (200mm series)', blocks, 'blocks', 5, 'MASONRY',
          `Block face area = 400x200mm (0.08 m2); qty = ${area.toFixed(1)} m2 / 0.08`,
          '200mm hollow core masonry units'),
        mat('Reinforcement - N12 Vertical', vertBars, 'bars', 5, 'REINFORCEMENT',
          `Vertical bars at 400mm centres; qty = ceil(${length.toFixed(1)}m / 0.4)`,
          'Deformed bar Grade 500N'),
        mat('Reinforcement - N12 Horizontal', horizBars * Math.ceil(length / 6), 'bars', 5, 'REINFORCEMENT',
          'Horizontal bars at 200mm vert spacing x wall length in 6m bars',
          'Truss-type or straight bar in bond beam'),
        mat('Grout Fill (core)', +(area * 0.2 * 0.5).toFixed(2), 'm3', 5, 'CONCRETE',
          'Core fill allowance: 50% of cores filled at 200mm wall width',
          'Grout min 20 MPa, 10mm aggregate'),
        mat('Concrete Footing (strip)', +(length * 0.6 * 0.3).toFixed(2), 'm3', 5, 'CONCRETE',
          'Strip footing 600mm wide x 300mm deep',
          'N20/10, with N12 bars top & bottom'),
        mat('Ag Pipe - 100mm Slotted', Math.ceil(length), 'lin.m', 5, 'DRAINAGE',
          'Full length at footing level', ''),
        mat('Geofabric Cloth', Math.ceil(length * (height + 0.6)), 'm2', 10, 'DRAINAGE',
          'Drainage zone lining behind wall', 'Non-woven geotextile'),
        mat('Damp-proof Course (DPC)', Math.ceil(length), 'lin.m', 5, 'MASONRY',
          'Full length at base of masonry above footing',
          'Polyethylene DPC membrane'),
      ];
    }

    case 'reinforced-concrete':
      return [
        mat('Concrete - Wall Stem', +(length * 0.2 * height).toFixed(2), 'm3', 5, 'CONCRETE',
          `Stem 200mm thick x ${height}m high x ${length.toFixed(1)}m long`,
          'N32/10 concrete, min 32 MPa'),
        mat('Concrete - Base Slab', +(length * (height * 0.7) * 0.3).toFixed(2), 'm3', 5, 'CONCRETE',
          `Base width = 0.7 x height (${(height * 0.7).toFixed(1)}m), 300mm thick`,
          'N32/10 concrete, min 32 MPa'),
        mat('Reinforcement - Steel', Math.ceil(area * 15), 'kg', 5, 'REINFORCEMENT',
          'Approx 15 kg/m2 of wall face area (both directions)',
          'N12 & N16 bars Grade 500N to engineer detail'),
        mat('Formwork', Math.ceil(area * 2.2), 'm2', 5, 'FORMWORK',
          'Both faces of stem + base edges; factor 2.2x wall area',
          'Plywood or steel form, F3 finish'),
        mat('Kicker / Construction Joint', Math.ceil(length), 'lin.m', 0, 'FORMWORK',
          'At stem-to-base junction', 'Waterstop if required'),
        mat('Ag Pipe - 100mm Slotted', Math.ceil(length), 'lin.m', 5, 'DRAINAGE',
          'Full length behind heel of base', ''),
        mat('Geofabric Cloth', Math.ceil(length * (height + 0.6)), 'm2', 10, 'DRAINAGE',
          'Drainage zone lining', 'Non-woven geotextile'),
        mat('Backfill - Select Material', +(length * 0.5 * height).toFixed(2), 'm3', 10, 'EARTHWORKS',
          'Behind heel slab, compacted layers', ''),
      ];

    case 'timber': {
      const timberPosts = Math.ceil(length / 1.8 + 1);
      return [
        mat('Treated Timber Posts (125x125mm)', timberPosts, 'posts', 5, 'STRUCTURAL',
          `Posts at 1.8m centres; qty = ceil(${length.toFixed(1)}m / 1.8) + 1`,
          'H5 treated hardwood or CCA pine'),
        mat('Treated Timber Rails (200x50mm)', Math.ceil(area / (2.4 * 0.2)), 'rails', 5, 'STRUCTURAL',
          'Rails in 2.4m lengths stacked horizontally',
          'H4 treated, bolted to posts'),
        mat('Coach Bolts (M12x150mm)', timberPosts * Math.ceil(height / 0.2) * 2, 'bolts', 5, 'FIXINGS',
          '2 bolts per rail-post connection',
          'Hot-dip galvanised'),
        mat('Concrete - Post Footings', +(timberPosts * 0.08).toFixed(2), 'm3', 5, 'CONCRETE',
          `Each footing 350mm dia x 800mm deep = 0.08 m3; qty = ${timberPosts}`,
          'N20/10 concrete'),
        mat('Drainage Aggregate (20mm)', +(length * 0.2 * height * 0.3).toFixed(2), 'm3', 10, 'DRAINAGE',
          '200mm wide behind wall', 'Clean crushed rock'),
        mat('Ag Pipe - 100mm Slotted', Math.ceil(length), 'lin.m', 5, 'DRAINAGE',
          'Full length at base', ''),
      ];
    }

    case 'gabion':
      return [
        mat('Gabion Baskets (2x1x1m)', Math.ceil(length / 2 * Math.ceil(height)), 'baskets', 0, 'STRUCTURAL',
          'Stacked to height; qty = ceil(length / 2) x ceil(height)',
          'Galfan coated welded mesh, 100x50mm aperture'),
        mat('Gabion Stone Fill (100-200mm)', +(length * 1.0 * height).toFixed(2), 'm3', 5, 'STRUCTURAL',
          '1m deep baskets filled with rock',
          'Durable igneous rock, min 100mm'),
        mat('Geofabric Cloth', Math.ceil(length * (height + 1)), 'm2', 10, 'DRAINAGE',
          'Behind baskets to prevent soil migration',
          'Non-woven geotextile'),
        mat('Spiral / Lacing Wire', Math.ceil(length / 2 * Math.ceil(height)) * 4, 'metres', 5, 'FIXINGS',
          'Approx 4m wire per basket for lacing panels',
          'Galfan coated wire'),
      ];

    default:
      return [
        mat('Wall Area (custom)', +area.toFixed(1), 'm2', 5, 'GENERAL',
          'Custom wall - specify materials per engineer',
          'Contact engineer for detailed specification'),
        mat('Wall Length', +length.toFixed(1), 'lin.m', 0, 'GENERAL',
          'Total wall length', ''),
      ];
  }
}

export function getTotalWallLength(walls: WallSegment[]): number {
  return walls.reduce((sum, w) => sum + w.length, 0);
}

export function generateWallName(index: number): string {
  return `Wall ${String.fromCharCode(65 + index)}`;
}
