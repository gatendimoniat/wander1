export interface POI {
  id: string;
  name: string;
  category: POICategory;
  lat: number;
  lng: number;
  rating?: number;
  tags?: Record<string, string>;
  address?: string;
}

export type POICategory =
  | 'museum'
  | 'castle'
  | 'cathedral'
  | 'restaurant'
  | 'lake'
  | 'peak'
  | 'viewpoint'
  | 'hiking'
  | 'bridge'
  | 'tourist';

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
  distance: number; // km
  elevationGain: number; // m
  elevationLoss: number; // m
  maxAltitude: number; // m
  minAltitude: number; // m
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
  cathedral: { label: 'Catedrales', icon: 'Church', color: '#D4A017', emoji: '⛪' },
  restaurant: { label: 'Restaurantes', icon: 'UtensilsCrossed', color: '#E53935', emoji: '🍽️' },
  lake: { label: 'Lagos', icon: 'Waves', color: '#1E88E5', emoji: '🏞️' },
  peak: { label: 'Picos', icon: 'Mountain', color: '#4CAF50', emoji: '⛰️' },
  viewpoint: { label: 'Miradores', icon: 'Eye', color: '#FF9800', emoji: '👁️' },
  hiking: { label: 'Senderismo', icon: 'Footprints', color: '#2E7D32', emoji: '🥾' },
  bridge: { label: 'Pasarelas', icon: 'BrickWall', color: '#795548', emoji: '🌉' },
  tourist: { label: 'Turístico', icon: 'Camera', color: '#00BCD4', emoji: '📸' },
};
