import sys
import re

with open('src/components/ExplorerMap.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add backgroundTrackService import
c = c.replace('import { toast } from \'sonner\';', 'import { toast } from \'sonner\';\nimport { backgroundTrackService } from \'@/lib/backgroundTrackService\';')

# 2. Fix createCategoryIcon parameter
c = c.replace('icon={createCategoryIcon(poi.category)}', 'icon={createCategoryIcon(poi)}')

# 3. Replace the Navegar button with two buttons
old_btn = """                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`}
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
                      </a>"""

new_btn = """                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`}
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
                        href={`https://es.wikiloc.com/rutas?q=${poi.lat},${poi.lng}`}
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
                      </a>"""

c = re.sub(r'<a[^>]*href=\{`https://www\.google\.com/maps/dir/\?api=1[^>]*>[\s\S]*?<span>Navegar</span>\s*</a>', new_btn, c)

# 4. Modify createCategoryIcon function definition
new_icon = """function createCategoryIcon(poi: POI) {
  const category = poi.category;
  const config = CATEGORY_CONFIG[category] || { color: '#888888', emoji: '📍' };
  let bgColor = config.color;
  if (category === 'rv_with_services') {
    if (poi.fee === 'yes' || poi.fee === 'paid' || (poi.fee && poi.fee !== 'no')) bgColor = '#ef4444';
    else bgColor = '#22c55e';
  }
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${bgColor};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${config.emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}"""

c = re.sub(r'function createCategoryIcon\(category: POICategory\) \{.*?\n\}', new_icon, c, flags=re.DOTALL)

with open('src/components/ExplorerMap.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
