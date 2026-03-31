import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { POI, POICategory, CATEGORY_CONFIG, SavedRoute, RecordedTrack, TrackPoint } from '@/lib/types';
import { fetchPOIs, searchLocation } from '@/lib/overpass';
import { saveRoute, getSavedRoutes, deleteRoute, saveTrack, getSavedTracks, deleteTrack } from '@/lib/storage';
import { Search, Navigation, Route, Disc, Save, Trash2, List, X, ChevronLeft, ChevronRight, MapPin, Plus, Square, Layers } from 'lucide-react';

// Fix leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createCategoryIcon(category: POICategory) {
  const config = CATEGORY_CONFIG[category];
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${config.color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${config.emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: any) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    },
    zoomend: () => {
      const b = map.getBounds();
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    },
  });

  // Load POIs on initial mount
  useEffect(() => {
    const b = map.getBounds();
    onBoundsChange({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13);
  }, [center, map]);
  return null;
}

export default function ExplorerMap() {
  const [pois, setPois] = useState<POI[]>([]);
  const [activeCategories, setActiveCategories] = useState<POICategory[]>(['museum', 'castle', 'cathedral', 'tourist', 'viewpoint', 'peak']);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; name: string }[]>([]);
  const [flyToCenter, setFlyToCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'categories' | 'route' | 'saved' | 'track'>('categories');

  // Route building
  const [routePoints, setRoutePoints] = useState<POI[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(getSavedRoutes());
  const [routeName, setRouteName] = useState('');

  // Track recording
  const [isRecording, setIsRecording] = useState(false);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [savedTracks, setSavedTracks] = useState<RecordedTrack[]>(getSavedTracks());
  const [trackName, setTrackName] = useState('');
  const watchIdRef = useRef<number | null>(null);

  const boundsRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadPOIs = useCallback(async (bounds: any) => {
    if (!bounds || activeCategories.length === 0) return;
    setLoading(true);
    const results = await fetchPOIs(bounds, activeCategories);
    setPois(results);
    setLoading(false);
  }, [activeCategories]);

  const handleBoundsChange = useCallback((bounds: any) => {
    boundsRef.current = bounds;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadPOIs(bounds), 800);
  }, [loadPOIs]);

  useEffect(() => {
    if (boundsRef.current) {
      loadPOIs(boundsRef.current);
    }
  }, [activeCategories, loadPOIs]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const results = await searchLocation(searchQuery);
    setSearchResults(results);
    if (results.length > 0) {
      setFlyToCenter([results[0].lat, results[0].lng]);
    }
  };

  const toggleCategory = (cat: POICategory) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addToRoute = (poi: POI) => {
    if (!routePoints.find((p) => p.id === poi.id)) {
      setRoutePoints((prev) => [...prev, poi]);
    }
  };

  const removeFromRoute = (id: string) => {
    setRoutePoints((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveRoute = () => {
    if (routePoints.length < 2 || !routeName.trim()) return;
    const route: SavedRoute = {
      id: crypto.randomUUID(),
      name: routeName,
      points: routePoints,
      createdAt: new Date().toISOString(),
    };
    saveRoute(route);
    setSavedRoutes(getSavedRoutes());
    setRoutePoints([]);
    setRouteName('');
  };

  const handleDeleteRoute = (id: string) => {
    deleteRoute(id);
    setSavedRoutes(getSavedRoutes());
  };

  // Track recording
  const startRecording = () => {
    if (!navigator.geolocation) return alert('Tu navegador no soporta geolocalización');
    setTrackPoints([]);
    setIsRecording(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude ?? undefined,
          timestamp: pos.timestamp,
        };
        setTrackPoints((prev) => [...prev, point]);
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  };

  const stopRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsRecording(false);
  };

  const calculateTrackStats = (points: TrackPoint[]) => {
    let distance = 0;
    let elevGain = 0;
    let elevLoss = 0;
    let maxAlt = -Infinity;
    let minAlt = Infinity;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      distance += haversine(prev.lat, prev.lng, curr.lat, curr.lng);
      if (curr.altitude !== undefined && prev.altitude !== undefined) {
        const diff = curr.altitude - prev.altitude;
        if (diff > 0) elevGain += diff;
        else elevLoss += Math.abs(diff);
      }
      if (curr.altitude !== undefined) {
        maxAlt = Math.max(maxAlt, curr.altitude);
        minAlt = Math.min(minAlt, curr.altitude);
      }
    }

    const difficulty: RecordedTrack['difficulty'] =
      elevGain > 1000 ? 'expert' : elevGain > 500 ? 'hard' : elevGain > 200 ? 'moderate' : 'easy';

    return { distance: Math.round(distance * 100) / 100, elevationGain: Math.round(elevGain), elevationLoss: Math.round(elevLoss), maxAltitude: maxAlt === -Infinity ? 0 : Math.round(maxAlt), minAltitude: minAlt === Infinity ? 0 : Math.round(minAlt), difficulty };
  };

  const handleSaveTrack = () => {
    if (trackPoints.length < 2 || !trackName.trim()) return;
    const stats = calculateTrackStats(trackPoints);
    const track: RecordedTrack = {
      id: crypto.randomUUID(),
      name: trackName,
      positions: trackPoints,
      ...stats,
      createdAt: new Date().toISOString(),
    };
    saveTrack(track);
    setSavedTracks(getSavedTracks());
    setTrackPoints([]);
    setTrackName('');
  };

  const handleDeleteTrack = (id: string) => {
    deleteTrack(id);
    setSavedTracks(getSavedTracks());
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className={`relative z-[1000] flex transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0'}`}>
        <div className={`h-full bg-sidebar text-sidebar-foreground flex flex-col overflow-hidden ${sidebarOpen ? 'w-80' : 'w-0'}`}>
          {/* Header */}
          <div className="p-4 border-b border-sidebar-border">
            <h1 className="font-display text-xl font-bold text-sidebar-primary flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              ExploraMap
            </h1>
            <p className="text-xs text-sidebar-foreground/60 mt-1">Descubre los mejores lugares</p>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-sidebar-border">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg px-3 py-2 placeholder:text-sidebar-foreground/40 outline-none focus:ring-1 focus:ring-sidebar-primary"
                placeholder="Buscar ubicación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} className="bg-sidebar-primary text-sidebar-primary-foreground p-2 rounded-lg hover:opacity-90 transition">
                <Search className="w-4 h-4" />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="w-full text-left text-xs p-2 rounded bg-sidebar-accent hover:bg-sidebar-accent/80 transition truncate"
                    onClick={() => {
                      setFlyToCenter([r.lat, r.lng]);
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                  >
                    📍 {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-sidebar-border">
            {([
              { key: 'categories', icon: Layers, label: 'Filtros' },
              { key: 'route', icon: Route, label: 'Ruta' },
              { key: 'saved', icon: Save, label: 'Guardado' },
              { key: 'track', icon: Navigation, label: 'Track' },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setSidebarTab(key)}
                className={`flex-1 py-2.5 text-xs flex flex-col items-center gap-1 transition ${sidebarTab === key ? 'text-sidebar-primary border-b-2 border-sidebar-primary' : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {sidebarTab === 'categories' && (
              <div className="space-y-2">
                <p className="text-xs text-sidebar-foreground/50 mb-2">Selecciona categorías para explorar</p>
                {(Object.entries(CATEGORY_CONFIG) as [POICategory, typeof CATEGORY_CONFIG[POICategory]][]).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => toggleCategory(key)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm transition ${activeCategories.includes(key) ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/60'}`}
                  >
                    <span className="text-lg">{config.emoji}</span>
                    <span className="flex-1 text-left">{config.label}</span>
                    {activeCategories.includes(key) && <div className="w-2 h-2 rounded-full" style={{ background: config.color }} />}
                  </button>
                ))}
                {loading && <p className="text-xs text-sidebar-primary mt-3 animate-pulse">Cargando lugares...</p>}
                <p className="text-xs text-sidebar-foreground/30 mt-3">{pois.length} lugares encontrados</p>
              </div>
            )}

            {sidebarTab === 'route' && (
              <div className="space-y-3">
                <p className="text-xs text-sidebar-foreground/50">Haz clic en "+" en los marcadores del mapa para añadir a tu ruta</p>
                {routePoints.length > 0 && (
                  <div className="space-y-2">
                    {routePoints.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-2 bg-sidebar-accent p-2 rounded-lg text-sm">
                        <span className="text-xs font-bold text-sidebar-primary">{i + 1}</span>
                        <span className="flex-1 truncate">{p.name}</span>
                        <button onClick={() => removeFromRoute(p.id)} className="text-destructive hover:opacity-70">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <input
                      className="w-full bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg px-3 py-2 placeholder:text-sidebar-foreground/40 outline-none"
                      placeholder="Nombre de la ruta..."
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                    />
                    <button
                      onClick={handleSaveRoute}
                      disabled={routePoints.length < 2 || !routeName.trim()}
                      className="w-full bg-sidebar-primary text-sidebar-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
                    >
                      <Save className="w-4 h-4 inline mr-2" />
                      Guardar ruta ({routePoints.length} puntos)
                    </button>
                  </div>
                )}
                {routePoints.length === 0 && (
                  <div className="text-center py-8 text-sidebar-foreground/30">
                    <Route className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">Añade lugares desde el mapa</p>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'saved' && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Rutas guardadas</h3>
                {savedRoutes.map((route) => (
                  <div key={route.id} className="bg-sidebar-accent p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{route.name}</span>
                      <button onClick={() => handleDeleteRoute(route.id)} className="text-destructive hover:opacity-70">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-sidebar-foreground/50">{route.points.length} paradas · {new Date(route.createdAt).toLocaleDateString('es')}</p>
                    <div className="mt-2 space-y-1">
                      {route.points.map((p, i) => (
                        <p key={p.id} className="text-xs text-sidebar-foreground/60">{i + 1}. {p.name}</p>
                      ))}
                    </div>
                  </div>
                ))}
                <h3 className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mt-6">Tracks grabados</h3>
                {savedTracks.map((track) => (
                  <div key={track.id} className="bg-sidebar-accent p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{track.name}</span>
                      <button onClick={() => handleDeleteTrack(track.id)} className="text-destructive hover:opacity-70">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-sidebar-foreground/60">
                      <span>📏 {track.distance} km</span>
                      <span>⬆️ +{track.elevationGain}m</span>
                      <span>🏔️ Max: {track.maxAltitude}m</span>
                      <span className={`font-medium ${track.difficulty === 'easy' ? 'text-green-400' : track.difficulty === 'moderate' ? 'text-yellow-400' : track.difficulty === 'hard' ? 'text-orange-400' : 'text-red-400'}`}>
                        {track.difficulty === 'easy' ? '🟢 Fácil' : track.difficulty === 'moderate' ? '🟡 Moderada' : track.difficulty === 'hard' ? '🟠 Difícil' : '🔴 Experta'}
                      </span>
                    </div>
                  </div>
                ))}
                {savedRoutes.length === 0 && savedTracks.length === 0 && (
                  <div className="text-center py-8 text-sidebar-foreground/30">
                    <List className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">Sin datos guardados aún</p>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'track' && (
              <div className="space-y-3">
                <p className="text-xs text-sidebar-foreground/50">Graba un track GPS de tu recorrido</p>
                {!isRecording ? (
                  <button onClick={startRecording} className="w-full bg-sidebar-primary text-sidebar-primary-foreground py-3 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2">
                    <Disc className="w-4 h-4" />
                    Iniciar grabación
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-400 animate-pulse">
                      <Disc className="w-4 h-4" />
                      <span className="text-sm font-medium">Grabando... ({trackPoints.length} puntos)</span>
                    </div>
                    <button onClick={stopRecording} className="w-full bg-destructive text-destructive-foreground py-3 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2">
                      <Square className="w-4 h-4" />
                      Detener grabación
                    </button>
                  </div>
                )}
                {!isRecording && trackPoints.length > 1 && (
                  <div className="space-y-2">
                    <div className="bg-sidebar-accent p-3 rounded-lg text-xs space-y-1">
                      {(() => {
                        const stats = calculateTrackStats(trackPoints);
                        return (
                          <>
                            <p>📏 Distancia: {stats.distance} km</p>
                            <p>⬆️ Desnivel +: {stats.elevationGain}m</p>
                            <p>⬇️ Desnivel -: {stats.elevationLoss}m</p>
                            <p>🏔️ Alt. máx: {stats.maxAltitude}m / mín: {stats.minAltitude}m</p>
                            <p>Dificultad: {stats.difficulty === 'easy' ? '🟢 Fácil' : stats.difficulty === 'moderate' ? '🟡 Moderada' : stats.difficulty === 'hard' ? '🟠 Difícil' : '🔴 Experta'}</p>
                          </>
                        );
                      })()}
                    </div>
                    <input
                      className="w-full bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg px-3 py-2 placeholder:text-sidebar-foreground/40 outline-none"
                      placeholder="Nombre del track..."
                      value={trackName}
                      onChange={(e) => setTrackName(e.target.value)}
                    />
                    <button
                      onClick={handleSaveTrack}
                      disabled={!trackName.trim()}
                      className="w-full bg-sidebar-primary text-sidebar-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
                    >
                      <Save className="w-4 h-4 inline mr-2" />
                      Guardar track
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 z-[1001] bg-sidebar text-sidebar-foreground p-2 rounded-r-lg shadow-lg hover:bg-sidebar-accent transition"
        style={{ left: sidebarOpen ? '320px' : '0' }}
      >
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer center={[40.4168, -3.7038]} zoom={6} className="h-full w-full" zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onBoundsChange={handleBoundsChange} />
          {flyToCenter && <FlyTo center={flyToCenter} />}

          {pois.map((poi) => (
            <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={createCategoryIcon(poi.category)}>
              <Popup>
                <div className="min-w-[180px]">
                  <h3 className="font-bold text-sm">{poi.name}</h3>
                  <p className="text-xs opacity-70">{CATEGORY_CONFIG[poi.category].emoji} {CATEGORY_CONFIG[poi.category].label}</p>
                  {poi.tags?.['addr:street'] && <p className="text-xs mt-1">📍 {poi.tags['addr:street']}</p>}
                  {poi.tags?.website && <a href={poi.tags.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">🌐 Web</a>}
                  <button
                    onClick={() => { addToRoute(poi); setSidebarTab('route'); setSidebarOpen(true); }}
                    className="mt-2 w-full bg-green-600 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1 hover:bg-green-700 transition"
                  >
                    <Plus className="w-3 h-3" /> Añadir a ruta
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Route line */}
          {routePoints.length > 1 && (
            <Polyline
              positions={routePoints.map((p) => [p.lat, p.lng] as L.LatLngTuple)}
              color="hsl(152, 45%, 48%)"
              weight={3}
              dashArray="8 4"
            />
          )}

          {/* Track line */}
          {trackPoints.length > 1 && (
            <Polyline
              positions={trackPoints.map((p) => [p.lat, p.lng] as L.LatLngTuple)}
              color="#E53935"
              weight={3}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
