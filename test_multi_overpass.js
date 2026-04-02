const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function testQuery() {
  const query = `[out:json][timeout:25];(node["place"="city"](41,2,42,3););out center;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    console.log(`Testing ${endpoint}...`);
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (r.status === 429) {
        console.warn('429 Rate Limited, trying next...');
        continue;
      }
      if (!r.ok) {
        console.warn(`Error ${r.status}, trying next...`);
        continue;
      }

      const data = await r.json();
      console.log('Success! Count:', data.elements ? data.elements.length : 0);
      return;
    } catch (e) {
      console.error('Fetch error:', e.message);
    }
  }
}

testQuery();
