import { SavedRoute, RecordedTrack, POI, TrackPoint } from './types';

function isMobile(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && 
    ((window as any).Capacitor.isNativePlatform?.() || false);
}

export function exportRouteToJSON(route: SavedRoute): string {
  return JSON.stringify(route, null, 2);
}

export function exportRouteToGPX(route: SavedRoute): string {
  const points = route.points.map(p => `    <wpt lat="${p.lat}" lon="${p.lng}">
      <name>${escapeXml(p.name)}</name>
      <desc>${escapeXml(p.category)}</desc>
    </wpt>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ExploraMap"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <time>${route.createdAt}</time>
  </metadata>
  ${points}
</gpx>`;
}

export function exportTrackToJSON(track: RecordedTrack): string {
  return JSON.stringify(track, null, 2);
}

export function exportTrackToGPX(track: RecordedTrack): string {
  const trackpoints = track.positions.map(p => 
    `      <trkpt lat="${p.lat}" lon="${p.lng}">${p.altitude !== undefined ? `\n        <ele>${p.altitude}</ele>` : ''}
        <time>${new Date(p.timestamp).toISOString()}</time>
      </trkpt>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ExploraMap"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(track.name)}</name>
    <desc>Distància: ${track.distance}km, Desnivell: ${track.elevationGain}m, Dificultat: ${track.difficulty}</desc>
    <time>${track.createdAt}</time>
  </metadata>
  <trk>
    <name>${escapeXml(track.name)}</name>
    <trkseg>
${trackpoints}
    </trkseg>
  </trk>
</gpx>`;
}

export function exportAllToJSON(routes: SavedRoute[], tracks: RecordedTrack[]): string {
  return JSON.stringify({ routes, tracks, exportedAt: new Date().toISOString() }, null, 2);
}

export function importRouteFromJSON(json: string): SavedRoute | null {
  try {
    const data = JSON.parse(json);
      if (data.name && data.points && Array.isArray(data.points)) {
      return {
        id: data.id || crypto.randomUUID(),
        name: data.name,
        points: data.points.map((p: { id?: string; lat: number; lng: number; name?: string; category?: string }) => ({
          id: p.id || String(p.lat + p.lng),
          name: p.name || 'Unknown',
          category: p.category || 'tourist',
          lat: p.lat,
          lng: p.lng,
        })),
        createdAt: data.createdAt || new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function importTrackFromJSON(json: string): RecordedTrack | null {
  try {
    const data = JSON.parse(json);
      if (data.name && data.positions && Array.isArray(data.positions)) {
      return {
        id: data.id || crypto.randomUUID(),
        name: data.name,
        positions: data.positions.map((p: { lat: number; lng: number; altitude?: number; timestamp?: number }) => ({
          lat: p.lat,
          lng: p.lng,
          altitude: p.altitude,
          timestamp: p.timestamp || Date.now(),
        })),
        distance: data.distance || calculateDistance(data.positions),
        elevationGain: data.elevationGain || 0,
        elevationLoss: data.elevationLoss || 0,
        maxAltitude: data.maxAltitude || 0,
        minAltitude: data.minAltitude || 0,
        difficulty: data.difficulty || 'easy',
        createdAt: data.createdAt || new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function importTrackFromGPX(gpx: string): RecordedTrack | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpx, 'text/xml');
    const trk = doc.querySelector('trk');
    const trkptElements = doc.querySelectorAll('trkpt');
    const name = doc.querySelector('metadata name')?.textContent || 
                 trk?.querySelector('name')?.textContent || 
                 'Imported Track';

    if (trkptElements.length === 0) return null;

    const positions: TrackPoint[] = [];
    trkptElements.forEach(pt => {
      positions.push({
        lat: parseFloat(pt.getAttribute('lat') || '0'),
        lng: parseFloat(pt.getAttribute('lon') || '0'),
        altitude: parseFloat(pt.querySelector('ele')?.textContent || '') || undefined,
        timestamp: new Date(pt.querySelector('time')?.textContent || '').getTime() || Date.now(),
      });
    });

    const stats = calculateTrackStats(positions);

    return {
      id: crypto.randomUUID(),
      name: name,
      positions: positions,
      ...stats,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function downloadFile(content: string, filename: string, type: string): Promise<string> {
  if (isMobile()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Downloads,
        encoding: Encoding.UTF8,
      });
      return 'Descargas (Downloads)';
    } catch (e) {
      console.error('Error saving file:', e);
      return '';
    }
  } else {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return '';
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function calculateDistance(positions: TrackPoint[]): number {
  let distance = 0;
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    distance += haversine(prev.lat, prev.lng, curr.lat, curr.lng);
  }
  return Math.round(distance * 100) / 100;
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function calculateTrackStats(positions: TrackPoint[]) {
  let elevGain = 0;
  let elevLoss = 0;
  let maxAlt = -Infinity;
  let minAlt = Infinity;

  for (let i = 0; i < positions.length; i++) {
    const curr = positions[i];
    if (curr.altitude !== undefined) {
      maxAlt = Math.max(maxAlt, curr.altitude);
      minAlt = Math.min(minAlt, curr.altitude);
    }
    if (i > 0) {
      const prev = positions[i - 1];
      if (curr.altitude !== undefined && prev.altitude !== undefined) {
        const diff = curr.altitude - prev.altitude;
        if (diff > 0) elevGain += diff;
        else elevLoss += Math.abs(diff);
      }
    }
  }

  const distance = calculateDistance(positions);
  const difficulty: RecordedTrack['difficulty'] =
    elevGain > 1000 ? 'expert' : elevGain > 500 ? 'hard' : elevGain > 200 ? 'moderate' : 'easy';

  return {
    distance,
    elevationGain: Math.round(elevGain),
    elevationLoss: Math.round(elevLoss),
    maxAltitude: maxAlt === -Infinity ? 0 : Math.round(maxAlt),
    minAltitude: minAlt === Infinity ? 0 : Math.round(minAlt),
    difficulty,
  };
}
