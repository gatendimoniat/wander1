import { SavedRoute, RecordedTrack, SavedFavorites } from './types';

const ROUTES_KEY = 'explorer-routes';
const TRACKS_KEY = 'explorer-tracks';
const FAVORITES_KEY = 'explorer-favorites';

export async function getSavedFavorites(): Promise<SavedFavorites[]> {
  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    console.warn('Failed to parse saved favorites, resetting');
    localStorage.removeItem(FAVORITES_KEY);
    return [];
  }
}

export async function saveFavorites(fav: SavedFavorites): Promise<void> {
  const favorites = await getSavedFavorites();
  const existing = favorites.findIndex(f => f.id === fav.id);
  if (existing >= 0) {
    favorites[existing] = fav;
  } else {
    favorites.push(fav);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export async function deleteFavorites(id: string): Promise<void> {
  const favorites = (await getSavedFavorites()).filter(f => f.id !== id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export async function getSavedRoutes(): Promise<SavedRoute[]> {
  try {
    const data = localStorage.getItem(ROUTES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    console.warn('Failed to parse saved routes, resetting');
    localStorage.removeItem(ROUTES_KEY);
    return [];
  }
}

export async function saveRoute(route: SavedRoute): Promise<void> {
  const routes = await getSavedRoutes();
  const existing = routes.findIndex(r => r.id === route.id);
  if (existing >= 0) {
    routes[existing] = route;
  } else {
    routes.push(route);
  }
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

export async function deleteRoute(id: string): Promise<void> {
  const routes = (await getSavedRoutes()).filter(r => r.id !== id);
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

export async function getSavedTracks(): Promise<RecordedTrack[]> {
  try {
    const data = localStorage.getItem(TRACKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    console.warn('Failed to parse saved tracks, resetting');
    localStorage.removeItem(TRACKS_KEY);
    return [];
  }
}

export async function saveTrack(track: RecordedTrack): Promise<void> {
  const tracks = await getSavedTracks();
  const existing = tracks.findIndex(t => t.id === track.id);
  if (existing >= 0) {
    tracks[existing] = track;
  } else {
    tracks.push(track);
  }
  localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));
}

export async function deleteTrack(id: string): Promise<void> {
  const tracks = (await getSavedTracks()).filter(t => t.id !== id);
  localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));
}
