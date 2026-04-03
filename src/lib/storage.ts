import { SavedRoute, RecordedTrack } from './types';
import { supabase } from './supabase';

const ROUTES_KEY = 'explorer-routes';
const TRACKS_KEY = 'explorer-tracks';

export async function syncLocalStorageToSupabase(): Promise<{ synced: number; errors: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  // Sync routes
  try {
    const localRoutes = localStorage.getItem(ROUTES_KEY);
    if (localRoutes) {
      const routes = JSON.parse(localRoutes);
      for (const route of routes) {
        const { error } = await supabase
          .from('routes')
          .upsert({
            id: route.id,
            user_id: user.id,
            name: route.name,
            points: route.points,
            created_at: route.createdAt
          }, { onConflict: 'id' });
        if (error) errors++;
        else synced++;
      }
      localStorage.removeItem(ROUTES_KEY);
    }
  } catch {
    errors++;
  }

  // Sync tracks
  try {
    const localTracks = localStorage.getItem(TRACKS_KEY);
    if (localTracks) {
      const tracks = JSON.parse(localTracks);
      for (const track of tracks) {
        const { error } = await supabase
          .from('tracks')
          .upsert({
            id: track.id,
            user_id: user.id,
            name: track.name,
            positions: track.positions,
            distance: track.distance,
            elevation_gain: track.elevationGain,
            elevation_loss: track.elevationLoss,
            max_altitude: track.maxAltitude,
            min_altitude: track.minAltitude,
            difficulty: track.difficulty,
            created_at: track.createdAt
          }, { onConflict: 'id' });
        if (error) errors++;
        else synced++;
      }
      localStorage.removeItem(TRACKS_KEY);
    }
  } catch {
    errors++;
  }

  return { synced, errors };
}

export async function getSavedRoutes(): Promise<SavedRoute[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching routes from Supabase:', error);
      return [];
    }
    
    return data.map(r => ({
      id: r.id,
      name: r.name,
      points: r.points,
      createdAt: r.created_at
    }));
  }

  // Fallback to localStorage
  try {
    const data = localStorage.getItem(ROUTES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    console.warn('Failed to parse saved routes, resetting');
    localStorage.removeItem(ROUTES_KEY);
    return [];
  }
}

export async function saveRoute(route: SavedRoute) {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { error } = await supabase
      .from('routes')
      .upsert({
        id: route.id,
        user_id: user.id,
        name: route.name,
        points: route.points,
        created_at: route.createdAt
      }, { onConflict: 'id' });
    
    if (error) console.error('Error saving route to Supabase:', error);
    return;
  }

  const routes = await getSavedRoutes();
  const existing = routes.findIndex(r => r.id === route.id);
  if (existing >= 0) routes[existing] = route;
  else routes.push(route);
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

export async function deleteRoute(id: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { error } = await supabase
      .from('routes')
      .delete()
      .eq('id', id);
    
    if (error) console.error('Error deleting route from Supabase:', error);
    return;
  }

  const routes = (await getSavedRoutes()).filter((r) => r.id !== id);
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

export async function getSavedTracks(): Promise<RecordedTrack[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching tracks from Supabase:', error);
      return [];
    }
    
    return data.map(t => ({
      id: t.id,
      name: t.name,
      positions: t.positions,
      distance: t.distance,
      elevationGain: t.elevation_gain,
      elevationLoss: t.elevation_loss,
      maxAltitude: t.max_altitude,
      minAltitude: t.min_altitude,
      difficulty: t.difficulty as any,
      createdAt: t.created_at
    }));
  }

  try {
    const data = localStorage.getItem(TRACKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    console.warn('Failed to parse saved tracks, resetting');
    localStorage.removeItem(TRACKS_KEY);
    return [];
  }
}

export async function saveTrack(track: RecordedTrack) {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { error } = await supabase
      .from('tracks')
      .upsert({
        id: track.id,
        user_id: user.id,
        name: track.name,
        positions: track.positions,
        distance: track.distance,
        elevation_gain: track.elevationGain,
        elevation_loss: track.elevationLoss,
        max_altitude: track.maxAltitude,
        min_altitude: track.minAltitude,
        difficulty: track.difficulty,
        created_at: track.createdAt
      }, { onConflict: 'id' });
    
    if (error) console.error('Error saving track to Supabase:', error);
    return;
  }

  const tracks = await getSavedTracks();
  const existing = tracks.findIndex(t => t.id === track.id);
  if (existing >= 0) tracks[existing] = track;
  else tracks.push(track);
  localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));
}

export async function deleteTrack(id: string) {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { error } = await supabase
      .from('tracks')
      .delete()
      .eq('id', id);
    
    if (error) console.error('Error deleting track from Supabase:', error);
    return;
  }

  const tracks = (await getSavedTracks()).filter((t) => t.id !== id);
  localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));
}
