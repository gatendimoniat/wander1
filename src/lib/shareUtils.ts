import { SavedRoute, RecordedTrack } from './types';

export function encodeRouteToShareable(route: SavedRoute): string {
  const data = {
    type: 'route',
    data: {
      name: route.name,
      points: route.points.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
      })),
    },
  };
  const json = JSON.stringify(data);
  return btoa(encodeURIComponent(json));
}

export function encodeTrackToShareable(track: RecordedTrack): string {
  const data = {
    type: 'track',
    data: {
      name: track.name,
      positions: track.positions,
      distance: track.distance,
      elevationGain: track.elevationGain,
      difficulty: track.difficulty,
    },
  };
  const json = JSON.stringify(data);
  return btoa(encodeURIComponent(json));
}

export function decodeFromShareable(encoded: string): { type: 'route'; data: SavedRoute } | { type: 'track'; data: RecordedTrack } | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const data = JSON.parse(json);
    
    if (data.type === 'route' && data.data.points) {
      return {
        type: 'route',
        data: {
          id: crypto.randomUUID(),
          name: data.data.name,
          points: data.data.points,
          createdAt: new Date().toISOString(),
        },
      };
    }
    
    if (data.type === 'track' && data.data.positions) {
      return {
        type: 'track',
        data: {
          id: crypto.randomUUID(),
          name: data.data.name,
          positions: data.data.positions,
          distance: data.data.distance || 0,
          elevationGain: data.data.elevationGain || 0,
          elevationLoss: data.data.elevationLoss || 0,
          maxAltitude: data.data.maxAltitude || 0,
          minAltitude: data.data.minAltitude || 0,
          difficulty: data.data.difficulty || 'easy',
          createdAt: new Date().toISOString(),
        },
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function getShareableUrl(encoded: string): string {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?share=${encoded}`;
}

export function getQRCodeUrl(text: string, size: number = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}
