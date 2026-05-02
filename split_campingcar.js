const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/campingcar_aires.json', 'utf8'));
console.log(`Total POIs: ${data.length}`);

// Split by longitude ranges (roughly by country/region)
const zones = {
  'west':  { minLng: -20, maxLng: 0, pois: [] },      // Portugal, West Spain
  'iberia': { minLng: 0, maxLng: 5, pois: [] },        // Spain, East Portugal
  'france': { minLng: -5, maxLng: 10, pois: [] },      // France, Benelux
  'central': { minLng: 5, maxLng: 15, pois: [] },       // Germany, Switzerland, Austria
  'italy':   { minLng: 10, maxLng: 20, pois: [] },      // Italy
  'east':    { minLng: 15, maxLng: 30, pois: [] },      // Eastern Europe
  'nordic':  { minLng: 5, maxLng: 35, pois: [], minLat: 55 }, // Nordic countries
  'balkans': { minLng: 15, maxLng: 25, pois: [], maxLat: 45 }, // Balkans
};

data.forEach(poi => {
  const lng = poi.lng;
  const lat = poi.lat;
  
  if (lat >= 55 && lng >= 5) {
    zones.nordic.pois.push(poi);
  } else if (lat < 45 && lng >= 15) {
    zones.balkans.pois.push(poi);
  } else if (lng < 0) {
    zones.west.pois.push(poi);
  } else if (lng < 5) {
    zones.iberia.pois.push(poi);
  } else if (lng < 10) {
    zones.france.pois.push(poi);
  } else if (lng < 15) {
    zones.central.pois.push(poi);
  } else if (lng < 20) {
    zones.italy.pois.push(poi);
  } else {
    zones.east.pois.push(poi);
  }
});

// Write zone files
Object.entries(zones).forEach(([name, zone]) => {
  if (zone.pois.length > 0) {
    fs.writeFileSync(`public/campingcar_${name}.json`, JSON.stringify(zone.pois, null, 2));
    console.log(`${name}: ${zone.pois.length} POIs -> campingcar_${name}.json`);
  }
});

console.log('Done! Files created in public/');
