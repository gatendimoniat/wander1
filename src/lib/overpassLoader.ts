import { POI, POICategory, Bounds } from './types';

const boundsCache: Map<string, { bounds: Bounds; pois: POI[]; timestamp: number }> = new Map();
const CACHE_DURATION = 30 * 60 * 1000;

// Llista de servidors mirror per redundància global
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

function getCategory(tags: Record<string, string>): POICategory | null {
  // Patrimoni i Arqueologia (Criteri UNESCO / BIC)
  if (tags.unesco === 'yes' || tags['heritage:operator'] === 'unesco' || tags.heritage === 'yes' || tags.heritage === '1' || tags.heritage === '2' || tags.heritage === 'unesco') return 'heritage';
  if (tags.historic === 'archaeological_site' || tags.historic === 'city_wall' || tags.historic === 'aqueduct' || tags.historic === 'battlefield') return 'heritage';
  
  if (tags.place === 'city' || tags.place === 'town' || tags.place === 'village') return 'city';
  if (tags.tourism === 'museum') return 'museum';
  if (tags.historic === 'castle' || tags.historic === 'fortress') return 'castle';
  if (tags.historic === 'monument' || tags.historic === 'memorial' || tags.historic === 'ruins') return 'monument';
  if (tags.tourism === 'restaurant' || tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'bar') return 'restaurant';
  if (tags.natural === 'beach') return 'beach';
  if (tags.natural === 'peak' || tags.natural === 'mountain') return 'peak';
  if (tags.natural === 'lake' || tags.natural === 'water' || tags.natural === 'spring') return 'lake';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'alpine_hut' || (tags.amenity === 'shelter' && tags.shelter_type === 'basic_hut')) return 'shelter';
  if (tags.natural === 'spring') return 'fountain';
  if (tags.amenity === 'townhall') return 'townhall';
  if (tags.tourism === 'attraction' || tags.tourism === 'artwork') return 'tourist';
  
  // Esglésies i llocs de culte
  if (tags.amenity === 'place_of_worship' || tags.building === 'church' || tags.building === 'cathedral') return 'church';
  if (tags.historic === 'church' || tags.historic === 'cathedral' || tags.historic === 'chapel' || tags.historic === 'abbey') return 'church';
  
  // Pavellons i poliesportius - només els municipals o amb nom relacionat
  if (tags.leisure === 'sports_centre' || tags.amenity === 'sports_centre') {
    const name = tags.name?.toLowerCase() || '';
    const isMunicipal = name.includes('municipal') || name.includes('pavelló') || name.includes('pavello') || name.includes('poliesportiu') || name.includes('polideportivo') || name.includes('centre esportiu') || name.includes('centro deportivo');
    if (isMunicipal || name.includes('esportiu') || name.includes('deportivo')) return 'sports_centre';
  }
  if ((tags.leisure === 'swimming_pool' || tags.amenity === 'swimming_pool') && (tags.name?.toLowerCase().includes('municipal') || tags.name?.toLowerCase().includes('piscina'))) return 'sports_centre';
  
  // Cementiris
  if (tags.landuse === 'cemetery' || tags.amenity === 'cemetery') return 'cemetery';
  
  // Autocaravanes SENSE serveis (camping, caravan_park) - ABANS de amb serveis
  const nameL = (tags.name || '').toLowerCase();
  const descL = (tags.description || '').toLowerCase();
  if (tags.tourism === 'camping') return 'caravan_park';
  if (tags.amenity === 'parking' && tags.caravan === 'yes') return 'caravan_park';
  if (tags.leisure === 'parking' && tags.caravan === 'yes') return 'caravan_park';
  if (tags.leisure === 'pitch' && (tags.sport === 'caravan' || tags.tourism === 'camping')) return 'caravan_park';
  if (nameL.includes('caravan') || nameL.includes('autocaravan') || nameL.includes('autohome') || nameL.includes('motorhome')) return 'caravan_park';
  if (descL.includes('caravan') || descL.includes('autocaravan') || descL.includes('autohome') || descL.includes('motorhome')) return 'caravan_park';
  
  // Autocaravanes AMB serveis (caravansite, camp_site)
  if (tags.tourism === 'caravansite') return 'caravansite';
  if (tags.tourism === 'camp_site') return 'caravansite';
  if (tags.tourism === 'camp_site' && (tags.fee === 'yes' || tags.sanitary_dump_station === 'yes')) return 'caravansite';
  
  // Parkings gratuïts - mes flexible
  if (tags.amenity === 'parking' || tags.leisure === 'parking') {
    const isFree = tags.fee === 'no' || tags.fee === undefined || !tags.fee;
    if (isFree) return 'parking';
  }
  if (tags.leisure === 'parking' && tags.fee === 'no') return 'parking';
  
  // Gorgs i salts d'aigua - ampliat
  if (tags.natural === 'waterfall' || tags.water === 'waterfall' || tags.natural === 'rapids' || tags.natural === 'gorge') return 'waterfall';
  if (tags.waterway === 'waterfall' || tags.waterway === 'rapids') return 'waterfall';
  
  if (tags.tourism) return 'tourist';
  if (tags.historic) return 'monument';
  
  return null;
}

function calculateImportance(tags: Record<string, string>): { importance: number, isBest: boolean } {
  let score = 0;
  
  // 1. REPUTACIÓ I VERIFICACIÓ (Pila de dades reals)
  // UNESCO i Patrimoni Nacional
  if (tags.unesco === 'yes' || tags['heritage:operator'] === 'unesco' || tags.heritage === 'unesco') score += 600;
  if (tags.heritage === '1') score += 400; 
  if (tags.heritage === '2' || tags.heritage === 'yes') score += 200;
  
  // Wikipedia & Wikidata (Indicadors de rellevància global)
  if (tags.wikipedia) score += 400;
  if (tags.wikidata) score += 200;
  
  // 2. RIQUESA DE DADES (Proxy de qualitat/interès)
  if (tags.image || tags.photo) score += 150;
  if (tags.website || tags['contact:website']) score += 80;
  if (tags.description || tags['description:ca'] || tags['description:es']) score += 70;
  if (tags.opening_hours) score += 50;
  if (tags['contact:phone'] || tags.phone) score += 30;
  if (tags.wheelchair === 'yes') score += 20;

  // 3. PES PER TIPUS (Jerarquia històrica/turística)
  if (tags.historic === 'castle' || tags.historic === 'fortress') score += 100;
  if (tags.historic === 'archaeological_site') score += 150;
  if (tags.historic === 'cathedral' || tags.historic === 'abbey') score += 120;
  if (tags.tourism === 'museum') score += 100;
  
  // 4. RESTAURANTS - només els de qualitat
  if (tags.amenity === 'restaurant') {
    score += 10;
    if (tags.cuisine) score += 20;
    if (tags.stars) {
      const stars = parseInt(tags.stars, 10);
      if (!isNaN(stars)) score += stars * 80;
    }
    if (tags.Michelin === 'yes' || tags.guide_michelin) score += 600;
    if (tags.wikipedia || tags.wikidata) score += 50;
  }
  
  // 5. ESPECIALS (Ajuntaments sempre han de mostrar - alt score)
  if (tags.amenity === 'townhall') score += 400;
  if (tags.natural === 'spring') score += 250;
  if (tags.tourism === 'alpine_hut') score += 400;

  // 6. POBLACIÓ (Per mantenir ciutats com a referència)
  if (tags.population) {
    const pop = parseInt(tags.population, 10);
    if (!isNaN(pop)) {
      if (pop > 1000000) score += 400;
      else if (pop > 100000) score += 250;
      else if (pop > 10000) score += 100;
      else if (pop > 1000) score += 40;
    }
  }

  // 7. NOVES CATEGORIES
  // Pavellons i poliesportius
  if (tags.leisure === 'sports_centre' || tags.amenity === 'sports_centre') {
    score += 100;
    if (tags.opening_hours) score += 30;
  }
  if (tags.leisure === 'swimming_pool' || tags.amenity === 'swimming_pool') {
    score += 80;
    if (tags.opening_hours) score += 30;
  }
  
  // Cementiris
  if (tags.landuse === 'cemetery' || tags.amenity === 'cemetery') {
    score += 150;
    if (tags.wikipedia || tags.wikidata) score += 200;
  }
  
  // Autocarvans - diferenciem AMB vs SENSE serveis
  if (tags.tourism === 'caravansite') {
    score += 250;
    if (tags.sanitary_dump_station === 'yes') score += 80;
    if (tags.water === 'yes') score += 50;
    if (tags.electricity === 'yes') score += 50;
  }
  if (tags.tourism === 'camp_site') {
    score += 250;
    if (tags.sanitary_dump_station === 'yes') score += 80;
    if (tags.water === 'yes') score += 50;
    if (tags.electricity === 'yes') score += 50;
  }
  if (tags.tourism === 'camping') {
    score += 80;
    if (tags.sanitary_dump_station === 'yes') score += 30;
    if (tags.water === 'yes') score += 20;
    if (tags.electricity === 'yes') score += 20;
  }
  
  // Parkings - només els grans i gratuïts
  if (tags.amenity === 'parking' || tags.leisure === 'parking') {
    const capacity = parseInt(tags.capacity || '0', 10);
    score += 20;
    if (capacity >= 50) score += 100;
    if (capacity >= 100) score += 50;
    if (tags.fee === 'no' || !tags.fee) score += 30;
  }
  
  // Esglésies - sempre mostrar la principal
  if (tags.amenity === 'place_of_worship' || tags.building === 'church' || tags.building === 'cathedral') {
    score += 350;
    if (tags.historic === 'cathedral' || tags.historic === 'abbey') score += 150;
    if (tags.wikipedia || tags.wikidata) score += 100;
  }
  
  // Autocaravanes sense serveis
  if (tags.leisure === 'pitch' && tags.sport === 'caravan') {
    score += 150;
  }
  
  // Gorgs i salts d'aigua
  if (tags.natural === 'waterfall' || tags.water === 'waterfall') {
    score += 300;
    if (tags.wikipedia || tags.wikidata) score += 200;
  }
  if (tags.natural === 'gorge' || tags.natural === 'rapids') {
    score += 200;
  }

  return { 
    importance: score, 
    isBest: score >= 650
  };
}

function boundsToCacheKey(bounds: Bounds): string {
  return `${bounds.south.toFixed(2)},${bounds.west.toFixed(2)},${bounds.north.toFixed(2)},${bounds.east.toFixed(2)}`;
}

export async function loadPOIsFromOverpass(bounds: Bounds): Promise<POI[]> {
  const cacheKey = boundsToCacheKey(bounds);
  const cached = boundsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.pois;

  const { south, west, north, east } = bounds;
  const s = south.toFixed(4);
  const w = west.toFixed(4);
  const n = north.toFixed(4);
  const e = east.toFixed(4);

  const query = `[out:json][timeout:25];(nwr["unesco"="yes"](${s},${w},${n},${e});nwr["heritage"](${s},${w},${n},${e});nwr["historic"~"archaeological_site|city_wall|castle|monastery|cathedral"](${s},${w},${n},${e});node["amenity"="place_of_worship"](${s},${w},${n},${e});node["building"~"church|cathedral"](${s},${w},${n},${e});nwr["tourism"="alpine_hut"](${s},${w},${n},${e});node["natural"="spring"](${s},${w},${n},${e});nwr["amenity"="townhall"](${s},${w},${n},${e});node["tourism"~"museum|viewpoint|attraction"](${s},${w},${n},${e});node["place"~"city|town|village"](${s},${w},${n},${e});node["natural"~"peak|volcano|beach"](${s},${w},${n},${e});node["amenity"~"restaurant|cafe"](${s},${w},${n},${e});nwr["leisure"~"sports_centre|swimming_pool"](${s},${w},${n},${e});nwr["amenity"~"sports_centre|swimming_pool"](${s},${w},${n},${e});nwr["landuse"="cemetery"](${s},${w},${n},${e});nwr["amenity"="cemetery"](${s},${w},${n},${e});nwr["tourism"~"caravansite|camping|camp_site"](${s},${w},${n},${e});nwr["leisure"="pitch"]["tourism"="camping"](${s},${w},${n},${e});nwr["amenity"="parking"]["caravan"="yes"](${s},${w},${n},${e});nwr["amenity"="parking"]["name"~"caravan|autocaravan|autohome|motorhome"](${s},${w},${n},${e});nwr["leisure"="parking"]["caravan"="yes"](${s},${w},${n},${e});nwr["amenity"="parking"]["fee"!="yes"](${s},${w},${n},${e});nwr["leisure"="parking"]["fee"!="yes"](${s},${w},${n},${e});node["natural"~"waterfall|rapids|gorge"](${s},${w},${n},${e});node["water"="waterfall"](${s},${w},${n},${e});node["waterway"~"waterfall|rapids"](${s},${w},${n},${e}););out center;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response.status === 429) {
        console.warn(`Server ${endpoint} rate limited (429), waiting 1s before next mirror...`);
        await new Promise(res => setTimeout(res, 1000));
        continue;
      }
      if (!response.ok) continue;

      const data = await response.json();
      const pois: POI[] = [];

      for (const el of data.elements || []) {
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (!lat || !lon || !el.tags) continue;
        
        const category = getCategory(el.tags);
        if (!category) continue;
        
        const { importance, isBest } = calculateImportance(el.tags);
        pois.push({
          id: String(el.id),
          lat,
          lng: lon,
          name: el.tags['name:ca'] || el.tags.name || el.tags['name:es'] || el.tags['name:en'] || `${category} ${el.id}`,
          category,
          tags: el.tags,
          rating: el.tags.stars ? parseInt(el.tags.stars, 10) : undefined,
          importance,
          isBest,
          population: el.tags.population || undefined,
          address: el.tags['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}` : undefined,
          imageUrl: el.tags.image || el.tags.photo || undefined,
          website: el.tags.website || el.tags['contact:website'] || undefined,
          description: el.tags['description:ca'] || el.tags.description || el.tags['description:es'] || undefined,
        });
      }

      boundsCache.set(cacheKey, { bounds, pois, timestamp: Date.now() });
      return pois;
    } catch (error) {
      console.error(`Error with ${endpoint}:`, error);
      continue;
    }
  }

  return cached?.pois || [];
}

export function detectCountry(lat: number, lng: number): string { return 'global'; }
export function getPOIsInBounds(bounds: Bounds, categories: POICategory[], pois: POI[]): POI[] { return pois; }
export function getLoadedPOICount(): number { return boundsCache.size; }
export function clearCache(): void { boundsCache.clear(); }
