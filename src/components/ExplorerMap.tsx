import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { POI, POICategory, CATEGORY_CONFIG, SavedRoute, RecordedTrack, TrackPoint, Bounds } from '@/lib/types';
import { MOCK_SAVED_ROUTES, MOCK_SAVED_TRACKS } from '@/lib/poiDatabase';
import { loadPOIsFromOverpass } from '@/lib/overpassLoader';
import { saveRoute, getSavedRoutes, deleteRoute, saveTrack, getSavedTracks, deleteTrack } from '@/lib/storage';
import { exportRouteToJSON, exportRouteToGPX, exportTrackToJSON, exportTrackToGPX, exportAllToJSON, importRouteFromJSON, importTrackFromJSON, importTrackFromGPX, downloadFile } from '@/lib/exportImport';
import { decodeFromShareable, encodeRouteToShareable, encodeTrackToShareable, getShareableUrl, getQRCodeUrl } from '@/lib/shareUtils';
import { Search, Navigation, Route, Disc, Save, Trash2, List, X, ChevronLeft, ChevronRight, MapPin, Plus, Square, Layers, ExternalLink, Navigation2, Filter, Star, MessageSquare, Sun, Moon, Map, Satellite, Crosshair, Share2, Download } from 'lucide-react';
import WikipediaInfo from './WikipediaInfo';
import LanguageSelector from './LanguageSelector';
import { toast } from 'sonner';

type MapLayer = 'standard' | 'satellite' | 'topo' | 'cycle';

interface MapLayerConfig {
  name: string;
  url: string;
  attribution: string;
}

const MAP_LAYERS: Record<MapLayer, MapLayerConfig> = {
  standard: {
    name: 'Mapa',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  topo: {
    name: 'Topográfico',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
  cycle: {
    name: 'Ciclismo',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

// Fix leaflet marker icons
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createCategoryIcon(category: POICategory) {
  const config = CATEGORY_CONFIG[category] || { color: '#888888', emoji: '📍' };
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${config.color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${config.emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
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
  `,
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
    zoomend: () => {
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

function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13);
  }, [center, map]);
  return null;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [bounds, map]);
  return null;
}

function UserLocationMarker({ onLocationUpdate }: { onLocationUpdate: (latlng: [number, number]) => void }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        onLocationUpdate(latlng);
        
        if (!markerRef.current) {
          markerRef.current = L.marker(latlng, { icon: userLocationIcon }).addTo(map);
        } else {
          markerRef.current.setLatLng(latlng);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }
    };
  }, [map, onLocationUpdate]);

  return null;
}

export default function ExplorerMap() {
  const { t, i18n } = useTranslation();
  const [allPois, setAllPois] = useState<POI[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [activeCategories, setActiveCategories] = useState<POICategory[]>([]);
  const [showBestOnly, setShowBestOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; name: string; display: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [flyToCenter, setFlyToCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'categories' | 'route' | 'saved' | 'track'>('categories');
  const [tileLayer, setTileLayer] = useState<MapLayer>('standard');
  const [minRating, setMinRating] = useState<number>(0);
  const [reviewRange, setReviewRange] = useState<'all' | 'lt100' | '100to1000' | 'gt1000'>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [mapLayer, setMapLayer] = useState<MapLayer>('standard');
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const layerMenuRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [fitBoundsTo, setFitBoundsTo] = useState<L.LatLngBoundsExpression | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false);
  const [currentZoom, setCurrentZoom] = useState(13);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    };
    const handleLayerClickOutside = (e: MouseEvent) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target as Node)) {
        setLayerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mousedown', handleLayerClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousedown', handleLayerClickOutside);
    };
  }, []);

  useEffect(() => {
    setDbLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (shareParam) {
      const decoded = decodeFromShareable(shareParam);
      if (decoded) {
        if (decoded.type === 'route') {
          saveRoute(decoded.data);
          setSavedRoutes(getSavedRoutes());
          toast.success('Ruta importada!', { description: decoded.data.name });
          handleViewRoute(decoded.data);
        } else if (decoded.type === 'track') {
          saveTrack(decoded.data);
          setSavedTracks(getSavedTracks());
          toast.success('Track importat!', { description: decoded.data.name });
          handleViewTrack(decoded.data);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const [routePoints, setRoutePoints] = useState<POI[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => [...MOCK_SAVED_ROUTES, ...getSavedRoutes()]);
  const [routeName, setRouteName] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [savedTracks, setSavedTracks] = useState<RecordedTrack[]>(() => [...MOCK_SAVED_TRACKS, ...getSavedTracks()]);
  const [trackName, setTrackName] = useState('');
  const watchIdRef = useRef<number | null>(null);

  const boundsRef = useRef<Bounds | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState<{ type: 'route' | 'track'; name: string; url: string; qrUrl: string } | null>(null);

  useEffect(() => {
    if (routePoints.length >= 2) {
      fetchRouteCoordinates(routePoints);
    } else {
      setRouteCoordinates([]);
    }
  }, [routePoints]);

  const getPOILimit = (zoom: number): number => {
    if (zoom <= 5) return 30;
    if (zoom <= 7) return 60;
    if (zoom <= 9) return 100;
    if (zoom <= 11) return 200;
    if (zoom <= 13) return 300;
    return 500;
  };

  const loadPOIs = useCallback((bounds: Bounds, zoom: number = 10) => {
    if (!bounds) return;
    if (bounds.south >= bounds.north || bounds.west >= bounds.east) return;
    
    setLoading(true);
    loadPOIsFromOverpass(bounds).then((fetchedPois) => {
      setAllPois(fetchedPois);
      setLoading(false);
    }).catch((err) => {
      console.error('Error loading POIs:', err);
      toast.error('Error carregant llocs');
      setAllPois([]);
      setLoading(false);
    });
  }, []);

  const filteredPois = useMemo(() => {
    if (allPois.length === 0) return [];
    
    // Start with all POIs and sort them by importance
    let filtered: POI[] = [...allPois].sort((a, b) => (b.importance || 0) - (a.importance || 0));

    // Zoom dynamic filtering: Progressive Disclosure (Relaxed if a category is active)
    const isCategoryFiltering = activeCategories.length > 0;
    
    if (!isCategoryFiltering) {
      if (currentZoom < 10) {
        filtered = filtered.filter(poi => (poi.importance || 0) > 550);
      } 
      else if (currentZoom < 12) {
        filtered = filtered.filter(poi => (poi.importance || 0) > 400);
      }
      else if (currentZoom < 14) {
        filtered = filtered.filter(poi => (poi.importance || 0) > 150);
      }
    } else {
      // If filtering by category, still apply a small relevance filter to avoid noise
      if (currentZoom < 12) {
        filtered = filtered.filter(poi => (poi.importance || 0) > 100);
      }
      filtered = filtered.filter(poi => activeCategories.includes(poi.category));
    }

    // Limit the number of POIs based on zoom to avoid clutter
    const maxPois = currentZoom >= 15 ? 300 : currentZoom >= 13 ? 150 : currentZoom >= 11 ? 60 : 30;
    filtered = filtered.slice(0, maxPois);
    // UI Filter: Minimum Rating (Stars)
    if (minRating > 0) {
      filtered = filtered.filter(poi => (poi.rating || 0) >= minRating);
    }
    
    // UI Filter: Review Range (Importance proxy)
    if (reviewRange !== 'all') {
      filtered = filtered.filter(poi => {
        const imp = poi.importance || 0;
        if (reviewRange === 'lt100') return imp < 100;
        if (reviewRange === '100to1000') return imp >= 100 && imp < 500;
        if (reviewRange === 'gt1000') return imp >= 500;
        return true;
      });
    }
    
    if (showBestOnly) {
      filtered = filtered.filter(poi => poi.isBest);
    }
    
    if (activeCategories.length === 0 && !showBestOnly) {
      filtered = [];
    }
    
    return filtered.slice(0, 500);
  }, [allPois, activeCategories, showBestOnly, currentZoom, minRating, reviewRange]);

  const handleBoundsChange = useCallback((bounds: Bounds, zoom: number = 10) => {
    boundsRef.current = bounds;
    setCurrentZoom(zoom);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadPOIs(bounds, zoom), 800);
  }, [loadPOIs]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    setSearchResults([]);
    
    try {
      const query = encodeURIComponent(searchQuery.trim());
      const lang = i18n.language === 'ca' ? 'ca' : i18n.language === 'es' ? 'es' : 'en';
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=8&accept-language=${lang}`
      );
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
      
      const results = data.map((item) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: item.display_name.split(',')[0],
        display: item.display_name,
      }));
      
      setSearchResults(results);
      
      if (results.length > 0) {
        setFlyToCenter([results[0].lat, results[0].lng]);
      }
    } catch (error) {
      console.log('Search error:', error);
    } finally {
      setSearchLoading(false);
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
    toast.success(t('toast.routeSaved') || 'Ruta guardada', {
      description: routeName,
    });
  };

  const handleDeleteRoute = (id: string) => {
    deleteRoute(id);
    setSavedRoutes(getSavedRoutes());
    toast.info(t('toast.routeDeleted') || 'Ruta eliminada');
  };

  const handleViewRoute = (route: SavedRoute) => {
    if (route.points.length === 0) return;
    setRoutePoints(route.points);
    setRouteName(route.name);
    const bounds = L.latLngBounds(route.points.map(p => [p.lat, p.lng] as L.LatLngTuple));
    setFitBoundsTo(bounds);
    setSidebarTab('route');
    fetchRouteCoordinates(route.points);
  };

  const fetchRouteCoordinates = async (points: POI[]) => {
    if (points.length < 2) {
      setRouteCoordinates([]);
      return;
    }
    
    setRouteLoading(true);
    setRouteCoordinates([]);
    
    try {
      const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${coordinates}?overview=full&geometries=geojson`
      );
      
      if (!response.ok) throw new Error('Route fetch failed');
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(
          (c: number[]) => [c[1], c[0]] as [number, number]
        );
        setRouteCoordinates(coords);
      }
    } catch (error) {
      console.log('Error fetching route:', error);
      setRouteCoordinates([]);
    } finally {
      setRouteLoading(false);
    }
  };

  const handleNavigateRoute = (route: SavedRoute) => {
    if (route.points.length === 0) return;
    if (route.points.length === 1) {
      const p = route.points[0];
      window.open(`https://www.google.com/maps?q=${p.lat},${p.lng}`, '_blank');
      return;
    }
    const waypoints = route.points.map(p => `${p.lat},${p.lng}`).join('/');
    const url = `https://www.google.com/maps/dir/${waypoints}`;
    window.open(url, '_blank');
  };

  const handleNavigateTrack = (track: RecordedTrack) => {
    if (track.positions.length === 0) return;
    if (track.positions.length === 1) {
      const p = track.positions[0];
      window.open(`https://www.google.com/maps?q=${p.lat},${p.lng}`, '_blank');
      return;
    }
    const waypoints = track.positions.map(p => `${p.lat},${p.lng}`).join('/');
    const url = `https://www.google.com/maps/dir/${waypoints}`;
    window.open(url, '_blank');
  };

  const handleShareRoute = (route: SavedRoute) => {
    const encoded = encodeRouteToShareable(route);
    const shareUrl = getShareableUrl(encoded);
    const qrUrl = getQRCodeUrl(shareUrl, 200);
    setShareModal({ type: 'route', name: route.name, url: shareUrl, qrUrl });
  };

  const handleShareTrack = (track: RecordedTrack) => {
    const encoded = encodeTrackToShareable(track);
    const shareUrl = getShareableUrl(encoded);
    const qrUrl = getQRCodeUrl(shareUrl, 200);
    setShareModal({ type: 'track', name: track.name, url: shareUrl, qrUrl });
  };

  const handleCopyLink = () => {
    if (shareModal) {
      navigator.clipboard.writeText(shareModal.url);
      toast.success('Enllaç copiat!');
    }
  };

  const handleViewTrack = (track: RecordedTrack) => {
    if (track.positions.length === 0) return;
    setTrackPoints(track.positions);
    setTrackName(track.name);
    const bounds = L.latLngBounds(track.positions.map(p => [p.lat, p.lng] as L.LatLngTuple));
    setFitBoundsTo(bounds);
    setSidebarTab('track');
  };

  // Track recording
  const startRecording = () => {
    if (!navigator.geolocation) {
      alert(t('track.noGeolocation'));
      return;
    }
    if (trackPoints.length > 0) {
      if (!window.confirm(t('track.confirmClear'))) {
        return;
      }
    }
    setTrackPoints([]);
    setIsRecording(true);
    setGpsError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude ?? undefined,
          timestamp: pos.timestamp,
        };
        setTrackPoints((prev) => [...prev, point]);
        setGpsError(null);
      },
      (err) => {
        console.error('GPS error:', err);
        let errorMsg = t('track.gpsError');
        if (err.code === 1) errorMsg = t('track.gpsDenied');
        else if (err.code === 2) errorMsg = t('track.gpsUnavailable');
        else if (err.code === 3) errorMsg = t('track.gpsTimeout');
        setGpsError(errorMsg);
      },
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
    toast.success(t('toast.trackSaved') || 'Track guardado', {
      description: `${trackName} - ${stats.distance} km`,
    });
  };

  const handleDeleteTrack = (id: string) => {
    deleteTrack(id);
    setSavedTracks(getSavedTracks());
    toast.info(t('toast.trackDeleted') || 'Track eliminado');
  };

  const handleExportRoute = (route: SavedRoute, format: 'json' | 'gpx' = 'json') => {
    const filename = route.name.replace(/\s+/g, '_').toLowerCase();
    if (format === 'gpx') {
      downloadFile(exportRouteToGPX(route), `${filename}.gpx`, 'application/gpx+xml');
    } else {
      downloadFile(exportRouteToJSON(route), `${filename}.json`, 'application/json');
    }
    toast.success('Ruta exportada');
  };

  const handleExportTrack = (track: RecordedTrack, format: 'json' | 'gpx' = 'json') => {
    const filename = track.name.replace(/\s+/g, '_').toLowerCase();
    if (format === 'gpx') {
      downloadFile(exportTrackToGPX(track), `${filename}.gpx`, 'application/gpx+xml');
    } else {
      downloadFile(exportTrackToJSON(track), `${filename}.json`, 'application/json');
    }
    toast.success('Track exportat');
  };

  const handleExportAll = () => {
    const routes = getSavedRoutes();
    const tracks = getSavedTracks();
    downloadFile(exportAllToJSON(routes, tracks), 'exploramap_backup.json', 'application/json');
    toast.success('Còpia de seguretat exportada');
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.gpx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const text = await file.text();
      const filename = file.name.toLowerCase();
      
      if (filename.endsWith('.gpx')) {
        const track = importTrackFromGPX(text);
        if (track) {
          saveTrack(track);
          setSavedTracks(getSavedTracks());
          toast.success('Track importat');
        } else {
          toast.error('Error en importar GPX');
        }
      } else {
        const route = importRouteFromJSON(text);
        if (route) {
          saveRoute(route);
          setSavedRoutes(getSavedRoutes());
          toast.success('Ruta importada');
          return;
        }
        
        const track = importTrackFromJSON(text);
        if (track) {
          saveTrack(track);
          setSavedTracks(getSavedTracks());
          toast.success('Track importat');
        } else {
          toast.error('Error en importar fitxer');
        }
      }
    };
    input.click();
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
              {t('app.title')}
            </h1>
            <p className="text-xs text-sidebar-foreground/60 mt-1">{t('app.subtitle')}</p>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-sidebar-border">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg px-3 py-2 placeholder:text-sidebar-foreground/40 outline-none focus:ring-1 focus:ring-sidebar-primary"
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button 
                onClick={handleSearch} 
                disabled={searchLoading}
                className="bg-sidebar-primary text-sidebar-primary-foreground p-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {searchLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="w-full text-left text-xs p-2 rounded bg-sidebar-accent hover:bg-sidebar-accent/80 transition"
                    onClick={() => {
                      setFlyToCenter([r.lat, r.lng]);
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">📍</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.name}</div>
                        <div className="text-sidebar-foreground/50 truncate text-[10px]">{r.display}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && !searchLoading && (
              <div className="mt-2 text-xs text-sidebar-foreground/50 text-center py-2">
                No s'han trobat resultats
              </div>
            )}
          </div>

          {/* Language Selector & Filters & Mock Toggle */}
          <div className="px-3 py-2 border-b border-sidebar-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <button
                onClick={() => {
                  const newTheme = isDark ? 'light' : 'dark';
                  setIsDark(!isDark);
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(newTheme);
                  localStorage.setItem('exploramap-theme', newTheme);
                  window.dispatchEvent(new Event('themechange'));
                }}
                className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded transition text-sidebar-foreground/40 hover:text-sidebar-foreground/60"
                title={isDark ? 'Mode clar' : 'Mode fosc'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="relative flex items-center gap-1.5" ref={layerMenuRef}>
              <button
                onClick={() => setLayerMenuOpen(!layerMenuOpen)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded transition ${layerMenuOpen ? 'bg-green-500/20 text-green-400' : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/60'}`}
                title="Capas de mapa"
              >
                <Map className="w-3.5 h-3.5" />
              </button>
              {layerMenuOpen && (
                <div className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 w-40 bg-sidebar text-sidebar-foreground">
                  {(Object.entries(MAP_LAYERS) as [MapLayer, MapLayerConfig][]).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setMapLayer(key);
                        setLayerMenuOpen(false);
                      }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 transition ${mapLayer === key ? 'bg-green-500/20 text-green-400 font-medium' : 'hover:bg-sidebar-accent'}`}
                    >
                      {key === 'satellite' ? <Satellite className="w-3 h-3" /> : key === 'topo' ? <Map className="w-3 h-3" /> : key === 'cycle' ? <Navigation className="w-3 h-3" /> : <Map className="w-3 h-3" />}
                      {config.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex items-center gap-1.5" ref={filterMenuRef}>
              <button
                onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded transition ${filterMenuOpen ? 'bg-blue-500/20 text-blue-400' : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/60'}`}
                title="Filtros"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>

              {filterMenuOpen && (
                <div className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-56 bg-sidebar text-sidebar-foreground">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-yellow-400" />
                    {t('filters.minRating') || 'Valoración mínima'}
                  </p>
                  <div className="space-y-1 mb-3">
                    {([
                      { value: 0, label: t('filters.all') || 'Todas' },
                      { value: 3, label: '★★★+' },
                      { value: 4, label: '★★★★+' },
                      { value: 5, label: '★★★★★' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMinRating(opt.value)}
                        className={`w-full text-left text-xs px-2 py-1 rounded transition ${minRating === opt.value ? 'bg-blue-500/20 text-blue-400 font-medium' : 'hover:bg-sidebar-accent'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-green-400" />
                    {t('filters.reviewCount') || 'Nº de valoraciones'}
                  </p>
                  <div className="space-y-1">
                    {([
                      { value: 'all' as const, label: t('filters.all') || 'Todas' },
                      { value: 'lt100' as const, label: '< 100' },
                      { value: '100to1000' as const, label: '100 – 1.000' },
                      { value: 'gt1000' as const, label: '> 1.000' },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setReviewRange(opt.value)}
                        className={`w-full text-left text-xs px-2 py-1 rounded transition ${reviewRange === opt.value ? 'bg-green-500/20 text-green-400 font-medium' : 'hover:bg-sidebar-accent'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-sidebar-border">
            {([
              { key: 'categories', icon: Layers, label: 'filters' },
              { key: 'route', icon: Route, label: 'route' },
              { key: 'saved', icon: Save, label: 'saved' },
              { key: 'track', icon: Navigation, label: 'track' },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setSidebarTab(key)}
                className={`flex-1 py-2.5 text-xs flex flex-col items-center gap-1 transition ${sidebarTab === key ? 'text-sidebar-primary border-b-2 border-sidebar-primary' : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80'}`}
              >
                <Icon className="w-4 h-4" />
                {t(`tabs.${label}`)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {sidebarTab === 'categories' && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowBestOnly(!showBestOnly)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition shadow-sm ${showBestOnly ? 'bg-gradient-to-r from-yellow-500/30 to-amber-500/20 text-yellow-400 border-2 border-yellow-500/50' : 'bg-sidebar-accent text-sidebar-foreground border-2 border-transparent hover:border-yellow-500/30'}`}
                >
                  <span className="text-2xl">🏆</span>
                  <span className="flex-1 text-left font-semibold">{showBestOnly ? 'Mostrant millors llocs' : 'Tots els llocs'}</span>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${showBestOnly ? 'bg-yellow-500 text-black' : 'bg-sidebar-border'}`}>
                    {showBestOnly ? '✓' : ''}
                  </div>
                </button>
                
                <div className="border-t border-sidebar-border pt-3">
                  <p className="text-xs text-sidebar-foreground/50 mb-3 font-medium">CATEGORIES</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(CATEGORY_CONFIG) as [POICategory, typeof CATEGORY_CONFIG[POICategory]][]).map(([key, config]) => {
                      const isActive = activeCategories.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCategory(key)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl text-xs transition-all ${isActive ? 'bg-gradient-to-b from-sidebar-accent to-sidebar-accent/80 shadow-md border-2' : 'bg-sidebar-accent/30 hover:bg-sidebar-accent/50 text-sidebar-foreground/50'}`}
                          style={isActive ? { borderColor: config.color } : {}}
                        >
                          <span className={`text-2xl mb-1 transition-transform ${isActive ? 'scale-110' : 'scale-100'}`}>{config.emoji}</span>
                          <span className={`text-center leading-tight ${isActive ? 'text-sidebar-foreground font-medium' : ''}`}>
                            {t(`categories.${key}`).split(' ')[0]}
                          </span>
                          <div 
                            className={`w-2 h-2 rounded-full mt-1 transition-all ${isActive ? 'scale-100' : 'scale-0'}`}
                            style={{ backgroundColor: config.color }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {loading && <p className="text-xs text-sidebar-primary mt-3 animate-pulse">{t('categories.loading')}</p>}
                <p className="text-xs text-sidebar-foreground/50 mt-2 text-center">
                  {filteredPois.length} {showBestOnly ? 'millors llocs' : t('categories.found')}
                </p>
              </div>
            )}

            {sidebarTab === 'route' && (
              <div className="space-y-3">
                <p className="text-xs text-sidebar-foreground/50">{t('route.hint')}</p>
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
                      placeholder={t('route.namePlaceholder')}
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                    />
                    <button
                      onClick={handleSaveRoute}
                      disabled={routePoints.length < 2 || !routeName.trim()}
                      className="w-full bg-sidebar-primary text-sidebar-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
                    >
                      <Save className="w-4 h-4 inline mr-2" />
                      {t('route.save')} ({routePoints.length} {t('route.points')})
                    </button>
                  </div>
                )}
                {routePoints.length === 0 && (
                  <div className="text-center py-8 text-sidebar-foreground/30">
                    <Route className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">{t('route.empty')}</p>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'saved' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={handleImportFile}
                    className="flex-1 bg-sidebar-accent text-sidebar-foreground text-xs py-2 px-3 rounded-lg hover:bg-sidebar-accent/80 transition flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" style={{ transform: 'rotate(180deg)' }} />
                    Importar
                  </button>
                  <button
                    onClick={handleExportAll}
                    className="flex-1 bg-sidebar-accent text-sidebar-foreground text-xs py-2 px-3 rounded-lg hover:bg-sidebar-accent/80 transition flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Exportar tot
                  </button>
                </div>
                <h3 className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">{t('saved.routes')}</h3>
                {savedRoutes.map((route) => (
                  <div key={route.id} className="bg-sidebar-accent p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate flex-1 mr-2">{route.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleShareRoute(route)} className="text-purple-400 hover:opacity-70 p-1" title="Compartir">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="relative group">
                          <button className="text-blue-400 hover:opacity-70 p-1" title="Exportar">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute right-0 top-6 bg-sidebar border border-sidebar-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                            <button onClick={() => handleExportRoute(route, 'json')} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-sidebar-accent rounded-t-lg">
                              📄 JSON
                            </button>
                            <button onClick={() => handleExportRoute(route, 'gpx')} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-sidebar-accent rounded-b-lg">
                              🗺️ GPX
                            </button>
                          </div>
                        </div>
                        <button onClick={() => handleNavigateRoute(route)} className="text-green-500 hover:opacity-70 p-1" title="Navegar amb Google Maps">
                          <Navigation2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleViewRoute(route)} className="text-sidebar-primary hover:opacity-70 p-1" title="Veure al mapa">
                          <Map className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteRoute(route.id)} className="text-destructive hover:opacity-70 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-sidebar-foreground/50">{route.points.length} {t('saved.stops')} · {new Date(route.createdAt).toLocaleDateString(i18n.language)}</p>
                    <div className="mt-2 space-y-1">
                      {route.points.slice(0, 5).map((p, i) => (
                        <p key={p.id} className="text-xs text-sidebar-foreground/60 truncate">{i + 1}. {p.name}</p>
                      ))}
                      {route.points.length > 5 && (
                        <p className="text-xs text-sidebar-foreground/40">+ {route.points.length - 5} més...</p>
                      )}
                    </div>
                  </div>
                ))}
                <h3 className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mt-6">{t('saved.tracks')}</h3>
                {savedTracks.map((track) => (
                  <div key={track.id} className="bg-sidebar-accent p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate flex-1 mr-2">{track.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleShareTrack(track)} className="text-purple-400 hover:opacity-70 p-1" title="Compartir">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="relative group">
                          <button className="text-blue-400 hover:opacity-70 p-1" title="Exportar">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute right-0 top-6 bg-sidebar border border-sidebar-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                            <button onClick={() => handleExportTrack(track, 'json')} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-sidebar-accent rounded-t-lg">
                              📄 JSON
                            </button>
                            <button onClick={() => handleExportTrack(track, 'gpx')} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-sidebar-accent rounded-b-lg">
                              🗺️ GPX
                            </button>
                          </div>
                        </div>
                        <button onClick={() => handleNavigateTrack(track)} className="text-green-500 hover:opacity-70 p-1" title="Navegar amb Google Maps">
                          <Navigation2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleViewTrack(track)} className="text-sidebar-primary hover:opacity-70 p-1" title="Veure al mapa">
                          <Map className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteTrack(track.id)} className="text-destructive hover:opacity-70 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-sidebar-foreground/60">
                      <span>📏 {track.distance} km</span>
                      <span>⬆️ +{track.elevationGain}m</span>
                      <span>🏔️ Max: {track.maxAltitude}m</span>
                      <span className={`font-medium ${track.difficulty === 'easy' ? 'text-green-400' : track.difficulty === 'moderate' ? 'text-yellow-400' : track.difficulty === 'hard' ? 'text-orange-400' : 'text-red-400'}`}>
                        {track.difficulty === 'easy' ? `🟢 ${t('saved.easy')}` : track.difficulty === 'moderate' ? `🟡 ${t('saved.moderate')}` : track.difficulty === 'hard' ? `🟠 ${t('saved.hard')}` : `🔴 ${t('saved.expert')}`}
                      </span>
                    </div>
                  </div>
                ))}
                {savedRoutes.length === 0 && savedTracks.length === 0 && (
                  <div className="text-center py-8 text-sidebar-foreground/30">
                    <List className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">{t('saved.empty')}</p>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'track' && (
              <div className="space-y-3">
                <p className="text-xs text-sidebar-foreground/50">{t('track.hint')}</p>
                {gpsError && (
                  <div className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs p-2 rounded-lg">
                    ⚠️ {gpsError}
                  </div>
                )}
                {!isRecording ? (
                  <button onClick={startRecording} className="w-full bg-sidebar-primary text-sidebar-primary-foreground py-3 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2">
                    <Disc className="w-4 h-4" />
                    {t('track.start')}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-400 animate-pulse">
                      <Disc className="w-4 h-4" />
                      <span className="text-sm font-medium">{t('track.recording')} ({trackPoints.length} {t('track.points')})</span>
                    </div>
                    <button onClick={stopRecording} className="w-full bg-destructive text-destructive-foreground py-3 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2">
                      <Square className="w-4 h-4" />
                      {t('track.stop')}
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
                            <p>📏 {t('saved.distance')}: {stats.distance} km</p>
                            <p>⬆️ {t('saved.elevationGain')}: {stats.elevationGain}m</p>
                            <p>⬇️ {t('saved.elevationLoss')}: {stats.elevationLoss}m</p>
                            <p>🏔️ {t('saved.maxAltitude')}: {stats.maxAltitude}m / {t('saved.minAltitude')}: {stats.minAltitude}m</p>
                            <p>{t('saved.difficulty')}: {stats.difficulty === 'easy' ? `🟢 ${t('saved.easy')}` : stats.difficulty === 'moderate' ? `🟡 ${t('saved.moderate')}` : stats.difficulty === 'hard' ? `🟠 ${t('saved.hard')}` : `🔴 ${t('saved.expert')}`}</p>
                          </>
                        );
                      })()}
                    </div>
                    <input
                      className="w-full bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg px-3 py-2 placeholder:text-sidebar-foreground/40 outline-none"
                      placeholder={t('track.namePlaceholder')}
                      value={trackName}
                      onChange={(e) => setTrackName(e.target.value)}
                    />
                    <button
                      onClick={handleSaveTrack}
                      disabled={!trackName.trim()}
                      className="w-full bg-sidebar-primary text-sidebar-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
                    >
                      <Save className="w-4 h-4 inline mr-2" />
                      {t('track.save')}
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

      {/* User location button */}
      <button
        onClick={() => {
          if (userLocation) {
            setFlyToCenter(userLocation);
          } else {
            navigator.geolocation.getCurrentPosition(
              () => {},
              () => {},
              { enableHighAccuracy: true }
            );
          }
        }}
        className={`absolute top-4 right-4 z-[1001] p-2.5 rounded-lg shadow-lg transition flex items-center justify-center ${
          userLocation 
            ? 'bg-blue-500 text-white hover:bg-blue-600' 
            : 'bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent'
        }`}
        title="Mi ubicación"
      >
        <Navigation className="w-5 h-5" />
      </button>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer center={[41.3874, 2.1686]} zoom={13} className="h-full w-full" zoomControl={false}>
          {Object.entries(MAP_LAYERS).map(([key, config]) => (
            key === mapLayer && (
              <TileLayer key={key} attribution={config.attribution} url={config.url} />
            )
          ))}
          <MapEvents onBoundsChange={handleBoundsChange} />
          {flyToCenter && <FlyTo center={flyToCenter} />}
          {fitBoundsTo && <FitBounds bounds={fitBoundsTo} />}
          <UserLocationMarker onLocationUpdate={setUserLocation} />
          {userLocation && (
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup>
                <div className="text-sm font-medium">Tu ubicación</div>
              </Popup>
            </Marker>
          )}

          {filteredPois.map((poi) => (
            <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={createCategoryIcon(poi.category)}>
              <Popup>
                <div style={{ 
                  minWidth: '320px', 
                  maxWidth: '380px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  background: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                }}>
                  {/* Header Compact */}
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: `linear-gradient(135deg, ${CATEGORY_CONFIG[poi.category].color}15 0%, ${CATEGORY_CONFIG[poi.category].color}05 100%)`,
                    borderBottom: `1px solid ${CATEGORY_CONFIG[poi.category].color}33`
                  }}>
                    <span style={{ 
                      fontSize: '28px',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                    }}>{CATEGORY_CONFIG[poi.category].emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ 
                        fontWeight: 800, 
                        fontSize: '14px', 
                        margin: 0,
                        color: '#0f172a',
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em'
                      }}>
                        {poi.name}
                      </h3>
                      <span style={{
                        fontSize: '10px',
                        color: CATEGORY_CONFIG[poi.category].color,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {t(`categories.${poi.category}`)}
                      </span>
                    </div>
                    {/* Badge Patrimonio/UNESCO */}
                    {poi.tags && (poi.tags.unesco || poi.tags['heritage:operator'] === 'unesco' || poi.tags.heritage === 'unesco') && (
                      <div style={{ 
                        background: '#fef3c7',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #f59e0b',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: '#92400e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>🏛️</span>
                        UNESCO
                      </div>
                    )}
                    
                    {poi.tags && poi.tags.heritage && !poi.tags.unesco && (
                      <div style={{ 
                        background: '#f1f5f9',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #64748b',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>📜</span>
                        PATRIMONI
                      </div>
                    )}

                    {/* Star Rating - Only real OSM data */}
                    {poi.rating && poi.rating >= 1 && poi.rating <= 5 && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '3px',
                        background: '#fef3c7',
                        padding: '5px 8px',
                        borderRadius: '8px',
                        boxShadow: 'inset 0 0 0 1px #f59e0b33'
                      }}>
                        <span style={{ fontSize: '13px', color: '#f59e0b' }}>★</span>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#92400e' }}>{poi.rating}</span>
                      </div>
                    )}

                    {/* Premium / Best Badge */}
                    {poi.isBest && (
                      <div style={{ 
                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 900,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)',
                        border: '1px solid rgba(255,255,255,0.3)'
                      }}>
                        <span>👑</span>
                        TOP
                      </div>
                    )}
                  </div>
                  
                  {/* Additional Details (Population, Address, etc) */}
                  <div style={{ padding: '12px 16px 6px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {poi.population && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        fontSize: '12px', 
                        color: '#475569',
                        background: '#f8fafc',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <span style={{ fontSize: '14px' }}>👥</span>
                        <span style={{ fontWeight: 600 }}>{t('popup.population')}:</span>
                        <span>{new Intl.NumberFormat().format(parseInt(poi.population))} hab.</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div style={{ padding: '6px 10px' }}>
                    {/* Info Row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                      {poi.address && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          fontSize: '10px',
                          color: '#4b5563',
                          flex: '1 1 auto'
                        }}>
                          <span>📍</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.address}</span>
                        </div>
                      )}
                      {poi.openingHours && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          fontSize: '10px',
                          color: '#4b5563'
                        }}>
                          <span>🕐</span>
                          <span>{poi.openingHours}</span>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                      {poi.phone && (
                        <a href={`tel:${poi.phone}`} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          fontSize: '10px',
                          color: '#059669',
                          textDecoration: 'none'
                        }}>
                          <span>📞</span>
                          <span>{poi.phone}</span>
                        </a>
                      )}
                      {poi.website && (
                        <a href={poi.website} target="_blank" rel="noreferrer" style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          fontSize: '10px',
                          color: '#7c3aed', 
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}>
                          <span>🌐</span>
                          <span>Web</span>
                        </a>
                      )}
                    </div>
                    
                    {/* Wikipedia Info */}
                    <WikipediaInfo 
                      poiName={poi.name} 
                      wikipediaTag={poi.tags?.wikipedia} 
                      wikidataTag={poi.tags?.wikidata}
                      category={poi.category}
                    />
                    
                    {/* Action Buttons */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '6px', 
                      marginTop: '8px',
                      paddingTop: '6px',
                      borderTop: '1px solid #e5e7eb'
                    }}>
                      <a
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
                      </a>
                      <button
                        onClick={() => { addToRoute(poi); setSidebarTab('route'); setSidebarOpen(true); }}
                        style={{ 
                          flex: 1, 
                          background: '#059669', 
                          color: 'white', 
                          fontSize: '9px', 
                          padding: '5px 4px', 
                          borderRadius: '4px', 
                          border: 'none', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '3px', 
                          fontWeight: 600,
                        }}
                      >
                        <Plus style={{ width: '9px', height: '9px' }} /> 
                        <span>Ruta</span>
                      </button>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Route line - real roads */}
          {routePoints.length > 1 && (
            <>
              {routeLoading && (
                <Polyline
                  positions={routePoints.map((p) => [p.lat, p.lng] as L.LatLngTuple)}
                  color="hsl(152, 45%, 48%)"
                  weight={2}
                  dashArray="5 5"
                  opacity={0.5}
                />
              )}
              {routeCoordinates.length > 0 && (
                <Polyline
                  positions={routeCoordinates}
                  color="hsl(152, 45%, 48%)"
                  weight={4}
                />
              )}
            </>
          )}

          {/* Route waypoints markers */}
          {routePoints.map((p, i) => (
            <Marker key={`waypoint-${p.id}`} position={[p.lat, p.lng]}>
              <Popup>
                <div className="text-xs font-medium">{i + 1}. {p.name}</div>
              </Popup>
            </Marker>
          ))}

          {/* Track line */}
          {trackPoints.length > 1 && (
            <Polyline
              positions={trackPoints.map((p) => [p.lat, p.lng] as L.LatLngTuple)}
              color="#E53935"
              weight={3}
            />
          )}
        </MapContainer>

        {/* Layer Switcher */}
        <div className="absolute bottom-4 right-4 z-[1000] flex gap-1 bg-sidebar/90 backdrop-blur-sm rounded-lg p-1 shadow-lg">
          {Object.entries(MAP_LAYERS).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setMapLayer(key as MapLayer)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${mapLayer === key ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'}`}
            >
              {config.name}
            </button>
          ))}
        </div>
      </div>

      {/* Share Modal */}
      {shareModal && (
        <div 
          className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShareModal(null)}
        >
          <div 
            className="bg-sidebar rounded-xl shadow-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Compartir {shareModal.type === 'route' ? 'Ruta' : 'Track'}</h3>
              <button onClick={() => setShareModal(null)} className="p-1 hover:bg-sidebar-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-sidebar-foreground/70 mb-4">{shareModal.name}</p>
            
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-lg">
                <img src={shareModal.qrUrl} alt="QR Code" className="rounded" />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 bg-sidebar-primary text-sidebar-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                <span>📋</span> Copiar enllaç
              </button>
              <a
                href={shareModal.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-sidebar-accent text-sidebar-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Obrir
              </a>
            </div>
            
            <p className="text-xs text-sidebar-foreground/50 mt-3 text-center">
              Escaneja el codi QR o comparteix l'enllaç
            </p>
          </div>
        </div>
      )}
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
