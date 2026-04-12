import { POI, POICategory, Bounds } from './types';

const GpxFeedCache: { pois: POI[]; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000;

const GITHUB_GPX_URLS = {
  spain_caravan: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/spain-caravansites.gpx',
  spain_camping: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/spain-campsites.gpx',
  portugal_caravan: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/portugal-caravansites.gpx',
  portugal_camping: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/portugal-campsites.gpx',
  france_caravan: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/france-caravansites.gpx',
  france_camping: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/france-campsites.gpx',
  andorra_caravan: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/andorra-caravansites.gpx',
  andorra_camping: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/andorra-campsites.gpx',
  italy_caravan: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/italy-caravansites.gpx',
  italy_camping: 'https://raw.githubusercontent.com/GpxFeed/campgrounds/master/gpx/italy-campsites.gpx',
};

function parseGpxAttributes(wpt: Element): Partial<POI> {
  const nameEl = wpt.getElementsByTagName('name')[0];
  const descEl = wpt.getElementsByTagName('desc')[0];
  const symEl = wpt.getElementsByTagName('sym')[0];
  const typeEl = wpt.getElementsByTagName('type')[0];

  const name = nameEl?.textContent || '';
  const description = descEl?.textContent || '';
  const symbol = symEl?.textContent || '';
  const type = typeEl?.textContent || '';

  let category: POICategory = 'caravan_park';
  
  const lowerType = type.toLowerCase();
  const lowerSym = symbol.toLowerCase();
  const lowerDesc = description.toLowerCase();

  if (lowerType.includes('camping') || lowerType.includes('campground') || lowerSym.includes('camping') || lowerSym.includes('campers')) {
    category = 'caravan_park';
  } else if (lowerType.includes('ais') || lowerType.includes('aire') || lowerType.includes('service')) {
    category = 'caravansite';
  }

  let importance = 100;
  if (description && description.length > 50) importance += 30;
  if (description && (description.toLowerCase().includes('water') || description.toLowerCase().includes('electric'))) importance += 20;
  if (type.includes('Service') || type.includes('aire')) importance += 50;

  return {
    name: name.replace(/^[^a-zA-Z0-9àèéíòúüïÿñç]+/, '').trim() || 'Camping',
    category,
    description: description.substring(0, 500),
    importance,
    isBest: importance >= 150,
    fee: description,
  };
}

export async function loadPOIsFromGpxFeed(bounds: Bounds): Promise<POI[]> {
  const pois: POI[] = [];

  for (const [key, url] of Object.entries(GITHUB_GPX_URLS)) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/xml',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch ${key} GPX: ${response.status}`);
        continue;
      }

      const text = await response.text();
      const parser = new DOMParser();
      const gpx = parser.parseFromString(text, 'text/xml');
      const wpts = gpx.getElementsByTagName('wpt');

      for (let i = 0; i < wpts.length; i++) {
        const wpt = wpts[i];
        const lat = parseFloat(wpt.getAttribute('lat') || '0');
        const lon = parseFloat(wpt.getAttribute('lon') || '0');

        if (!lat || !lon) continue;

        const attrs = parseGpxAttributes(wpt);

        pois.push({
          id: `gpx-${key}-${i}`,
          lat,
          lng: lon,
          ...attrs,
        } as POI);
      }

      console.log(`Loaded ${wpts.length} POIs from GPX:${key}`);
    } catch (error) {
      console.error(`Error loading GPX:${key}:`, error);
    }
  }

  const filtered = pois.filter(
    (poi) =>
      poi.lat >= bounds.south &&
      poi.lat <= bounds.north &&
      poi.lng >= bounds.west &&
      poi.lng <= bounds.east
  );

  return filtered;
}

function filterByBounds(pois: POI[], bounds: Bounds): POI[] {
  return pois.filter(
    (poi) =>
      poi.lat >= bounds.south &&
      poi.lat <= bounds.north &&
      poi.lng >= bounds.west &&
      poi.lng <= bounds.east
  );
}

export function clearGpxCache(): void {
  (GpxFeedCache as any) = null;
}