import { POI, POICategory } from './types';
import { RegionConfig } from './regionsConfig';
import { addDownload, isRegionDownloaded } from './downloadRegistry';
import { savePOIs } from './poiManager';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function getCategory(tags: Record<string, string>): POICategory | null {
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
  if (tags.amenity === 'place_of_worship' || tags.building === 'church' || tags.building === 'cathedral') return 'church';
  if (tags.historic === 'church' || tags.historic === 'cathedral' || tags.historic === 'chapel' || tags.historic === 'abbey') return 'church';
  if (tags.leisure === 'sports_centre' || tags.amenity === 'sports_centre') {
    const name = tags.name?.toLowerCase() || '';
    const isMunicipal = name.includes('municipal') || name.includes('pavelló') || name.includes('pavello') || name.includes('poliesportiu') || name.includes('polideportivo') || name.includes('centre esportiu') || name.includes('centro deportivo');
    if (isMunicipal || name.includes('esportiu') || name.includes('deportivo')) return 'sports_centre';
  }
  if ((tags.leisure === 'swimming_pool' || tags.amenity === 'swimming_pool') && (tags.name?.toLowerCase().includes('municipal') || tags.name?.toLowerCase().includes('piscina'))) return 'sports_centre';
  if (tags.landuse === 'cemetery' || tags.amenity === 'cemetery') return 'cemetery';
  const nameL = (tags.name || '').toLowerCase();
  const descL = (tags.description || '').toLowerCase();
  if (tags.tourism === 'camping') return 'caravan_park';
  if (tags.amenity === 'parking' && tags.caravan === 'yes') return 'caravan_park';
  if (tags.leisure === 'parking' && tags.caravan === 'yes') return 'caravan_park';
  if (tags.leisure === 'pitch' && (tags.sport === 'caravan' || tags.tourism === 'camping')) return 'caravan_park';
  if (nameL.includes('caravan') || nameL.includes('autocaravan') || nameL.includes('autohome') || nameL.includes('motorhome')) return 'caravan_park';
  if (descL.includes('caravan') || descL.includes('autocaravan') || descL.includes('autohome') || descL.includes('motorhome')) return 'caravan_park';
  if (tags.tourism === 'caravansite') return 'caravansite';
  if (tags.tourism === 'camp_site') return 'caravansite';
  if (tags.amenity === 'parking' || tags.leisure === 'parking') {
    const isFree = tags.fee === 'no' || tags.fee === undefined || !tags.fee;
    if (isFree) return 'parking';
  }
  if (tags.leisure === 'parking' && tags.fee === 'no') return 'parking';
  if (tags.natural === 'waterfall' || tags.water === 'waterfall' || tags.natural === 'rapids' || tags.natural === 'gorge') return 'waterfall';
  if (tags.waterway === 'waterfall' || tags.waterway === 'rapids') return 'waterfall';
  if (tags.tourism) return 'tourist';
  if (tags.historic) return 'monument';
  return null;
}

function calculateImportance(tags: Record<string, string>): { importance: number, isBest: boolean } {
  let score = 0;
  if (tags.unesco === 'yes' || tags['heritage:operator'] === 'unesco' || tags.heritage === 'unesco') score += 600;
  if (tags.heritage === '1') score += 400;
  if (tags.heritage === '2' || tags.heritage === 'yes') score += 200;
  if (tags.wikipedia) score += 400;
  if (tags.wikidata) score += 200;
  if (tags.image || tags.photo) score += 150;
  if (tags.website || tags['contact:website']) score += 80;
  if (tags.description || tags['description:ca'] || tags['description:es']) score += 70;
  if (tags.opening_hours) score += 50;
  if (tags['contact:phone'] || tags.phone) score += 30;
  if (tags.wheelchair === 'yes') score += 20;
  if (tags.historic === 'castle' || tags.historic === 'fortress') score += 100;
  if (tags.historic === 'archaeological_site') score += 150;
  if (tags.historic === 'cathedral' || tags.historic === 'abbey') score += 120;
  if (tags.tourism === 'museum') score += 100;
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
  if (tags.amenity === 'townhall') score += 400;
  if (tags.natural === 'spring') score += 250;
  if (tags.tourism === 'alpine_hut') score += 400;
  if (tags.population) {
    const pop = parseInt(tags.population, 10);
    if (!isNaN(pop)) {
      if (pop > 1000000) score += 400;
      else if (pop > 100000) score += 250;
      else if (pop > 10000) score += 100;
      else if (pop > 1000) score += 40;
    }
  }
  if (tags.leisure === 'sports_centre' || tags.amenity === 'sports_centre') {
    score += 100;
    if (tags.opening_hours) score += 30;
  }
  if (tags.leisure === 'swimming_pool' || tags.amenity === 'swimming_pool') {
    score += 80;
    if (tags.opening_hours) score += 30;
  }
  if (tags.landuse === 'cemetery' || tags.amenity === 'cemetery') {
    score += 150;
    if (tags.wikipedia || tags.wikidata) score += 200;
  }
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
  if (tags.amenity === 'parking' || tags.leisure === 'parking') {
    const capacity = parseInt(tags.capacity || '0', 10);
    score += 20;
    if (capacity >= 50) score += 100;
    if (capacity >= 100) score += 50;
    if (tags.fee === 'no' || !tags.fee) score += 30;
  }
  if (tags.amenity === 'place_of_worship' || tags.building === 'church' || tags.building === 'cathedral') {
    score += 350;
    if (tags.historic === 'cathedral' || tags.historic === 'abbey') score += 150;
    if (tags.wikipedia || tags.wikidata) score += 100;
  }
  if (tags.leisure === 'pitch' && tags.sport === 'caravan') score += 150;
  if (tags.natural === 'waterfall' || tags.water === 'waterfall') {
    score += 300;
    if (tags.wikipedia || tags.wikidata) score += 200;
  }
  if (tags.natural === 'gorge' || tags.natural === 'rapids') score += 200;
  return { importance: score, isBest: score >= 650 };
}

function parseOverpassElements(data: any): POI[] {
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
      phone: el.tags.phone || el.tags['contact:phone'] || undefined,
      openingHours: el.tags.opening_hours || undefined,
      wikipedia: el.tags.wikipedia || undefined,
      wheelchair: el.tags.wheelchair || undefined,
      fee: el.tags.fee || undefined,
    });
  }

  return pois;
}

function buildOverpassQuery(bounds: { south: number; west: number; north: number; east: number }): string {
  const { south, west, north, east } = bounds;
  const s = south.toFixed(4);
  const w = west.toFixed(4);
  const n = north.toFixed(4);
  const e = east.toFixed(4);

  return `[out:json][timeout:120];(
    nwr["unesco"="yes"](${s},${w},${n},${e});
    nwr["heritage"](${s},${w},${n},${e});
    nwr["historic"~"archaeological_site|city_wall|castle|monastery|cathedral|monument|memorial|ruins|fortress"](${s},${w},${n},${e});
    node["amenity"="place_of_worship"](${s},${w},${n},${e});
    node["building"~"church|cathedral"](${s},${w},${n},${e});
    nwr["tourism"="alpine_hut"](${s},${w},${n},${e});
    node["natural"="spring"](${s},${w},${n},${e});
    nwr["amenity"="townhall"](${s},${w},${n},${e});
    nwr["tourism"~"museum|viewpoint|attraction"](${s},${w},${n},${e});
    node["place"~"city|town|village"](${s},${w},${n},${e});
    node["natural"~"peak|volcano|beach"](${s},${w},${n},${e});
    nwr["amenity"~"restaurant|cafe|bar"](${s},${w},${n},${e});
    nwr["leisure"~"sports_centre|swimming_pool"](${s},${w},${n},${e});
    nwr["amenity"~"sports_centre|swimming_pool"](${s},${w},${n},${e});
    nwr["landuse"="cemetery"](${s},${w},${n},${e});
    nwr["amenity"="cemetery"](${s},${w},${n},${e});
    nwr["tourism"~"caravansite|camping|camp_site"](${s},${w},${n},${e});
    nwr["leisure"="pitch"]["tourism"="camping"](${s},${w},${n},${e});
    nwr["amenity"="parking"]["caravan"="yes"](${s},${w},${n},${e});
    nwr["leisure"="parking"]["caravan"="yes"](${s},${w},${n},${e});
    nwr["amenity"="parking"]["fee"!="yes"](${s},${w},${n},${e});
    nwr["leisure"="parking"]["fee"!="yes"](${s},${w},${n},${e});
    node["natural"~"waterfall|rapids|gorge"](${s},${w},${n},${e});
    node["water"="waterfall"](${s},${w},${n},${e});
    node["waterway"~"waterfall|rapids"](${s},${w},${n},${e});
    node["natural"~"lake|water"](${s},${w},${n},${e});
    nwr["natural"="water"](${s},${w},${n},${e});
    nwr["tourism"="artwork"](${s},${w},${n},${e});
    nwr["historic"="archaeological_site"](${s},${w},${n},${e});
  );out center;`;
}

export interface DownloadProgress {
  status: 'downloading' | 'processing' | 'saving' | 'complete' | 'error';
  message: string;
  progress: number;
  poiCount?: number;
}

export async function downloadRegionPOIs(
  region: RegionConfig,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{ success: boolean; poiCount: number; pois: POI[] }> {
  if (isRegionDownloaded(region.id)) {
    return { success: false, poiCount: 0 };
  }

  const query = buildOverpassQuery(region.bounds);

  onProgress?.({ status: 'downloading', message: `Descargando datos de ${region.name}...`, progress: 20 });

  let responseData: any = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response.status === 429) {
        await new Promise(res => setTimeout(res, 2000));
        continue;
      }
      if (!response.ok) continue;

      responseData = await response.json();
      break;
    } catch {
      continue;
    }
  }

  if (!responseData) {
    onProgress?.({ status: 'error', message: `Error descargando ${region.name}. Servidores no disponibles.`, progress: 0 });
    return { success: false, poiCount: 0 };
  }

  onProgress?.({ status: 'processing', message: 'Procesando puntos de interés...', progress: 60 });

  const pois = parseOverpassElements(responseData);

  onProgress?.({ status: 'saving', message: `Guardando ${pois.length} POIs...`, progress: 80, poiCount: pois.length });

  console.log(`[Download] Antes de savePOIs: ${pois.length} POIs para región ${region.id}`);
  await savePOIs(pois, region.id);
  console.log(`[Download] Después de savePOIs: completado`);

  addDownload({
    regionId: region.id,
    regionName: region.name,
    category: 'all',
    poiCount: pois.length,
    bounds: region.bounds,
  });

  onProgress?.({ status: 'complete', message: `${pois.length} POIs descargados para ${region.name}`, progress: 100, poiCount: pois.length });

  return { success: true, poiCount: pois.length, pois };
}

export async function downloadMultipleRegions(
  regions: RegionConfig[],
  onProgress?: (regionId: string, progress: DownloadProgress) => void
): Promise<{ success: number; failed: number; totalPOIs: number }> {
  let success = 0;
  let failed = 0;
  let totalPOIs = 0;

  for (const region of regions) {
    const result = await downloadRegionPOIs(region, (p) => {
      onProgress?.(region.id, p);
    });

    if (result.success) {
      success++;
      totalPOIs += result.poiCount;
    } else {
      failed++;
    }
  }

  return { success, failed, totalPOIs };
}
