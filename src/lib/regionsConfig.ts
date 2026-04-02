export interface RegionConfig {
  id: string;
  country: string;
  name: string;
  bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
  neighbors?: string[];
}

export const SPAIN_REGIONS: RegionConfig[] = [
  {
    id: 'spain-catalonia',
    country: 'spain',
    name: 'Catalunya',
    bounds: { south: 40.5, west: 0.5, north: 42.9, east: 3.5 },
    neighbors: ['spain-aragon', 'spain-valencia']
  },
  {
    id: 'spain-madrid',
    country: 'spain',
    name: 'Comunidad de Madrid',
    bounds: { south: 39.9, west: -4.5, north: 41.2, east: -3.2 },
    neighbors: ['spain-castilla', 'spain-extremadura']
  },
  {
    id: 'spain-andalusia',
    country: 'spain',
    name: 'Andalucía',
    bounds: { south: 36.0, west: -7.5, north: 38.7, east: -1.6 },
    neighbors: ['spain-extremadura']
  },
  {
    id: 'spain-valencia',
    country: 'spain',
    name: 'Comunitat Valenciana',
    bounds: { south: 38.5, west: -1.5, north: 40.8, east: 0.5 },
    neighbors: ['spain-catalonia', 'spain-aragon', 'spain-castilla']
  },
  {
    id: 'spain-galicia',
    country: 'spain',
    name: 'Galicia',
    bounds: { south: 41.8, west: -9.3, north: 43.8, east: -6.7 },
    neighbors: ['spain-asturias']
  },
  {
    id: 'spain-basque',
    country: 'spain',
    name: 'País Vasco',
    bounds: { south: 42.8, west: -3.5, north: 43.4, east: -1.7 },
    neighbors: ['spain-navarra', 'spain-cantabria']
  },
  {
    id: 'spain-castilla',
    country: 'spain',
    name: 'Castilla y León',
    bounds: { south: 40.0, west: -7.0, north: 43.5, east: -2.0 },
    neighbors: ['spain-madrid', 'spain-extremadura', 'spain-galicia']
  },
  {
    id: 'spain-balearic',
    country: 'spain',
    name: 'Islas Baleares',
    bounds: { south: 38.5, west: 2.5, north: 40.1, east: 4.5 },
    neighbors: []
  },
  {
    id: 'spain-canary',
    country: 'spain',
    name: 'Islas Canarias',
    bounds: { south: 27.5, west: -18.5, north: 29.5, east: -13.0 },
    neighbors: []
  },
  {
    id: 'spain-aragon',
    country: 'spain',
    name: 'Aragón',
    bounds: { south: 40.0, west: -2.0, north: 42.9, east: 0.8 },
    neighbors: ['spain-catalonia', 'spain-valencia', 'spain-castilla']
  },
  {
    id: 'spain-extremadura',
    country: 'spain',
    name: 'Extremadura',
    bounds: { south: 37.8, west: -7.5, north: 40.5, east: -4.8 },
    neighbors: ['spain-madrid', 'spain-andalusia', 'spain-castilla']
  },
  {
    id: 'spain-asturias',
    country: 'spain',
    name: 'Asturias',
    bounds: { south: 42.8, west: -7.2, north: 43.6, east: -4.3 },
    neighbors: ['spain-galicia', 'spain-cantabria', 'spain-castilla']
  },
  {
    id: 'spain-cantabria',
    country: 'spain',
    name: 'Cantabria',
    bounds: { south: 42.8, west: -4.8, north: 43.5, east: -3.0 },
    neighbors: ['spain-basque', 'spain-asturias', 'spain-castilla']
  },
  {
    id: 'spain-navarra',
    country: 'spain',
    name: 'Navarra',
    bounds: { south: 41.9, west: -2.5, north: 43.3, east: -0.7 },
    neighbors: ['spain-basque', 'spain-aragon']
  },
  {
    id: 'spain-murcia',
    country: 'spain',
    name: 'Murcia',
    bounds: { south: 37.4, west: -2.2, north: 38.5, east: -0.6 },
    neighbors: ['spain-valencia', 'spain-andalusia']
  },
  {
    id: 'spain-castilla-mancha',
    country: 'spain',
    name: 'Castilla-La Mancha',
    bounds: { south: 38.5, west: -5.0, north: 41.5, east: -0.5 },
    neighbors: ['spain-madrid', 'spain-valencia', 'spain-andalusia']
  }
];

export const PORTUGAL_REGIONS: RegionConfig[] = [
  {
    id: 'portugal-norte',
    country: 'portugal',
    name: 'Norte',
    bounds: { south: 41.0, west: -9.0, north: 42.0, east: -6.5 },
    neighbors: ['portugal-centro']
  },
  {
    id: 'portugal-centro',
    country: 'portugal',
    name: 'Centro',
    bounds: { south: 39.0, west: -9.5, north: 41.0, east: -6.5 },
    neighbors: ['portugal-norte', 'portugal-lisboa']
  },
  {
    id: 'portugal-lisboa',
    country: 'portugal',
    name: 'Lisboa',
    bounds: { south: 38.5, west: -9.5, north: 39.5, east: -8.5 },
    neighbors: ['portugal-centro', 'portugal-alentejo']
  },
  {
    id: 'portugal-alentejo',
    country: 'portugal',
    name: 'Alentejo',
    bounds: { south: 37.0, west: -9.0, north: 39.0, east: -6.5 },
    neighbors: ['portugal-lisboa', 'portugal-algarve']
  },
  {
    id: 'portugal-algarve',
    country: 'portugal',
    name: 'Algarve',
    bounds: { south: 36.9, west: -8.9, north: 37.5, east: -7.2 },
    neighbors: ['portugal-alentejo']
  },
  {
    id: 'portugal-madeira',
    country: 'portugal',
    name: 'Madeira',
    bounds: { south: 32.3, west: -17.3, north: 33.2, east: -16.2 },
    neighbors: []
  },
  {
    id: 'portugal-azores',
    country: 'portugal',
    name: 'Azores',
    bounds: { south: 36.9, west: -31.3, north: 39.7, east: -24.8 },
    neighbors: []
  }
];

export const FRANCE_REGIONS: RegionConfig[] = [
  {
    id: 'france-ile-de-france',
    country: 'france',
    name: 'Île-de-France',
    bounds: { south: 48.1, west: 1.4, north: 49.2, east: 3.6 },
    neighbors: ['france-hauts-de-france', 'france-normandie', 'france-centre']
  },
  {
    id: 'france-provence',
    country: 'france',
    name: 'Provence-Alpes-Côte d\'Azur',
    bounds: { south: 43.1, west: 4.2, north: 45.1, east: 7.3 },
    neighbors: ['france-auvergne', 'france-languedoc']
  },
  {
    id: 'france-bretagne',
    country: 'france',
    name: 'Bretagne',
    bounds: { south: 47.0, west: -5.1, north: 48.9, east: -1.0 },
    neighbors: ['france-pays-de-la-loire', 'france-normandie']
  },
  {
    id: 'france-aquitaine',
    country: 'france',
    name: 'Nouvelle-Aquitaine',
    bounds: { south: 42.3, west: -1.8, north: 46.6, east: 2.2 },
    neighbors: ['france-languedoc', 'france-auvergne', 'france-centre']
  },
  {
    id: 'france-languedoc',
    country: 'france',
    name: 'Occitanie',
    bounds: { south: 42.4, west: -0.1, north: 45.0, east: 4.8 },
    neighbors: ['france-aquitaine', 'france-provence', 'france-auvergne']
  },
  {
    id: 'france-auvergne',
    country: 'france',
    name: 'Auvergne-Rhône-Alpes',
    bounds: { south: 44.6, west: 2.0, north: 46.5, east: 7.2 },
    neighbors: ['france-languedoc', 'france-aquitaine', 'france-bourgogne']
  },
  {
    id: 'france-normandie',
    country: 'france',
    name: 'Normandie',
    bounds: { south: 48.2, west: -1.9, north: 50.1, east: 1.8 },
    neighbors: ['france-bretagne', 'france-hauts-de-france', 'france-ile-de-france']
  },
  {
    id: 'france-pays-de-la-loire',
    country: 'france',
    name: 'Pays de la Loire',
    bounds: { south: 46.3, west: -2.6, north: 48.6, east: 0.9 },
    neighbors: ['france-bretagne', 'france-normandie', 'france-centre']
  },
  {
    id: 'france-hauts-de-france',
    country: 'france',
    name: 'Hauts-de-France',
    bounds: { south: 48.8, west: 1.3, north: 51.1, east: 4.3 },
    neighbors: ['france-ile-de-france', 'france-normandie', 'france-grand-est']
  },
  {
    id: 'france-bourgogne',
    country: 'france',
    name: 'Bourgogne-Franche-Comté',
    bounds: { south: 45.8, west: 2.8, north: 48.2, east: 7.2 },
    neighbors: ['france-auvergne', 'france-centre', 'france-grand-est']
  },
  {
    id: 'france-centre',
    country: 'france',
    name: 'Centre-Val de Loire',
    bounds: { south: 46.3, west: 0.1, north: 48.6, east: 3.1 },
    neighbors: ['france-ile-de-france', 'france-bourgogne', 'france-aquitaine']
  },
  {
    id: 'france-grand-est',
    country: 'france',
    name: 'Grand Est',
    bounds: { south: 47.4, west: 3.0, north: 50.2, east: 8.2 },
    neighbors: ['france-hauts-de-france', 'france-bourgogne']
  }
];

export const ALL_REGIONS = [...SPAIN_REGIONS, ...PORTUGAL_REGIONS, ...FRANCE_REGIONS];

export function findRegionByBounds(bounds: { south: number; west: number; north: number; east: number }): RegionConfig | null {
  for (const region of ALL_REGIONS) {
    const overlap = calculateOverlap(bounds, region.bounds);
    if (overlap > 0.3) {
      return region;
    }
  }
  return null;
}

function calculateOverlap(a: { south: number; west: number; north: number; east: number }, 
                          b: { south: number; west: number; north: number; east: number }): number {
  const overlapLat = Math.min(a.north, b.north) - Math.max(a.south, b.south);
  const overlapLng = Math.min(a.east, b.east) - Math.max(a.west, b.west);
  
  if (overlapLat <= 0 || overlapLng <= 0) return 0;
  
  const areaOverlap = overlapLat * overlapLng;
  const areaA = (a.north - a.south) * (a.east - a.west);
  
  return areaOverlap / areaA;
}
