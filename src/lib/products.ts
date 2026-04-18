import { supabase } from '@/integrations/supabase/client';

export interface Product {
  id: string;
  sku: string | null;
  product_name: string;
  category: string;
  size: string | null;
  colour: string | null;
  price: number;
  image_filename: string | null;
  image_path: string | null;
  is_selectable: boolean;
  display_order: number;
  wall_type: string | null;
  active: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

export async function fetchSelectableProducts(wallType?: string): Promise<Product[]> {
  let q = supabase.from('products').select('*').eq('active', true).eq('is_selectable', true).order('display_order');
  if (wallType) q = q.eq('wall_type', wallType);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function fetchAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('display_order');
  if (error) throw error;
  return (data ?? []) as Product[];
}

/**
 * Estimate sleeper qty for a wall using product size.
 * Sleeper face area = sleeper_length_mm * sleeper_height_mm.
 * qty = ceil(wall_area / face_area) with 5% wastage.
 */
export function estimateSleeperQty(wallLengthM: number, wallHeightM: number, sizeStr: string | null): number {
  if (!sizeStr) return 0;
  // Match e.g. "2000x200x80mm"
  const m = sizeStr.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i);
  if (!m) return 0;
  const lenM = parseInt(m[1], 10) / 1000;
  const heightM = parseInt(m[2], 10) / 1000;
  if (lenM <= 0 || heightM <= 0) return 0;
  const wallArea = wallLengthM * wallHeightM;
  const faceArea = lenM * heightM;
  return Math.ceil((wallArea / faceArea) * 1.05);
}

export function priceRange(unitPrice: number, qty: number): { low: number; high: number } {
  // Material-only base price; add 15% buffer for high estimate
  const low = unitPrice * qty;
  const high = low * 1.15;
  return { low, high };
}
