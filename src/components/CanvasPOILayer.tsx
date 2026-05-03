import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORY_CONFIG } from '@/lib/types';
import type { POI, POICategory } from '@/lib/types';
import poiSpatialIndex from '@/lib/poiSpatialIndex';

// ─── Cache de iconos ─────────────────────────────────────

interface CachedIcon {
  canvas: HTMLCanvasElement;
  size: number;
}

const iconCache = new Map<string, CachedIcon>();

function buildIcon(category: POICategory, sizePx: number): CachedIcon {
  const key = `${category}:${sizePx}`;
  if (iconCache.has(key)) return iconCache.get(key)!;

  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG['default'];
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d')!;
  const cx = sizePx / 2;
  const cy = sizePx / 2;
  const r = sizePx / 2 - 2;

  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = cfg.color;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = sizePx >= 28 ? 2 : 1.5;
  ctx.stroke();

  const fontSize = Math.round(sizePx * 0.48);
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(cfg.emoji, cx, cy + 1);

  const icon = { canvas, size: sizePx };
  iconCache.set(key, icon);
  return icon;
}

function iconSizePx(zoom: number): number {
  if (zoom >= 14) return 40;  // Más grande para zoom alto
  if (zoom >= 12) return 32;  // Más grande para zoom medio
  return 26;  // Más grande para zoom bajo
}

// ─── Props ──────────────────────────────────────────────

interface Props {
  activeCategories?: POICategory[];
  showBestOnly?: boolean;
  maxResults?: number;
  visible?: boolean;
  campingCarPOIs?: POI[];
  onPoiClick?: (poi: POI) => void;
}

// ─── Componente ───────────────────────────────────────

export function CanvasPOILayer({
  activeCategories = [],
  showBestOnly = false,
  maxResults = 400,
  visible = true,
  campingCarPOIs = [],
  onPoiClick,
}: Props) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poisRef = useRef<POI[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  // Usar variable global para que ExplorerMap pueda sincronizar
  const getPreventClick = () => (window as any).preventPoiClick || false;

  // ── Función para verificar si un clic está sobre un POI ─────────

  const findPOIAtPoint = useCallback(async (clientX: number, clientY: number): Promise<POI | null> => {
    const canvas = canvasRef.current;
    if (!canvas || poisRef.current.length === 0) return null;

    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const zoom = map.getZoom();
    const hitRadius = iconSizePx(zoom) / 2 + 4;
    
    // Convertir clic a coordenadas geográficas
    const paneOffset = map.containerPointToLayerPoint([0, 0]);
    const mapPoint = L.point(clickX + paneOffset.x, clickY + paneOffset.y);
    const latLng = map.layerPointToLatLng(mapPoint);
    
    // Usar el índice espacial para búsqueda rápida
    try {
      const bounds = {
        south: latLng.lat - 0.01,
        north: latLng.lat + 0.01,
        west: latLng.lng - 0.01,
        east: latLng.lng + 0.01,
      };
      
      const pois = await poiSpatialIndex.query(bounds, {
        zoom,
        maxResults: 20,
      });
      
      // Verificar cuál está más cerca del clic
      const nearby = pois
        .map(poi => {
          const lp = map.latLngToLayerPoint(L.latLng(poi.lat, poi.lng));
          const x = lp.x - paneOffset.x;
          const y = lp.y - paneOffset.y;
          return { poi, dist: Math.hypot(x - clickX, y - clickY) };
        })
        .filter(({ dist }) => dist < hitRadius)
        .sort((a, b) => a.dist - b.dist);
      
      return nearby.length > 0 ? nearby[0].poi : null;
    } catch (err) {
      console.error('Error en findPOIAtPoint:', err);
      return null;
    }
  }, [map]);

  // ── drawPOIs ──────────────────────────────────────────────

  const drawPOIs = useCallback(async () => {
    if (!visible || !canvasRef.current) return;

    if (!readyRef.current) {
      // Si no está listo, reintentar en 500ms
      console.log('[CanvasPOILayer] Esperando a que el índice esté listo...');
      setTimeout(() => { if (visible) drawPOIs(); }, 500);
      return;
    }

    const leafletBounds = map.getBounds();
    const bounds = {
      south: leafletBounds.getSouth(),
      west: leafletBounds.getWest(),
      north: leafletBounds.getNorth(),
      east: leafletBounds.getEast(),
    };
    const zoom = map.getZoom();

    try {
      const pois = await poiSpatialIndex.query(bounds, {
        categories: activeCategories,
        showBestOnly,
        zoom,
        maxResults,
      });

      const filteredCamping = campingCarPOIs.filter(p =>
        p.lat >= bounds.south && p.lat <= bounds.north &&
        p.lng >= bounds.west && p.lng <= bounds.east &&
        (activeCategories.length === 0 || activeCategories.includes(p.category as POICategory))
      );

      const allPois = [...pois, ...filteredCamping];
      poisRef.current = allPois;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;

      const mapSize = map.getSize();
      if (canvas.width !== mapSize.x || canvas.height !== mapSize.y) {
        canvas.width = mapSize.x;
        canvas.height = mapSize.y;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const sizePx = iconSizePx(zoom);
      const half = sizePx / 2;
      const paneOffset = map.containerPointToLayerPoint([0, 0]);

      for (const poi of allPois) {
        const lp = map.latLngToLayerPoint(L.latLng(poi.lat, poi.lng));
        const x = lp.x - paneOffset.x;
        const y = lp.y - paneOffset.y;
        const icon = buildIcon(poi.category as POICategory, sizePx);
        ctx.drawImage(icon.canvas, x - half, y - half, sizePx, sizePx);
      }
    } catch (err) {
      console.error('Error dibujando POIs:', err);
    }
  }, [map, visible, activeCategories, showBestOnly, maxResults, campingCarPOIs]);

  // ── Inicializar capa ──────────────────────────────────────

  useEffect(() => {
    if (!map) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'leaflet-poi-canvas';
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      pointerEvents: 'none', // NO bloquear el mapa
      zIndex: '400',
    });
    map.getPanes().overlayPane.appendChild(canvas);
    canvasRef.current = canvas;

    // Exponer referencia al mapa para que ExplorerMap pueda verificar preventClickRef
    (canvas as any).map = map;

    // Limpiar al empezar a mover
    map.on('movestart', () => {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Reposicionar canvas
    const updatePosition = () => {
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
    };
    map.on('moveend zoomend', updatePosition);
    updatePosition();

    poiSpatialIndex.onReady(() => {
      readyRef.current = true;
      drawPOIs();
    });

    return () => {
      L.DomUtil.remove(canvas);
      canvasRef.current = null;
    };
  }, [map, visible]);

  // ── Cuando el índice esté listo, dibujar inmediatamente ─────────
   
  useEffect(() => {
    if (readyRef.current && visible) {
      drawPOIs();
    }
  }, [readyRef.current, visible]);

  // ── Ocultar/mostrar canvas según visible ────────────────
  
  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.style.display = visible ? 'block' : 'none';
    if (visible && readyRef.current) {
      drawPOIs();
    }
  }, [visible]);

  // ── Exponer findPOIAtPoint mediante una propiedad del canvas ──

  useEffect(() => {
    if (canvasRef.current) {
      (canvasRef.current as any).findPOIAtPoint = findPOIAtPoint;
    }
  }, [findPOIAtPoint]);

  // ── Debounce ──────────────────────────────────────────────

  const debouncedDraw = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(drawPOIs, 300);
  }, [drawPOIs]);

  useMapEvents({
    moveend: debouncedDraw,
    zoomend: debouncedDraw,
    click: (e) => {
      // NO procesar clics si se acaba de cerrar el popup
      if (getPreventClick()) return;
      
      // Detectar si se hizo clic en un POI
      if (onPoiClick) {
        const poi = findPOIAtPoint(e.originalEvent.clientX, e.originalEvent.clientY);
        if (poi) {
          onPoiClick(poi);
        }
      }
    },
  });

  useEffect(() => {
    debouncedDraw();
  }, [activeCategories, showBestOnly, debouncedDraw]);

  return null;
}
