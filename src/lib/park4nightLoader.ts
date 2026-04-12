import { POI, POICategory, Bounds } from './types';

interface Park4NightPlace {
  lieu_id: string;
  nom: string;
  type: string;
  latitude: string;
  longitude: string;
  adresse?: string;
  description?: string;
  note?: string;
  nb_avis?: string;
  urlPhoto1?: string;
  urlVideo?: string;
}

const boundsCache: Map<string, { bounds: Bounds; pois: POI[]; timestamp: number }> = new Map();
const CACHE_DURATION = 30 * 60 * 1000;

function mapPark4nightTypeToCategory(type: string): POICategory {
  const typeLower = type?.toLowerCase() || '';
  
  if (typeLower.includes('service') || typeLower.includes('aire')) {
    return 'caravansite';
  }
  if (typeLower.includes('parking') || typeLower.includes('camping') || typeLower.includes('naturel')) {
    return 'caravan_park';
  }
  
  return 'caravan_park';
}

function calculateImportance(place: Park4NightPlace): { importance: number, isBest: boolean } {
  let score = 100;
  
  if (place.note) {
    const note = parseFloat(place.note.replace(',', '.'));
    if (!isNaN(note)) {
      score += note * 20;
    }
  }
  
  if (place.nb_avis) {
    const nbAvis = parseInt(place.nb_avis, 10);
    if (!isNaN(nbAvis)) {
      score += Math.min(nbAvis * 2, 100);
    }
  }
  
  if (place.type?.toLowerCase().includes('service')) {
    score += 50;
  }
  
  return { 
    importance: score, 
    isBest: score >= 120
  };
}

function boundsToCacheKey(bounds: Bounds): string {
  return `${bounds.south.toFixed(2)},${bounds.west.toFixed(2)},${bounds.north.toFixed(2)},${bounds.east.toFixed(2)}`;
}

export async function loadPOIsFromPark4Night(bounds: Bounds): Promise<POI[]> {
  const cacheKey = boundsToCacheKey(bounds);
  const cached = boundsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.pois;
  }

  const { south, west, north, east } = bounds;
  const centerLat = (south + north) / 2;
  const centerLng = (west + east) / 2;

  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(`https://guest.park4night.com/services/V4.1/lieuxGetFilter.php?latitude=${centerLat}&longitude=${centerLng}`)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://guest.park4night.com/services/V4.1/lieuxGetFilter.php?latitude=${centerLat}&longitude=${centerLng}`)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) continue;

      const text = await response.text();
      const data = JSON.parse(text);
      const places: Park4NightPlace[] = data.listes || data || [];
      
      const pois: POI[] = places
      .filter(place => {
        const lat = parseFloat(place.latitude);
        const lng = parseFloat(place.longitude);
        return lat >= south && lat <= north && lng >= west && lng <= east;
      })
      .map(place => {
        const lat = parseFloat(place.latitude);
        const lng = parseFloat(place.longitude);
        const { importance, isBest } = calculateImportance(place);
        
        return {
          id: `p4n-${place.lieu_id}`,
          name: place.nom || 'Park4Night Place',
          category: mapPark4nightTypeToCategory(place.type || ''),
          lat,
          lng,
          rating: place.note ? parseFloat(place.note.replace(',', '.')) : undefined,
          reviewCount: place.nb_avis ? parseInt(place.nb_avis, 10) : undefined,
          address: place.adresse,
          description: place.description,
          tags: {
            type: place.type,
            source: 'park4night',
          },
          importance,
          isBest,
        };
      });

    boundsCache.set(cacheKey, { bounds, pois, timestamp: Date.now() });
      return pois;
    } catch (error) {
      console.error('Error loading Park4Night POIs:', error);
      continue;
    }
  }
  
  return cached?.pois || [];
}

export function clearPark4NightCache(): void {
  boundsCache.clear();
}
