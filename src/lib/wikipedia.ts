import { POI, POICategory, Bounds } from './types';

const CACHE_KEY = 'explorer-wiki-cache';
const CACHE_DURATION = 60 * 60 * 1000;

interface CacheEntry {
  data: POI[];
  timestamp: number;
}

const WIKIPEDIA_GEO_SEARCH = 'https://es.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=';
const WIKIPEDIA_PAGE = 'https://es.wikipedia.org/w/api.php?action=query&titles=';

function getCache(): globalThis.Map<string, CacheEntry> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return new globalThis.Map(Object.entries(parsed));
    }
  } catch {
    // Ignore cache errors
  }
  return new globalThis.Map();
}

function setCache(cache: globalThis.Map<string, CacheEntry>) {
  try {
    const obj = Object.fromEntries(cache);
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore cache errors
  }
}

function getCacheKey(bounds: Bounds): string {
  return `${bounds.south.toFixed(2)}_${bounds.west.toFixed(2)}_${bounds.north.toFixed(2)}_${bounds.east.toFixed(2)}`;
}

export async function fetchPOIs(
  bounds: Bounds,
  categories: POICategory[]
): Promise<POI[]> {
  if (!bounds) return [];
  if (bounds.south >= bounds.north || bounds.west >= bounds.east) return [];
  
  const cacheKey = getCacheKey(bounds);
  const cache = getCache();
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const centerLat = (bounds.south + bounds.north) / 2;
  const centerLon = (bounds.west + bounds.east) / 2;
  const radiusKm = Math.max(bounds.north - bounds.south, bounds.east - bounds.west) * 111;

  try {
    const geoUrl = `${WIKIPEDIA_GEO_SEARCH}${centerLat}|${centerLon}&gsradius=${radiusKm * 1000}&gslimit=100&format=json&origin=*`;
    const geoRes = await fetch(geoUrl);

    if (!geoRes.ok) {
      console.warn('Wikipedia geo HTTP error:', geoRes.status);
      return cached?.data || [];
    }

    const geoData = await geoRes.json();
    
    if (!geoData.query?.geosearch) {
      return cached?.data || [];
    }

    const pois: POI[] = geoData.query.geosearch.map((item: { pageid: number; title: string; lat: number; lon: number }, _index: number) => {
      const category = detectCategoryFromTitle(item.title);
      
      return {
        id: `wiki-${item.pageid}`,
        name: item.title,
        category,
        lat: item.lat,
        lng: item.lon,
        imageUrl: `https://es.wikipedia.org/wiki/Special:FilePath/${item.title.replace(/ /g, '_')}.jpg`,
        wikipedia: `https://es.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
        address: undefined,
        description: `Artículo de Wikipedia - ${item.title}`,
      } as POI;
    });

    if (pois.length > 0) {
      cache.set(cacheKey, { data: pois, timestamp: Date.now() });
      setCache(cache);
    }

    return pois;
  } catch (err) {
    console.error('Wikipedia fetch error:', err);
    return cached?.data || [];
  }
}

function detectCategoryFromTitle(title: string): POICategory {
  const t = title.toLowerCase();
  if (t.includes('museo') || t.includes('museum')) return 'museum';
  if (t.includes('castillo') || t.includes('castle') || t.includes('fortaleza')) return 'castle';
  if (t.includes('iglesia') || t.includes('catedral') || t.includes('basílica') || t.includes('church') || t.includes('monasterio')) return 'church';
  if (t.includes('monumento') || t.includes('monument')) return 'monument';
  if (t.includes('restaurante') || t.includes('restaurant')) return 'restaurant';
  if (t.includes('lago') || t.includes('embalse') || t.includes('lake')) return 'lake';
  if (t.includes('pico') || t.includes('montaña') || t.includes('peak') || t.includes('mountain')) return 'peak';
  if (t.includes('mirador') || t.includes('viewpoint') || t.includes('vista')) return 'viewpoint';
  if (t.includes('puente') || t.includes('bridge')) return 'bridge';
  if (t.includes('ruta') || t.includes('sendero') || t.includes('hiking')) return 'hiking';
  return 'tourist';
}

export async function searchLocation(query: string): Promise<{ lat: number; lng: number; name: string }[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      { 
        headers: { 
          'Accept-Language': 'es',
          'User-Agent': 'ExploraMap/1.0'
        } 
      }
    );
    
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    return data.map((r: { lat: string; lon: string; display_name: string }) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      name: r.display_name,
    }));
  } catch (err) {
    console.error('Location search error:', err);
    return [];
  }
}
