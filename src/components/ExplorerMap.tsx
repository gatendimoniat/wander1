import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { Search, Navigation, Route, Disc, Save, Trash2, List, X, ChevronLeft, ChevronRight, MapPin, Plus, Square, Layers, ExternalLink, Navigation2, Map as MapIcon, Satellite, Crosshair, Share2, Download, Eye, EyeOff, HardDrive } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { CATEGORY_CONFIG } from '@/lib/types';
import type { POI, POICategory, SavedRoute, RecordedTrack, TrackPoint, Bounds } from '@/lib/types';
import { getSavedRoutes, getSavedTracks, saveRoute, deleteRoute, saveTrack, deleteTrack } from '@/lib/storage';
import { getPOIsInBounds, getPOICount, getDownloadedRegionsWithCounts } from '@/lib/poiManager';
import { getDownloadedRegionIds, getDownloadStats } from '@/lib/downloadRegistry';
import { exportRouteToGPX, exportRouteToJSON, exportTrackToGPX, exportTrackToJSON, exportAllToJSON, importTrackFromGPX, importRouteFromJSON, downloadFile } from '@/lib/exportImport';
import { decodeFromShareable, encodeRouteToShareable, encodeTrackToShareable, getShareableUrl, getQRCodeUrl } from '@/lib/shareUtils';
import { backgroundTrackService } from '@/lib/backgroundTrackService';
import WikipediaInfo from './WikipediaInfo';
import LanguageSelector from './LanguageSelector';
import DownloadManager from './DownloadManager';
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

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function FixMapSize() {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      map.invalidateSize();
    };
    map.whenReady(handler);
    return () => {
      map.off('ready', handler);
    };
  }, [map]);
  return null;
}

function createCategoryIcon(poi: POI) {
  const category = poi.category;
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
  const isMobile = useIsMobile();
  const [allPois, setAllPois] = useState<POI[]>([]);
  const [campingCarPOIs, setCampingCarPOIs] = useState<POI[]>([]);
  const [currentRegion, setCurrentRegion] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<POICategory[]>([
    'cc_as', 'cc_asn', 'cc_aa', 'cc_ac', 'cc_acf', 'cc_acs', 'cc_apcc', 'cc_apn'
  ]);
  const [showBestOnly, setShowBestOnly] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [categoriesMinimized, setCategoriesMinimized] = useState(false);
  const [filtersMinimized, setFiltersMinimized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; name: string; display: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [flyToCenter, setFlyToCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchMoveRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchMoveRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = () => {
    const dx = touchMoveRef.current.x - touchStartRef.current.x;
    const dy = touchMoveRef.current.y - touchStartRef.current.y;
    if (!isMobile) return;
    if (!sidebarOpen && dx > 80 && Math.abs(dx) > Math.abs(dy)) {
      setSidebarOpen(true);
    }
  };
  const [sidebarTab, setSidebarTab] = useState<'categories' | 'route' | 'saved' | 'track' | 'downloads'>('categories');
  const [mapLayer, setMapLayer] = useState<MapLayer>('standard');
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const layerMenuRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [fitBoundsTo, setFitBoundsTo] = useState<L.LatLngBoundsExpression | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const currentZoomRef = useRef<number>(13);
  const [currentZoom, setCurrentZoom] = useState(13);
  const lastLoadedBoundsRef = useRef<Bounds | null>(null);
  const [downloadedRegions, setDownloadedRegions] = useState<string[]>([]);
  const [totalPOICount, setTotalPOICount] = useState(0);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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

    return { 
      distance: Math.round(distance * 100) / 100, 
      elevationGain: Math.round(elevGain), 
      elevationLoss: Math.round(elevLoss), 
      maxAltitude: maxAlt === -Infinity ? 0 : Math.round(maxAlt), 
      minAltitude: minAlt === Infinity ? 0 : Math.round(minAlt), 
      difficulty 
    };
  };

  useEffect(() => {
    const handleLayerClickOutside = (e: MouseEvent) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target as Node)) {
        setLayerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleLayerClickOutside);
    refreshData();
    loadDownloadedRegions();
    // Load initial region based on default map center
    loadCampingCarData(41.3874, 2.1686);

    return () => {
      document.removeEventListener('mousedown', handleLayerClickOutside);
    };
  }, []);

  const getRegion = (lat: number, lng: number): string | null => {
    if (lat >= 55 && lng >= 5) return 'nordic';
    if (lat < 45 && lng >= 15) return 'balkans';
    if (lng < 0) return 'west';
    if (lng < 5) return 'iberia';
    if (lng < 10) return 'france';
    if (lng < 15) return 'central';
    if (lng < 20) return 'italy';
    return 'east';
  };

  const loadCampingCarData = async (lat?: number, lng?: number) => {
    const latToUse = lat ?? 41.3874;
    const lngToUse = lng ?? 2.1686;
    const region = getRegion(latToUse, lngToUse);
    if (!region || region === currentRegion) return;
    
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}campingcar_${region}.json`);
      if (response.ok) {
        const data = await response.json();
        const mapped = data.map((item: any) => ({
          id: item.id, name: item.name, lat: item.lat, lng: item.lng,
          category: ('cc_' + item.category.toLowerCase()) as POICategory,
          importance: 200, rating: undefined, reviews: undefined,
          address: undefined, phone: undefined, website: undefined,
          openingHours: undefined, wikipedia: undefined, types: [], heritage: undefined,
        }));
        setCampingCarPOIs(mapped);
        setCurrentRegion(region);
        console.log(`Loaded ${mapped.length} camping-car POIs from ${region}`);
      }
    } catch (error) {
      console.error('Error loading camping-car POIs:', error);
    }
  };

  const loadDownloadedRegions = async () => {
    const regions = getDownloadedRegionIds();
    setDownloadedRegions(regions);
    const count = await getPOICount();
    setTotalPOICount(count);
  };

  const refreshData = async () => {
    try {
      const [routes, tracks] = await Promise.all([
        getSavedRoutes(),
        getSavedTracks()
      ]);
      setSavedRoutes(routes);
      setSavedTracks(tracks);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (shareParam) {
      const decoded = decodeFromShareable(shareParam);
      if (decoded) {
        (async () => {
          const confirmed = window.confirm(
            decoded.type === 'route'
              ? `Vols importar la ruta "${decoded.data.name}"?`
              : `Vols importar el track "${decoded.data.name}"?`
          );
          if (!confirmed) {
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
          if (decoded.type === 'route') {
            await saveRoute(decoded.data);
            await refreshData();
            toast.success('Ruta importada!', { description: decoded.data.name });
            handleViewRoute(decoded.data);
          } else if (decoded.type === 'track') {
            await saveTrack(decoded.data);
            await refreshData();
            toast.success('Track importat!', { description: decoded.data.name });
            handleViewTrack(decoded.data);
          }
          window.history.replaceState({}, '', window.location.pathname);
        })();
      }
    }
  }, []);

  const [routePoints, setRoutePoints] = useState<POI[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [routeName, setRouteName] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [savedTracks, setSavedTracks] = useState<RecordedTrack[]>([]);
  const [trackName, setTrackName] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const recordingTrackRef = useRef<TrackPoint[]>([]);
  const lastRecordedTimeRef = useRef<number>(0);

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

  const loadPOIs = useCallback(async (bounds: Bounds, zoom: number = 10) => {
    if (!bounds) return;
    if (bounds.south >= bounds.north || bounds.west >= bounds.east) return;
    if (downloadedRegions.length === 0) {
      setAllPois([]);
      return;
    }

    setLoading(true);

    try {
      const pois = await getPOIsInBounds(bounds, activeCategories, downloadedRegions);
      setAllPois(pois);
    } catch (err) {
      console.error('Error loading POIs:', err);
      if (allPois.length === 0) {
        toast.error('Error carregant llocs');
      }
    }
    setLoading(false);
  }, [downloadedRegions, activeCategories]);

  const filteredPois = useMemo(() => {
    if (allPois.length === 0) return [];
    
    let filtered: POI[] = [...allPois].sort((a, b) => (b.importance || 0) - (a.importance || 0));

    const isCategoryFiltering = activeCategories.length > 0;
    const zoom = currentZoomRef.current;
    
    if (!isCategoryFiltering) {
      if (zoom < 10) {
        filtered = filtered.filter(poi => (poi.importance || 0) > 150);
      } 
      else if (zoom < 12) {
        filtered = filtered.filter(poi => (poi.importance || 0) > 80);
      }
      else if (zoom < 14) {
        filtered = filtered.filter(poi => (poi.importance || 0) > 30);
      }
    } else {
      if (zoom < 12) {
        filtered = filtered.filter(poi => (poi.importance || 0) > 20);
      }
      filtered = filtered.filter(poi => activeCategories.includes(poi.category));
    }

    const maxPois = zoom >= 15 ? 500 : zoom >= 13 ? 300 : zoom >= 11 ? 150 : 80;
    filtered = filtered.slice(0, maxPois);
    
    if (showBestOnly) {
      filtered = filtered.filter(poi => poi.isBest);
    }
    
    return filtered.slice(0, 500);
  }, [allPois, activeCategories, showBestOnly]);

  const visibleCampingCarPOIs = useMemo(() => {
    const bounds = boundsRef.current;
    if (campingCarPOIs.length === 0) return [];
    const zoom = currentZoomRef.current;
    if (zoom < 10) return []; // Only show when zoomed in
    
    // If no bounds yet, use default based on map center
    const b = bounds || { south: 41.3, north: 41.5, west: 2.0, east: 2.3 };
    
    return campingCarPOIs.filter(p => {
      if (!activeCategories.includes(p.category)) return false;
      return p.lat >= b.south && p.lat <= b.north &&
             p.lng >= b.west && p.lng <= b.east;
    }); // No limit - show all in visible area
  }, [campingCarPOIs, activeCategories]);

  const handleBoundsChange = useCallback((bounds: Bounds, zoom: number = 10) => {
    currentZoomRef.current = zoom;
    setCurrentZoom(zoom);
    
    // Load camping car POIs for current region
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    loadCampingCarData(centerLat, centerLng);
    
    const b = lastLoadedBoundsRef.current;
    const boundsChanged = !b ||
      Math.abs(bounds.south - b.south) > 0.02 ||
      Math.abs(bounds.west - b.west) > 0.02 ||
      Math.abs(bounds.north - b.north) > 0.02 ||
      Math.abs(bounds.east - b.east) > 0.02;
    
    if (!boundsChanged) return;
    
    boundsRef.current = bounds;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastLoadedBoundsRef.current = bounds;
      loadPOIs(bounds, zoom);
    }, 500);
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

  const handleSaveRoute = async () => {
    if (routePoints.length < 2 || !routeName.trim()) return;
    const newRoute = {
      id: crypto.randomUUID(),
      name: routeName,
      points: [...routePoints],
      createdAt: new Date().toISOString(),
    };
    await saveRoute(newRoute);
    await refreshData();

    setRoutePoints([]);
    setRouteName('');
    toast.success(t('toast.routeSaved') || 'Ruta guardada', {
      description: routeName,
    });
  };

  const handleDeleteRoute = async (id: string) => {
    await deleteRoute(id);
    await refreshData();
    toast.success('Ruta esborrada');
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

  const startRecording = async () => {
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
    recordingTrackRef.current = [];
    lastRecordedTimeRef.current = 0;
    setIsRecording(true);
    setGpsError(null);

    await backgroundTrackService.start(
      (point) => {
        recordingTrackRef.current.push(point);
        setTrackPoints((prev) => [...prev, point]);
        setGpsError(null);
      },
      (error) => {
        console.error('GPS error:', error);
        setGpsError(error);
      }
    );
  };

  const stopRecording = () => {
    backgroundTrackService.stop();
    setIsRecording(false);
  };

  const handleSaveTrack = async () => {
    if (recordingTrackRef.current.length < 2 || !trackName.trim()) return;
    
    const stats = calculateTrackStats(recordingTrackRef.current);

    const newTrack: RecordedTrack = {
      id: crypto.randomUUID(),
      name: trackName || `Track ${new Date().toLocaleDateString()}`,
      positions: Array.from(recordingTrackRef.current),
      distance: stats.distance,
      elevationGain: stats.elevationGain,
      elevationLoss: stats.elevationLoss,
      maxAltitude: stats.maxAltitude,
      minAltitude: stats.minAltitude,
      difficulty: stats.difficulty,
      createdAt: new Date().toISOString(),
    };
    await saveTrack(newTrack);
    await refreshData();
    setTrackPoints([]);
    setTrackName('');
    toast.success(t('toast.trackSaved') || 'Track guardado', {
      description: `${trackName} - ${newTrack.distance} km`,
    });
  };

  const handleDeleteTrack = async (id: string) => {
    await deleteTrack(id);
    await refreshData();
    toast.success('Track esborrat');
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

  const handleExportAll = async () => {
    const routes = await getSavedRoutes();
    const tracks = await getSavedTracks();
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
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const filename = file.name.toLowerCase();
        
        if (filename.endsWith('.gpx')) {
          const track = importTrackFromGPX(text);
          if (track) {
            await saveTrack(track);
            await refreshData();
            toast.success('Track importat');
          } else {
            toast.error('Error en importar GPX');
          }
        } else {
          const route = importRouteFromJSON(text);
          if (route) {
            await saveRoute(route);
            await refreshData();
            toast.success('Ruta importada');
            return;
          }
          
          const track = importTrackFromJSON(text);
          if (track) {
            await saveTrack(track);
            await refreshData();
            toast.success('Track importat');
          } else {
            toast.error('Error en importar fitxer');
          }
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleDownloadComplete = async () => {
    await loadDownloadedRegions();
    const b = boundsRef.current;
    if (b && showMarkers) {
      loadPOIs(b, currentZoomRef.current);
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 z-[1000] bg-black/40" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className={`${
        isMobile 
          ? `fixed inset-x-0 bottom-0 z-[1001] transition-transform duration-300 ${sidebarOpen ? 'translate-y-0' : 'translate-y-full'}` 
          : `relative z-[1000] transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0'}`
      }`}>
        <div className={`bg-sidebar text-sidebar-foreground flex flex-col overflow-hidden transition-all duration-300 ${
          isMobile 
            ? 'w-full max-h-[70vh] rounded-t-2xl shadow-2xl' 
            : sidebarOpen ? 'w-80 h-screen' : 'w-0'
        }`}>
          {isMobile && (
            <div className="flex justify-center py-2 bg-sidebar-border/20 shrink-0">
              <div className="w-10 h-1 bg-sidebar-foreground/30 rounded-full" />
            </div>
          )}
          <div className={`border-b border-sidebar-border shrink-0 ${isMobile ? 'p-3' : 'p-4'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-sidebar-primary" />
                <h1 className="font-display text-lg font-bold text-sidebar-primary">{t('app.title')}</h1>
              </div>
              {isMobile && (
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-sidebar-accent min-w-[40px] min-h-[40px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            {!isMobile && <p className="text-xs text-sidebar-foreground/60 mt-1">{t('app.subtitle')}</p>}
          </div>

          <div className={`border-b border-sidebar-border shrink-0 ${isMobile ? 'p-2' : 'p-3'}`}>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg px-3 py-2 placeholder:text-sidebar-foreground/40 outline-none focus:ring-1 focus:ring-sidebar-foreground/50"
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button 
                onClick={handleSearch} 
                disabled={searchLoading}
                className="bg-sidebar-primary text-sidebar-primary-foreground p-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                {searchLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="w-full text-left text-xs p-2 rounded bg-sidebar-accent hover:bg-sidebar-accent/80 transition min-h-[40px]"
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

          <div className={`border-b border-sidebar-border shrink-0 flex items-center justify-between gap-2 ${isMobile ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
            <LanguageSelector />
            <div className="relative flex items-center gap-1.5" ref={layerMenuRef}>
              <button
                onClick={() => setLayerMenuOpen(!layerMenuOpen)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded transition min-h-[36px] ${layerMenuOpen ? 'bg-green-500/20 text-green-400' : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/60'}`}
                title="Capas de mapa"
              >
                <MapIcon className="w-3.5 h-3.5" />
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
                      className={`w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 transition min-h-[36px] ${mapLayer === key ? 'bg-green-500/20 text-green-400 font-medium' : 'hover:bg-sidebar-accent'}`}
                    >
                      {key === 'satellite' ? <Satellite className="w-3 h-3" /> : key === 'topo' ? <MapIcon className="w-3 h-3" /> : key === 'cycle' ? <Navigation className="w-3 h-3" /> : <MapIcon className="w-3 h-3" />}
                      {config.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                const b = boundsRef.current;
                if (!b) return;
                const url = `https://es.wikiloc.com/rutas?bbox=${b.west},${b.south},${b.east},${b.north}`;
                window.open(url, '_blank');
              }}
              className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded transition min-h-[36px] text-sidebar-foreground/40 hover:text-sidebar-foreground/60 hover:bg-sidebar-accent"
              title="Veure rutes a Wikiloc"
            >
              <MapIcon className="w-3.5 h-3.5" />
              Wikiloc
            </button>
          </div>

          <div className="flex border-b border-sidebar-border shrink-0">
            {([
              { key: 'categories', icon: Layers, label: 'filters' },
              { key: 'downloads', icon: Download, label: 'downloads' },
              { key: 'route', icon: Route, label: 'route' },
              { key: 'saved', icon: Save, label: 'saved' },
              { key: 'track', icon: Navigation, label: 'track' },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setSidebarTab(key)}
                className={`flex-1 py-2 text-xs flex flex-col items-center gap-1 transition min-h-[44px] ${sidebarTab === key ? 'text-sidebar-primary border-b-2 border-sidebar-primary' : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80'}`}
              >
                <Icon className="w-4 h-4" />
                {t(`tabs.${label}`)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">
            {sidebarTab === 'categories' && (
              <div className="space-y-3">
                {totalPOICount > 0 && (
                  <div className="flex items-center gap-2 text-xs bg-sidebar-accent/50 rounded-lg px-2 py-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-sidebar-foreground/60">
                      {totalPOICount.toLocaleString()} POIs · {downloadedRegions.length} regiones
                    </span>
                  </div>
                )}

                {totalPOICount === 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-yellow-400 mb-1">⚠️ Sin datos descargados</p>
                    <p className="text-xs text-sidebar-foreground/50">
                      Ve a la pestaña <button onClick={() => setSidebarTab('downloads')} className="text-sidebar-primary underline">Descargas</button> para descargar regiones
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setShowBestOnly(!showBestOnly)}
                  className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-sm font-medium transition shadow-sm ${showBestOnly ? 'bg-gradient-to-r from-yellow-500/30 to-amber-500/20 text-yellow-400 border-2 border-yellow-500/50' : 'bg-sidebar-accent text-sidebar-foreground border-2 border-transparent hover:border-yellow-500/30'}`}
                >
                  <span className="text-xl">🏆</span>
                  <span className="flex-1 text-left font-semibold">{showBestOnly ? 'Mostrant millors llocs' : 'Tots els llocs'}</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${showBestOnly ? 'bg-yellow-500 text-black' : 'bg-sidebar-border'}`}>
                    {showBestOnly ? '✓' : ''}
                  </div>
                </button>
                
                <div className="border-t border-sidebar-border pt-3">
                  <p className="text-xs text-sidebar-foreground/50 mb-2 font-medium">CATEGORIES</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.entries(CATEGORY_CONFIG) as [POICategory, typeof CATEGORY_CONFIG[POICategory]][]).map(([key, config]) => {
                      const isActive = activeCategories.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCategory(key)}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs transition-all ${isActive ? 'bg-gradient-to-b from-sidebar-accent to-sidebar-accent/80 shadow-md border' : 'bg-sidebar-accent/30 hover:bg-sidebar-accent/50 text-sidebar-foreground/50'}`}
                          style={isActive ? { borderColor: config.color } : {}}
                        >
                          <span className={`text-xl mb-0.5 transition-transform ${isActive ? 'scale-110' : 'scale-100'}`}>{config.emoji}</span>
                          <span className={`text-center leading-tight text-[10px] ${isActive ? 'text-sidebar-foreground font-medium' : ''}`}>
                            {t(`categories.${key}`).split(' ')[0]}
                          </span>
                          <div 
                            className={`w-1.5 h-1.5 rounded-full mt-0.5 transition-all ${isActive ? 'scale-100' : 'scale-0'}`}
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

            {sidebarTab === 'downloads' && (
              <DownloadManager onDownloadComplete={handleDownloadComplete} />
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
                          <MapIcon className="w-3.5 h-3.5" />
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
                          <MapIcon className="w-3.5 h-3.5" />
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

      {!isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 z-[1001] bg-sidebar text-sidebar-foreground p-2 rounded-r-lg shadow-lg hover:bg-sidebar-accent transition"
          style={{ left: sidebarOpen ? '320px' : '0' }}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      )}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`absolute z-[1002] bg-sidebar text-sidebar-foreground p-3 rounded-full shadow-xl hover:bg-sidebar-accent transition-all ${
            sidebarOpen 
              ? 'bottom-[86vh] left-1/2 -translate-x-1/2' 
              : 'bottom-4 left-1/2 -translate-x-1/2'
          }`}
        >
          {sidebarOpen ? <ChevronLeft className="w-5 h-5 rotate-90" /> : <ChevronRight className="w-5 h-5 rotate-90" />}
        </button>
      )}

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
        className={`absolute z-[1001] p-2.5 rounded-lg shadow-lg transition flex items-center justify-center ${
          isMobile ? 'top-4 left-4' : 'top-4 left-4'
        } ${
          userLocation 
            ? 'bg-blue-500 text-white hover:bg-blue-600' 
            : 'bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent'
        }`}
        title="Mi ubicación"
      >
        <Crosshair className="w-5 h-5" />
      </button>

      <button
        onClick={() => {
          const willShow = !showMarkers;
          setShowMarkers(willShow);
          if (willShow) {
            setAllPois([]);
            lastLoadedBoundsRef.current = null;
            const b = boundsRef.current;
            if (b) {
              loadPOIs(b, currentZoomRef.current);
            }
          }
        }}
        className={`absolute z-[1001] p-2.5 rounded-lg shadow-lg transition flex items-center justify-center ${
          isMobile ? 'top-4 left-14' : 'top-4 left-14'
        } ${
          showMarkers 
            ? 'bg-green-500 text-white hover:bg-green-600' 
            : 'bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent'
        }`}
        title={showMarkers ? 'Ocultar marcadors' : 'Mostrar marcadors'}
      >
        {showMarkers ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
      </button>
      <div className="absolute z-[1001] left-2 bottom-2 flex flex-col gap-1">
        <button
          onClick={() => setCategoriesMinimized(!categoriesMinimized)}
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent"
          title={categoriesMinimized ? 'Mostrar categories' : 'Minimizar categories'}
        >
          {categoriesMinimized ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
        {!categoriesMinimized && (
          <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {(Object.entries(CATEGORY_CONFIG) as [POICategory, typeof CATEGORY_CONFIG[POICategory]][]).slice(0, 10).map(([key, config]) => {
              const isActive = activeCategories.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${isActive ? 'ring-4 ring-white scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                  style={{ backgroundColor: config.color }}
                  title={t(`categories.${key}`)}
                >
                  <span className="text-lg">{config.emoji}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div 
        className="flex-1 relative"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <MapContainer center={[41.3874, 2.1686]} zoom={13} className="h-full w-full" zoomControl={false}>
          <FixMapSize />
          <TileLayer
            key={mapLayer}
            attribution={MAP_LAYERS[mapLayer].attribution}
            url={MAP_LAYERS[mapLayer].url}
          />
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

          {showMarkers && filteredPois.map((poi) => (
            <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={createCategoryIcon(poi)}>
              <Popup maxWidth={isMobile ? 280 : 380} className={isMobile ? 'mobile-popup' : ''}>
                <div style={{ 
                  minWidth: isMobile ? 'calc(100vw - 40px)' : '320px', 
                  maxWidth: isMobile ? 'calc(100vw - 40px)' : '380px',
                  width: isMobile ? 'calc(100vw - 40px)' : 'auto',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  background: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                }}>
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
                  
                  <div style={{ padding: '6px 10px' }}>
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
                      {poi.phone && /^[\d+\-() ]+$/.test(poi.phone) && (
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
                      {poi.website && poi.website.startsWith('http') && (
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
                    
                    <WikipediaInfo 
                      poiName={poi.name} 
                      wikipediaTag={poi.tags?.wikipedia} 
                      wikidataTag={poi.tags?.wikidata}
                      category={poi.category}
                    />
                    
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

          {routePoints.map((p, i) => (
            <Marker key={`waypoint-${p.id}`} position={[p.lat, p.lng]}>
              <Popup>
                <div className="text-xs font-medium">{i + 1}. {p.name}</div>
              </Popup>
            </Marker>
          ))}

          {trackPoints.length > 1 && (
            <Polyline
              positions={trackPoints.map((p) => [p.lat, p.lng] as L.LatLngTuple)}
              color="#E53935"
              weight={3}
            />
          )}

          {showMarkers && visibleCampingCarPOIs.map((poi) => (
            <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={createCategoryIcon(poi)}>
              <Popup maxWidth={280}>
                <div style={{ padding: '8px' }}>
                  <h3 style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 4px 0' }}>{poi.name}</h3>
                  <span style={{ fontSize: '12px', color: '#666' }}>{CATEGORY_CONFIG[poi.category]?.label}</span>
                </div>
              </Popup>
            </Marker>
          ))}

        </MapContainer>
      </div>

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

      {/* Right side filters - only when sidebar is closed */}
      {!sidebarOpen && (
        <>
          <button
            onClick={() => setFiltersMinimized(!filtersMinimized)}
            className={`absolute z-[1001] right-2 bottom-2 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg shrink-0 ${filtersMinimized ? 'bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
            title={filtersMinimized ? 'Mostrar filtros' : 'Minimizar filtros'}
          >
            {filtersMinimized ? <ChevronLeft className="w-5 h-5 rotate-90" /> : <ChevronRight className="w-5 h-5 rotate-90" />}
          </button>
          {!filtersMinimized && (
            <div className="absolute z-[1001] right-2 bottom-12 top-12 flex flex-col gap-1 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide">
              <button
                onClick={() => setShowBestOnly(!showBestOnly)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg shrink-0 ${showBestOnly ? 'ring-4 ring-yellow-400 scale-110 bg-gradient-to-br from-yellow-400 to-amber-500' : 'opacity-60 hover:opacity-100 hover:scale-105 bg-gradient-to-br from-yellow-300 to-yellow-500'}`}
                title={showBestOnly ? 'Mostrant millors llocs' : 'Tots els llocs'}
              >
                <span className="text-lg">🏆</span>
              </button>
              {(Object.entries(CATEGORY_CONFIG) as [POICategory, typeof CATEGORY_CONFIG[POICategory]][]).slice(10).map(([key, config]) => {
                const isActive = activeCategories.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleCategory(key)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg shrink-0 ${isActive ? 'ring-4 ring-white scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                    style={{ backgroundColor: config.color }}
                    title={t(`categories.${key}`)}
                  >
                    <span className="text-lg">{config.emoji}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
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
