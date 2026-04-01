import { POI, POICategory } from './types';

// Free publishable API key — register at https://dev.opentripmap.org/ for your own
const API_KEY = '5ae2e3f221c38a28845f05b685798510628f511af2b63af457dd37f4';
const BASE = 'https://api.opentripmap.com/0.1/es/places';

const CATEGORY_KINDS: Record<POICategory, string> = {
  museum: 'museums',
  castle: 'fortifications',
  cathedral: 'cathedrals',
  restaurant: 'restaurants,cafes',
  lake: 'lakes',
  peak: 'mountain_peaks',
  viewpoint: 'view_points',
  hiking: 'natural,other_nature_conservation_areas',
  bridge: 'bridges',
  tourist: 'interesting_places,tourist_facilities',
};

export async function fetchPOIs(
  bounds: { south: number; west: number; north: number; east: number },
  categories: POICategory[]
): Promise<POI[]> {
  const kinds = categories.map((c) => CATEGORY_KINDS[c]).join(',');

  const params = new URLSearchParams({
    lon_min: bounds.west.toString(),
    lon_max: bounds.east.toString(),
    lat_min: bounds.south.toString(),
    lat_max: bounds.north.toString(),
    kinds,
    rate: '2', // minimum rating 2 = interesting and above
    format: 'json',
    limit: '80',
    apikey: API_KEY,
  });

  try {
    const res = await fetch(`${BASE}/bbox?${params}`);
    if (!res.ok) {
      console.warn('OpenTripMap returned', res.status);
      return [];
    }

    const data = await res.json();

    return data
      .filter((el: any) => el.name && el.point)
      .map((el: any) => {
        const category = detectCategory(el.kinds || '', categories);
        return {
          id: el.xid,
          name: el.name,
          category,
          lat: el.point.lat,
          lng: el.point.lon,
          rating: rateToStars(el.rate),
          tags: { kinds: el.kinds || '', osm: el.osm || '' },
        } as POI;
      });
  } catch (err) {
    console.error('OpenTripMap fetch failed:', err);
    return [];
  }
}

function rateToStars(rate?: number): number | undefined {
  if (!rate) return undefined;
  // OpenTripMap rate: 1=unknown, 2=interesting, 3=attractive, 7=must-see
  if (rate >= 7) return 5;
  if (rate >= 3) return 4;
  if (rate >= 2) return 3;
  return undefined;
}

function detectCategory(kinds: string, active: POICategory[]): POICategory {
  const k = kinds.toLowerCase();
  if (k.includes('museum') && active.includes('museum')) return 'museum';
  if (k.includes('fortification') && active.includes('castle')) return 'castle';
  if (k.includes('cathedral') && active.includes('cathedral')) return 'cathedral';
  if ((k.includes('restaurant') || k.includes('cafe')) && active.includes('restaurant')) return 'restaurant';
  if (k.includes('lake') && active.includes('lake')) return 'lake';
  if (k.includes('mountain_peak') && active.includes('peak')) return 'peak';
  if (k.includes('view_point') && active.includes('viewpoint')) return 'viewpoint';
  if ((k.includes('nature') || k.includes('conservation')) && active.includes('hiking')) return 'hiking';
  if (k.includes('bridge') && active.includes('bridge')) return 'bridge';
  return active[0] || 'tourist';
}

export async function searchLocation(query: string): Promise<{ lat: number; lng: number; name: string }[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
    { headers: { 'Accept-Language': 'es' } }
  );
  const data = await res.json();
  return data.map((r: any) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    name: r.display_name,
  }));
}
