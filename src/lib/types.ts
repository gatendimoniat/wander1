export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  lat: number;
  lng: number;
  rating?: number;
  reviewCount?: number;
  tags?: Record<string, string>;
  address?: string;
  imageUrl?: string;
  description?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  wikipedia?: string;
  wheelchair?: string;
  fee?: string;
  isBest?: boolean;
  importance?: number;
  population?: string;
}

export type POICategory =
  | 'museum'
  | 'castle'
  | 'church'
  | 'monument'
  | 'restaurant'
  | 'lake'
  | 'peak'
  | 'viewpoint'
  | 'bridge'
  | 'tourist'
  | 'beach'
  | 'heritage'
  | 'city'
  | 'shelter'
  | 'fountain'
  | 'townhall';

export interface SavedRoute {
  id: string;
  name: string;
  points: POI[];
  createdAt: string;
}

export interface RecordedTrack {
  id: string;
  name: string;
  positions: TrackPoint[];
  distance: number;
  elevationGain: number;
  elevationLoss: number;
  maxAltitude: number;
  minAltitude: number;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  createdAt: string;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  altitude?: number;
  timestamp: number;
}

export const CATEGORY_CONFIG: Record<POICategory, { label: string; icon: string; color: string; emoji: string }> = {
  museum: { label: 'Museos', icon: 'Landmark', color: '#8B5CF6', emoji: '🏛️' },
  castle: { label: 'Castillos', icon: 'Castle', color: '#6D4C41', emoji: '🏰' },
  church: { label: 'Iglesias y Catedrales', icon: 'Church', color: '#D4A017', emoji: '⛪' },
  monument: { label: 'Monumentos', icon: 'Landmark', color: '#B45309', emoji: '🗿' },
  restaurant: { label: 'Restaurantes', icon: 'UtensilsCrossed', color: '#E53935', emoji: '🍽️' },
  lake: { label: 'Lagos', icon: 'Waves', color: '#1E88E5', emoji: '🏞️' },
  peak: { label: 'Cims', icon: 'Mountain', color: '#4CAF50', emoji: '⛰️' },
  viewpoint: { label: 'Miradors', icon: 'Eye', color: '#FF9800', emoji: '👁️' },
  bridge: { label: 'Ponts', icon: 'BrickWall', color: '#795548', emoji: '🌉' },
  tourist: { label: 'Sitios de Interés', icon: 'Camera', color: '#00BCD4', emoji: '⭐' },
  beach: { label: 'Playas', icon: 'Umbrella', color: '#00BCD4', emoji: '🏖️' },
  heritage: { label: 'Patrimonio de la Humanidad', icon: 'ScrollText', color: '#B45309', emoji: '📜' },
  city: { label: 'Pobles i Ciutats', icon: 'Building2', color: '#3F51B5', emoji: '🏘️' },
  shelter: { label: 'Refugis', icon: 'Home', color: '#2E7D32', emoji: '🏡' },
  fountain: { label: 'Fonts Naturals', icon: 'Droplets', color: '#03A9F4', emoji: '⛲' },
  townhall: { label: 'Ajuntaments', icon: 'Building', color: '#607D8B', emoji: '🏛️' },
};
