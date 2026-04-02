import { POI, POICategory, SavedRoute, RecordedTrack } from './types';
import { loadCountryPOIs, detectCountry, getPOIsInBounds as filterPOIsInBounds } from './regionLoader';

let POI_DATABASE: POI[] = [];
let isLoaded = false;
let currentCountry: string | null = null;

export async function loadPOIDatabase(country?: string): Promise<void> {
  if (isLoaded && (country === undefined || country === currentCountry)) return;
  
  const targetCountry = country || 'spain';
  
  try {
    const pois = await loadCountryPOIs(targetCountry);
    POI_DATABASE = pois;
    currentCountry = targetCountry;
    isLoaded = true;
  } catch (error) {
    console.error('Error loading POI database:', error);
  }
}

export async function loadPOIsByLocation(lat: number, lng: number): Promise<void> {
  const country = detectCountry(lat, lng) || 'spain';
  await loadPOIDatabase(country);
}

export function getPOIDatabase(): POI[] {
  return POI_DATABASE;
}

export function getPOIsInBounds(
  bounds: { south: number; west: number; north: number; east: number },
  categories: POICategory[],
  pois?: POI[]
): POI[] {
  const database = pois || POI_DATABASE;
  return filterPOIsInBounds(bounds, categories, database);
}

export const MOCK_SAVED_ROUTES: SavedRoute[] = [
  {
    id: 'route-1',
    name: 'Ruta Modernista Barcelona',
    points: [
      { id: 'sagrada', name: 'Sagrada Família', category: 'church' as POICategory, lat: 41.4036, lng: 2.1744 },
      { id: 'casa-batllo', name: 'Casa Batlló', category: 'monument' as POICategory, lat: 41.3917, lng: 2.1650 },
      { id: 'park-guell', name: 'Park Güell', category: 'tourist' as POICategory, lat: 41.4145, lng: 2.1527 },
      { id: 'casa-mila', name: 'Casa Milà (La Pedrera)', category: 'monument' as POICategory, lat: 41.3954, lng: 2.1619 },
    ],
    createdAt: '2026-03-15T10:00:00.000Z',
  },
  {
    id: 'route-2',
    name: 'Ruta Gótica Barcelona',
    points: [
      { id: 'catedral', name: 'Catedral de Barcelona', category: 'church' as POICategory, lat: 41.3841, lng: 2.1766 },
      { id: 'picasso', name: 'Museu Picasso', category: 'museum' as POICategory, lat: 41.3853, lng: 2.1808 },
      { id: 'born', name: 'Barri del Born', category: 'tourist' as POICategory, lat: 41.3857, lng: 2.1832 },
      { id: 'placa-san-jaume', name: 'Plaça Sant Jaume', category: 'tourist' as POICategory, lat: 41.3825, lng: 2.1775 },
    ],
    createdAt: '2026-03-20T14:00:00.000Z',
  },
];

export const MOCK_SAVED_TRACKS: RecordedTrack[] = [
  {
    id: 'track-1',
    name: 'Ruta Montserrat - Sant Jeroni',
    positions: [
      { lat: 41.5931, lng: 1.8377, altitude: 735, timestamp: 1709308800000 },
      { lat: 41.5935, lng: 1.8382, altitude: 740, timestamp: 1709308860000 },
      { lat: 41.5940, lng: 1.8388, altitude: 748, timestamp: 1709308920000 },
      { lat: 41.5945, lng: 1.8395, altitude: 760, timestamp: 1709308980000 },
      { lat: 41.5950, lng: 1.8402, altitude: 775, timestamp: 1709309040000 },
      { lat: 41.5955, lng: 1.8408, altitude: 790, timestamp: 1709309100000 },
      { lat: 41.5960, lng: 1.8415, altitude: 810, timestamp: 1709309160000 },
      { lat: 41.5965, lng: 1.8422, altitude: 830, timestamp: 1709309220000 },
      { lat: 41.5970, lng: 1.8428, altitude: 850, timestamp: 1709309280000 },
      { lat: 41.5975, lng: 1.8435, altitude: 875, timestamp: 1709309340000 },
      { lat: 41.5980, lng: 1.8440, altitude: 900, timestamp: 1709309400000 },
      { lat: 41.5985, lng: 1.8445, altitude: 930, timestamp: 1709309460000 },
      { lat: 41.5990, lng: 1.8450, altitude: 960, timestamp: 1709309520000 },
      { lat: 41.5995, lng: 1.8455, altitude: 990, timestamp: 1709309580000 },
      { lat: 41.6000, lng: 1.8460, altitude: 1020, timestamp: 1709309640000 },
      { lat: 41.6005, lng: 1.8465, altitude: 1050, timestamp: 1709309700000 },
      { lat: 41.6010, lng: 1.8470, altitude: 1080, timestamp: 1709309760000 },
      { lat: 41.6015, lng: 1.8475, altitude: 1110, timestamp: 1709309820000 },
      { lat: 41.6020, lng: 1.8480, altitude: 1140, timestamp: 1709309880000 },
      { lat: 41.6025, lng: 1.8485, altitude: 1170, timestamp: 1709309940000 },
      { lat: 41.6030, lng: 1.8490, altitude: 1190, timestamp: 1709310000000 },
      { lat: 41.6035, lng: 1.8495, altitude: 1198, timestamp: 1709310060000 },
      { lat: 41.6039, lng: 1.8518, altitude: 1204, timestamp: 1709310120000 },
    ],
    distance: 5.8,
    elevationGain: 470,
    elevationLoss: 0,
    maxAltitude: 1204,
    minAltitude: 735,
    difficulty: 'moderate',
    createdAt: '2026-03-10T08:00:00.000Z',
  },
  {
    id: 'track-2',
    name: "Volta a l'Estany de Banyoles",
    positions: [
      { lat: 42.1164, lng: 2.7538, altitude: 175, timestamp: 1709395200000 },
      { lat: 42.1168, lng: 2.7545, altitude: 175, timestamp: 1709395280000 },
      { lat: 42.1172, lng: 2.7552, altitude: 176, timestamp: 1709395360000 },
      { lat: 42.1176, lng: 2.7559, altitude: 176, timestamp: 1709395440000 },
      { lat: 42.1180, lng: 2.7566, altitude: 177, timestamp: 1709395520000 },
      { lat: 42.1184, lng: 2.7573, altitude: 177, timestamp: 1709395600000 },
      { lat: 42.1188, lng: 2.7580, altitude: 176, timestamp: 1709395680000 },
      { lat: 42.1192, lng: 2.7588, altitude: 176, timestamp: 1709395760000 },
      { lat: 42.1196, lng: 2.7595, altitude: 175, timestamp: 1709395840000 },
      { lat: 42.1200, lng: 2.7602, altitude: 175, timestamp: 1709395920000 },
      { lat: 42.1204, lng: 2.7609, altitude: 174, timestamp: 1709396000000 },
      { lat: 42.1208, lng: 2.7616, altitude: 174, timestamp: 1709396080000 },
      { lat: 42.1212, lng: 2.7623, altitude: 175, timestamp: 1709396160000 },
      { lat: 42.1216, lng: 2.7630, altitude: 175, timestamp: 1709396240000 },
      { lat: 42.1220, lng: 2.7637, altitude: 176, timestamp: 1709396320000 },
      { lat: 42.1224, lng: 2.7644, altitude: 176, timestamp: 1709396400000 },
      { lat: 42.1228, lng: 2.7651, altitude: 177, timestamp: 1709396480000 },
      { lat: 42.1232, lng: 2.7658, altitude: 177, timestamp: 1709396560000 },
      { lat: 42.1236, lng: 2.7665, altitude: 176, timestamp: 1709396640000 },
      { lat: 42.1240, lng: 2.7655, altitude: 176, timestamp: 1709396720000 },
      { lat: 42.1244, lng: 2.7645, altitude: 175, timestamp: 1709396800000 },
      { lat: 42.1248, lng: 2.7635, altitude: 175, timestamp: 1709396880000 },
      { lat: 42.1252, lng: 2.7625, altitude: 176, timestamp: 1709396960000 },
      { lat: 42.1256, lng: 2.7615, altitude: 176, timestamp: 1709397040000 },
      { lat: 42.1260, lng: 2.7605, altitude: 175, timestamp: 1709397120000 },
      { lat: 42.1264, lng: 2.7595, altitude: 175, timestamp: 1709397200000 },
      { lat: 42.1260, lng: 2.7585, altitude: 174, timestamp: 1709397280000 },
      { lat: 42.1256, lng: 2.7575, altitude: 174, timestamp: 1709397360000 },
      { lat: 42.1252, lng: 2.7565, altitude: 175, timestamp: 1709397440000 },
      { lat: 42.1248, lng: 2.7555, altitude: 175, timestamp: 1709397520000 },
      { lat: 42.1244, lng: 2.7545, altitude: 176, timestamp: 1709397600000 },
      { lat: 42.1240, lng: 2.7535, altitude: 176, timestamp: 1709397680000 },
      { lat: 42.1236, lng: 2.7525, altitude: 175, timestamp: 1709397760000 },
      { lat: 42.1232, lng: 2.7520, altitude: 175, timestamp: 1709397840000 },
      { lat: 42.1228, lng: 2.7525, altitude: 174, timestamp: 1709397920000 },
      { lat: 42.1224, lng: 2.7530, altitude: 174, timestamp: 1709398000000 },
    ],
    distance: 5.8,
    elevationGain: 45,
    elevationLoss: 45,
    maxAltitude: 180,
    minAltitude: 170,
    difficulty: 'easy',
    createdAt: '2026-03-25T09:30:00.000Z',
  },
  {
    id: 'track-3',
    name: 'Camins del Montseny',
    positions: [
      { lat: 41.7733, lng: 2.3933, altitude: 650, timestamp: 1709481600000 },
      { lat: 41.7738, lng: 2.3940, altitude: 665, timestamp: 1709481680000 },
      { lat: 41.7743, lng: 2.3947, altitude: 680, timestamp: 1709481760000 },
      { lat: 41.7748, lng: 2.3954, altitude: 695, timestamp: 1709481840000 },
      { lat: 41.7753, lng: 2.3961, altitude: 710, timestamp: 1709481920000 },
      { lat: 41.7758, lng: 2.3968, altitude: 730, timestamp: 1709482000000 },
      { lat: 41.7763, lng: 2.3975, altitude: 750, timestamp: 1709482080000 },
      { lat: 41.7768, lng: 2.3982, altitude: 770, timestamp: 1709482160000 },
      { lat: 41.7773, lng: 2.3989, altitude: 790, timestamp: 1709482240000 },
      { lat: 41.7778, lng: 2.3996, altitude: 815, timestamp: 1709482320000 },
      { lat: 41.7783, lng: 2.4003, altitude: 840, timestamp: 1709482400000 },
      { lat: 41.7788, lng: 2.4010, altitude: 865, timestamp: 1709482480000 },
      { lat: 41.7793, lng: 2.4017, altitude: 890, timestamp: 1709482560000 },
      { lat: 41.7798, lng: 2.4024, altitude: 920, timestamp: 1709482640000 },
      { lat: 41.7803, lng: 2.4031, altitude: 950, timestamp: 1709482720000 },
      { lat: 41.7808, lng: 2.4038, altitude: 980, timestamp: 1709482800000 },
      { lat: 41.7813, lng: 2.4045, altitude: 1010, timestamp: 1709482880000 },
      { lat: 41.7818, lng: 2.4052, altitude: 1040, timestamp: 1709482960000 },
      { lat: 41.7823, lng: 2.4059, altitude: 1070, timestamp: 1709483040000 },
      { lat: 41.7828, lng: 2.4066, altitude: 1100, timestamp: 1709483120000 },
      { lat: 41.7833, lng: 2.4073, altitude: 1130, timestamp: 1709483200000 },
      { lat: 41.7838, lng: 2.4080, altitude: 1160, timestamp: 1709483280000 },
      { lat: 41.7843, lng: 2.4087, altitude: 1185, timestamp: 1709483360000 },
      { lat: 41.7848, lng: 2.4094, altitude: 1195, timestamp: 1709483440000 },
      { lat: 41.7853, lng: 2.4101, altitude: 1200, timestamp: 1709483520000 },
      { lat: 41.7858, lng: 2.4108, altitude: 1204, timestamp: 1709483600000 },
    ],
    distance: 8.2,
    elevationGain: 554,
    elevationLoss: 0,
    maxAltitude: 1204,
    minAltitude: 650,
    difficulty: 'moderate',
    createdAt: '2026-03-28T07:00:00.000Z',
  },
];
