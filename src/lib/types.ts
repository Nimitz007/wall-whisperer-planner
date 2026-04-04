export type WallType =
  | 'concrete-sleeper'
  | 'reinforced-masonry'
  | 'reinforced-concrete'
  | 'timber'
  | 'gabion'
  | 'custom';

export const WALL_TYPE_LABELS: Record<WallType, string> = {
  'concrete-sleeper': 'Concrete Sleeper Retaining Wall',
  'reinforced-masonry': 'Reinforced Masonry Retaining Wall',
  'reinforced-concrete': 'Reinforced Concrete Cantilever Wall',
  'timber': 'Timber Retaining Wall',
  'gabion': 'Gabion Wall',
  'custom': 'Other / Custom',
};

export interface WallPoint {
  lng: number;
  lat: number;
}

export interface WallSegment {
  id: string;
  name: string;
  points: WallPoint[];
  wallType: WallType;
  length: number; // metres
  averageHeight: number;
  maxHeight: number;
  offsetFromDwelling: number;
  offsetFromBoundary: number;
  hasSurcharge: boolean;
  hasFenceAbove: boolean;
  hasDrainageRequired: boolean;
  notes: string;
  materialAssumptions: string;
}

export interface ProjectDetails {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  isBuilder: boolean;
  companyName: string;
}

export interface SiteContext {
  distanceToHouse: string;
  distanceToBoundary: string;
  slopeNotes: string;
  accessNotes: string;
  adjoiningStructures: string;
  comments: string;
}

export interface ProjectState {
  details: ProjectDetails;
  walls: WallSegment[];
  siteContext: SiteContext;
  currentStep: number;
  isPaid: boolean;
  disclaimerAccepted: boolean;
}

export interface MaterialEstimate {
  item: string;
  quantity: string;
  unit: string;
  notes: string;
}
