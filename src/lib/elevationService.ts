import { GOOGLE_MAPS_API_KEY } from './googleMapsConfig';

export interface ElevationResult {
  lat: number;
  lng: number;
  elevation: number; // metres above sea level
}

/**
 * Fetch elevation for one or more lat/lng points using the Google Elevation API.
 * Returns elevation in metres (AHD / sea level).
 */
export async function fetchElevations(
  points: { lat: number; lng: number }[]
): Promise<ElevationResult[]> {
  if (points.length === 0) return [];

  const locations = points.map((p) => `${p.lat},${p.lng}`).join('|');
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locations)}&key=${GOOGLE_MAPS_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error('Elevation API HTTP error', res.status);
    return [];
  }

  const data = await res.json();
  if (data.status !== 'OK' || !Array.isArray(data.results)) {
    console.error('Elevation API error', data.status, data.error_message);
    return [];
  }

  return data.results.map((r: any, i: number) => ({
    lat: points[i].lat,
    lng: points[i].lng,
    elevation: r.elevation as number,
  }));
}

/**
 * Fetch elevation for a single point.
 */
export async function fetchSingleElevation(
  lat: number,
  lng: number
): Promise<number | null> {
  const results = await fetchElevations([{ lat, lng }]);
  return results.length > 0 ? results[0].elevation : null;
}
