import { SavedRoute, RecordedTrack } from './types';

const ROUTES_KEY = 'explorer-routes';
const TRACKS_KEY = 'explorer-tracks';

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
