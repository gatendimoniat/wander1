import { SavedRoute, RecordedTrack } from './types';

export function routeToGPX(route: SavedRoute): string {
  const wpts = route.points
    .map(
      (p) =>
        `  <wpt lat="${p.lat}" lon="${p.lng}">\n    <name>${escapeXml(p.name)}</name>\n  </wpt>`
    )
    .join('\n');

  const rtePts = route.points
    .map(
      (p) =>
        `    <rtept lat="${p.lat}" lon="${p.lng}">\n      <name>${escapeXml(p.name)}</name>\n    </rtept>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ExploraMap"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <time>${route.createdAt}</time>
  </metadata>
${wpts}
  <rte>
    <name>${escapeXml(route.name)}</name>
${rtePts}
  </rte>
</gpx>`;
}

export function trackToGPX(track: RecordedTrack): string {
  const trkPts = track.positions
    .map((p) => {
      const ele = p.altitude !== undefined ? `\n      <ele>${p.altitude.toFixed(1)}</ele>` : '';
      const time = `\n      <time>${new Date(p.timestamp).toISOString()}</time>`;
      return `    <trkpt lat="${p.lat}" lon="${p.lng}">${ele}${time}\n    </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ExploraMap"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(track.name)}</name>
    <time>${track.createdAt}</time>
  </metadata>
  <trk>
    <name>${escapeXml(track.name)}</name>
    <trkseg>
${trkPts}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGPX(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.gpx') ? filename : `${filename}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
