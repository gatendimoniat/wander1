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
  | 'tourist'
  | 'heritage'
  | 'city'
  | 'shelter'
  | 'townhall'
  | 'sports_centre'
  | 'parking'
  | 'cemetery'
  | 'caravansite'
  | 'caravan_park'
  | 'waterfall'
  | 'cc_as'
  | 'cc_asn'
  | 'cc_aa'
  | 'cc_ac'
  | 'cc_acf'
  | 'cc_acs'
  | 'cc_apcc'
  | 'cc_apn';

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
  tourist: { label: 'Sitios de Interés', icon: 'Camera', color: '#00BCD4', emoji: '⭐' },
  heritage: { label: 'Patrimonio de la Humanidad', icon: 'ScrollText', color: '#B45309', emoji: '📜' },
  city: { label: 'Pobles i Ciutats', icon: 'Building2', color: '#3F51B5', emoji: '🏘️' },
  shelter: { label: 'Refugis', icon: 'Home', color: '#2E7D32', emoji: '🏡' },
  townhall: { label: 'Ajuntaments', icon: 'Building', color: '#607D8B', emoji: '🏛️' },
  sports_centre: { label: 'Pavellons i Poliesportius', icon: 'Activity', color: '#EC4899', emoji: '🏟️' },
  parking: { label: 'Parkings Gratuïts', icon: 'Parking', color: '#10B981', emoji: '🅿️' },
  cemetery: { label: 'Cementiris', icon: 'Cross', color: '#6B7280', emoji: '🪦' },
  caravansite: { label: 'Àrees d\'autocaravanes', icon: 'Car', color: '#F59E0B', emoji: '🚐' },
  caravan_park: { label: 'Càmpings', icon: 'Car', color: '#84CC16', emoji: '🏕️' },
  waterfall: { label: 'Gorgs i salts d\'aigua', icon: 'Droplets', color: '#06B6D4', emoji: '💧' },
  cc_as: { label: 'Aire de service', icon: 'Car', color: '#E53935', emoji: '🔧' },
  cc_asn: { label: 'Aire service + nuit', icon: 'Car', color: '#FF9800', emoji: '🛏️' },
  cc_aa: { label: 'Aire autoroute', icon: 'Car', color: '#2196F3', emoji: '🛣️' },
  cc_ac: { label: 'Camping CC', icon: 'Home', color: '#4CAF50', emoji: '⛺' },
  cc_acf: { label: 'Camping ferme', icon: 'Home', color: '#8BC34A', emoji: '🏡' },
  cc_acs: { label: 'Aire sur camping', icon: 'Car', color: '#009688', emoji: '🏕️' },
  cc_apcc: { label: 'Parking CC', icon: 'Parking', color: '#3F51B5', emoji: '🅿️' },
  cc_apn: { label: 'Parking nuit', icon: 'Moon', color: '#673AB7', emoji: '🌙' },
};
