const south = 41.35;
const west = 2.10;
const north = 41.45;
const east = 2.25;
const margin = 0.05;
const s = Math.max(-90, south - margin).toFixed(4);
const w = Math.max(-180, west - margin).toFixed(4);
const n = Math.min(90, north + margin).toFixed(4);
const e = Math.min(180, east + margin).toFixed(4);

const query = `[out:json][timeout:30];
(
  nwr["unesco"="yes"](${s},${w},${n},${e});
  nwr["heritage"~"1|unesco"](${s},${w},${n},${e});
  
  node["tourism"~"museum|viewpoint|attraction"](${s},${w},${n},${e});
  node["historic"~"castle|fortress|monastery|monument|ruins|memorial"](${s},${w},${n},${e});
  node["place"~"city|town|village"](${s},${w},${n},${e});

  nwr["amenity"="place_of_worship"]["historic"~"cathedral|basilica|abbey|monastery"](${s},${w},${n},${e});
  node["natural"~"peak|volcano|beach"](${s},${w},${n},${e});
);
out center;`;

fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: `data=${encodeURIComponent(query)}`,
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
})
.then(async r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get('content-type');
  if (!ct || !ct.includes('json')) throw new Error(`Unexpected content-type: ${ct}`);
  return r.json();
})
.then(data => {
  console.log('Result count:', data.elements ? data.elements.length : 0);
  if (data.elements && data.elements.length > 0) {
    console.log('Sample tags:', JSON.stringify(data.elements[0].tags, null, 2));
    const heritage = data.elements.filter(e => e.tags.heritage || e.tags.unesco);
    console.log('Heritage/UNESCO count:', heritage.length);
  }
})
.catch(e => console.error('Fetch error:', e));
