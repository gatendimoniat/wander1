const fs = require('fs');
let code = fs.readFileSync('src/components/ExplorerMap.tsx', 'utf8');

const regex = /function createCategoryIcon[\s\S]*?function FlyTo/;

const replacement = `function createCategoryIcon(poi: POI) {
  const category = poi.category;
  const config = CATEGORY_CONFIG[category] || { color: '#888888', emoji: '📍' };
  let bgColor = config.color;
  if (category === 'rv_with_services') {
    if (poi.fee === 'yes' || poi.fee === 'paid' || (poi.fee && poi.fee !== 'no')) bgColor = '#ef4444';
    else bgColor = '#22c55e';
  }

  const cacheKey = \`\${category}-\${bgColor}\`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const icon = L.divIcon({
    className: 'custom-marker',
    html: \`<div style="background:\${bgColor};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">\${config.emoji}</div>\`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
  
  iconCache.set(cacheKey, icon);
  return icon;
}

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: \`
    <div style="position:relative;width:24px;height:24px;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;background:rgba(59,130,246,0.2);border-radius:50%;animation:userPulse 2s infinite;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;background:#3b82f6;border:4px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>
    </div>
    <style>
      @keyframes userPulse {
        0% { transform: translate(-50%,-50%) scale(0.5); opacity: 0.8; }
        100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
      }
    </style>
  \`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: Bounds, zoom: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      }, map.getZoom());
    },
  });

  useEffect(() => {
    const b = map.getBounds();
    onBoundsChange({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    }, map.getZoom());
  }, []);

  return null;
}

function FlyTo`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/ExplorerMap.tsx', code);
