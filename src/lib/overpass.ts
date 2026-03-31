import { POI, POICategory } from './types';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const CATEGORY_QUERIES: Record<POICategory, string> = {
  museum: 'node["tourism"="museum"]',
  castle: 'node["historic"="castle"];way["historic"="castle"]',
  cathedral: 'node["building"="cathedral"];node["amenity"="place_of_worship"]["building"="cathedral"]',
  restaurant: 'node["amenity"="restaurant"]',
  lake: 'node["natural"="water"]["water"="lake"];way["natural"="water"]["water"="lake"]',
  peak: 'node["natural"="peak"]',
  viewpoint: 'node["tourism"="viewpoint"]',
  hiking: 'node["information"="guidepost"]["hiking"="yes"];node["tourism"="information"]["information"="guidepost"]',
  bridge: 'node["man_made"="bridge"];way["bridge"="yes"]["footway"="yes"]',
  tourist: 'node["tourism"="attraction"]',
};

export async function fetchPOIs(
  bounds: { south: number; west: number; north: number; east: number },
  categories: POICategory[]
): Promise<POI[]> {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

  const queries = categories.map((cat) => {
    const parts = CATEGORY_QUERIES[cat].split(';');
    return parts.map((p) => `${p}(${bbox});`).join('\n');
  });

  const query = `
    [out:json][timeout:15];
    (
      ${queries.join('\n')}
    );
    out center 80;
  `;

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!res.ok) {
        console.warn(`Overpass endpoint ${url} returned ${res.status}, trying next...`);
        continue;
      }

      const text = await res.text();
      if (text.includes('<html') || text.includes('Error')) {
        console.warn(`Overpass endpoint ${url} returned HTML error, trying next...`);
        continue;
      }

      const data = JSON.parse(text);

    return data.elements
      .filter((el: any) => {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        return lat && lng && el.tags?.name;
      })
      .map((el: any) => {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const category = detectCategory(el.tags, categories);

        return {
          id: `${el.type}-${el.id}`,
          name: el.tags.name,
          category,
          lat,
          lng,
          tags: el.tags,
          rating: el.tags?.stars ? parseInt(el.tags.stars) : undefined,
        } as POI;
      });
  } catch (err) {
    console.error('Error fetching POIs:', err);
    return [];
  }
}

function detectCategory(tags: Record<string, string>, active: POICategory[]): POICategory {
  if (tags.tourism === 'museum' && active.includes('museum')) return 'museum';
  if (tags.historic === 'castle' && active.includes('castle')) return 'castle';
  if (tags.building === 'cathedral' && active.includes('cathedral')) return 'cathedral';
  if (tags.amenity === 'restaurant' && active.includes('restaurant')) return 'restaurant';
  if (tags.natural === 'water' && active.includes('lake')) return 'lake';
  if (tags.natural === 'peak' && active.includes('peak')) return 'peak';
  if (tags.tourism === 'viewpoint' && active.includes('viewpoint')) return 'viewpoint';
  if ((tags.information === 'guidepost' || tags.hiking === 'yes') && active.includes('hiking')) return 'hiking';
  if ((tags.man_made === 'bridge' || tags.bridge === 'yes') && active.includes('bridge')) return 'bridge';
  if (tags.tourism === 'attraction' && active.includes('tourist')) return 'tourist';
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
