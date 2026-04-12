const fs = require('fs');

let c = fs.readFileSync('src/components/ExplorerMap.tsx', 'utf8');

c = c.replace("import { toast } from 'sonner';", "import { toast } from 'sonner';\nimport { backgroundTrackService } from '@/lib/backgroundTrackService';");

c = c.replace("icon={createCategoryIcon(poi.category)}", "icon={createCategoryIcon(poi)}");

const old_btn = `                      <a
                        href={\`https://www.google.com/maps/dir/?api=1&destination=\${poi.lat},\${poi.lng}\`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ 
                          flex: 1, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '3px', 
                          background: '#16a34a', 
                          color: 'white', 
                          fontSize: '9px', 
                          padding: '5px 4px', 
                          borderRadius: '4px', 
                          textDecoration: 'none', 
                          fontWeight: 600,
                        }}
                      >
                        <Navigation2 style={{ width: '9px', height: '9px' }} /> 
                        <span>Navegar</span>
                      </a>`;

const new_btn = `                      <a
                        href={\`https://www.google.com/maps/dir/?api=1&destination=\${poi.lat},\${poi.lng}\`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ 
                          flex: 1, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '3px', 
                          background: '#16a34a', 
                          color: 'white', 
                          fontSize: '9px', 
                          padding: '5px 4px', 
                          borderRadius: '4px', 
                          textDecoration: 'none', 
                          fontWeight: 600,
                        }}
                      >
                        <Navigation2 style={{ width: '9px', height: '9px' }} /> 
                        <span>G.Maps</span>
                      </a>
                      <a
                        href={\`https://es.wikiloc.com/rutas?q=\${poi.lat},\${poi.lng}\`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ 
                          flex: 1, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '3px', 
                          background: '#E53935', 
                          color: 'white', 
                          fontSize: '9px', 
                          padding: '5px 4px', 
                          borderRadius: '4px', 
                          textDecoration: 'none', 
                          fontWeight: 600,
                        }}
                      >
                        <Map style={{ width: '9px', height: '9px' }} /> 
                        <span>Wikiloc</span>
                      </a>`;

c = c.replace(/<a[^>]*href=\{`https:\/\/www\.google\.com\/maps\/dir\/\?api=1[^>]*>[\s\S]*?<span>Navegar<\/span>\s*<\/a>/, new_btn);

const new_icon = `function createCategoryIcon(poi: POI) {
  const category = poi.category;
  const config = CATEGORY_CONFIG[category] || { color: '#888888', emoji: '📍' };
  let bgColor = config.color;
  if (category === 'rv_with_services') {
    if (poi.fee === 'yes' || poi.fee === 'paid' || (poi.fee && poi.fee !== 'no')) bgColor = '#ef4444';
    else bgColor = '#22c55e';
  }
  return L.divIcon({
    className: 'custom-marker',
    html: \`<div style="background:\${bgColor};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">\${config.emoji}</div>\`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}`;

c = c.replace(/function createCategoryIcon\(category: POICategory\) \{[\s\S]*?\n\}/, new_icon);

fs.writeFileSync('src/components/ExplorerMap.tsx', c, 'utf8');
