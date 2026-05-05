export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  poiId?: string; // ID del POI original si viene de favorito
}

const STORAGE_KEY = 'explorawander_waypoints';

export function getWaypoints(): Waypoint[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveWaypoints(waypoints: Waypoint[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints));
}

export function addWaypoint(waypoint: Omit<Waypoint, 'id' | 'createdAt' | 'updatedAt'>): Waypoint {
  const waypoints = getWaypoints();
  const newWaypoint: Waypoint = {
    ...waypoint,
    id: `waypoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  waypoints.push(newWaypoint);
  saveWaypoints(waypoints);
  return newWaypoint;
}

export function updateWaypoint(id: string, updates: Partial<Omit<Waypoint, 'id' | 'createdAt'>>): Waypoint | null {
  const waypoints = getWaypoints();
  const index = waypoints.findIndex(w => w.id === id);
  if (index === -1) return null;
  
  waypoints[index] = {
    ...waypoints[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveWaypoints(waypoints);
  return waypoints[index];
}

export function deleteWaypoint(id: string): boolean {
  const waypoints = getWaypoints();
  const filtered = waypoints.filter(w => w.id !== id);
  if (filtered.length === waypoints.length) return false;
  saveWaypoints(filtered);
  return true;
}

export function getWaypointById(id: string): Waypoint | null {
  const waypoints = getWaypoints();
  return waypoints.find(w => w.id === id) || null;
}

export function getWaypointByPoiId(poiId: string): Waypoint | null {
  const waypoints = getWaypoints();
  return waypoints.find(w => w.poiId === poiId) || null;
}

export function toggleFavorite(poi: { id: string; name: string; lat: number; lng: number; description?: string }): { action: 'added' | 'removed'; waypoint?: Waypoint } {
  const existing = getWaypointByPoiId(poi.id);
  if (existing) {
    deleteWaypoint(existing.id);
    return { action: 'removed' };
  } else {
    const waypoint = addWaypoint({
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      description: poi.description,
      poiId: poi.id,
    });
    return { action: 'added', waypoint };
  }
}

export function clearAllWaypoints(): void {
  saveWaypoints([]);
}
