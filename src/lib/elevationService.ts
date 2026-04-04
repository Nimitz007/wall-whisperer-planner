export interface ElevationResult {
  lat: number;
  lng: number;
  elevation: number; // metres above sea level (AHD)
}

/**
 * Fetch elevation for one or more lat/lng points using the Google Maps JS ElevationService.
 * Must be called after the Google Maps JS API is loaded.
 */
export async function fetchElevations(
  points: { lat: number; lng: number }[]
): Promise<ElevationResult[]> {
  if (points.length === 0) return [];
  if (typeof google === 'undefined' || !google.maps?.ElevationService) {
    console.error('Google Maps ElevationService not available');
    return [];
  }

  const service = new google.maps.ElevationService();
  const locations = points.map((p) => new google.maps.LatLng(p.lat, p.lng));

  // ElevationService supports up to 512 locations per request
  const batchSize = 256;
  const results: ElevationResult[] = [];

  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);
    const batchPoints = points.slice(i, i + batchSize);
    try {
      const response = await service.getElevationForLocations({ locations: batch });
      if (response.results) {
        response.results.forEach((r, idx) => {
          results.push({
            lat: batchPoints[idx].lat,
            lng: batchPoints[idx].lng,
            elevation: r.elevation,
          });
        });
      }
    } catch (e) {
      console.error('ElevationService error', e);
    }
  }

  return results;
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
