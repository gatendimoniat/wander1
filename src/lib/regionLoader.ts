import { POI, POICategory, Bounds } from './types';

const countryCache: Map<string, POI[]> = new Map();
const loadedCountries: Set<string> = new Set();

const countryFiles: Record<string, string> = {
  spain: '/data/spain-pois.json',
  portugal: '/data/portugal-pois.json',
  france: '/data/france-pois.json',
};

export async function loadCountryPOIs(country: string): Promise<POI[]> {
  if (countryCache.has(country)) {
    return countryCache.get(country)!;
  }

  const filePath = countryFiles[country] || countryFiles.spain;
  
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error('Data not found');
    
    const data: POI[] = await response.json();
    countryCache.set(country, data);
    loadedCountries.add(country);
    return data;
  } catch {
    return [];
  }
}

export function detectCountry(lat: number, lng: number): string {
  if (lat >= 37.0 && lat <= 43.5 && lng >= -9.5 && lng <= 3.5) {
    if (lng >= -9.5 && lng < -6.0) return 'portugal';
    return 'spain';
  }
  if (lat >= 41.0 && lat <= 51.5 && lng >= -5.0 && lng <= 9.5) {
    return 'france';
  }
  return 'spain';
}

export function getPOIsInBounds(
  bounds: Bounds,
  categories: POICategory[],
  pois: POI[]
): POI[] {
  return pois.filter(
    p =>
      categories.includes(p.category) &&
      p.lat >= bounds.south &&
      p.lat <= bounds.north &&
      p.lng >= bounds.west &&
      p.lng <= bounds.east
  );
}

export function getLoadedPOICount(): number {
  let count = 0;
  countryCache.forEach(pois => {
    count += pois.length;
  });
  return count;
}

export function getLoadedCountries(): string[] {
  return Array.from(loadedCountries);
}

export function clearCache(): void {
  countryCache.clear();
  loadedCountries.clear();
}
