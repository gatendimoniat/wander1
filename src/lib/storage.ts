import { SavedRoute, RecordedTrack } from './types';

const ROUTES_KEY = 'explorer-routes';
const TRACKS_KEY = 'explorer-tracks';

export function getSavedRoutes(): SavedRoute[] {
  try {
    const data = localStorage.getItem(ROUTES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    console.warn('Failed to parse saved routes, resetting');
    localStorage.removeItem(ROUTES_KEY);
    return [];
  }
}

export function saveRoute(route: SavedRoute) {
  const routes = getSavedRoutes();
  routes.push(route);
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

export function deleteRoute(id: string) {
  const routes = getSavedRoutes().filter((r) => r.id !== id);
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

export function getSavedTracks(): RecordedTrack[] {
  try {
    const data = localStorage.getItem(TRACKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    console.warn('Failed to parse saved tracks, resetting');
    localStorage.removeItem(TRACKS_KEY);
    return [];
  }
}

export function saveTrack(track: RecordedTrack) {
  const tracks = getSavedTracks();
  tracks.push(track);
  localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));
}

export function deleteTrack(id: string) {
  const tracks = getSavedTracks().filter((t) => t.id !== id);
  localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));
}
