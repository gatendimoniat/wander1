import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORY_CONFIG } from '@/lib/types';
import type { POI, POICategory, Bounds } from '@/lib/types';
import poiSpatialIndex from '@/lib/poiSpatialIndex';
import { getPOIsInBounds as getPOIsFromDB } from '@/lib/poiManager';

// ─── Cache de iconos ─────────────────────────────────────

interface CachedIcon {
  canvas: HTMLCanvasElement;
  size: number;
}

const iconCache = new Map<string, CachedIcon>();

// ─── Grid espacial para hit-test O(1) ────────────────────

const CELL_PX = 48;

interface GridCell {
  pois: Array<{ poi: POI; x: number; y: number }>;
}

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

// ─── Construir grid espacial para hit-test rápido ─────────

function buildHitGrid(
  pois: POI[],
  map: L.Map,
  canvasW: number,
  canvasH: number,
  paneOffset: L.Point,
  hitGridRef: React.MutableRefObject<Map<string, GridCell>>,
  gridColsRef: React.MutableRefObject<number>,
  gridRowsRef: React.MutableRefObject<number>
) {
  const grid = new Map<string, GridCell>();
  const cols = Math.ceil(canvasW / CELL_PX);
  const rows = Math.ceil(canvasH / CELL_PX);
  gridColsRef.current = cols;
  gridRowsRef.current = rows;

  for (const poi of pois) {
    const lp = map.latLngToLayerPoint(L.latLng(poi.lat, poi.lng));
    const x = lp.x - paneOffset.x;
    const y = lp.y - paneOffset.y;
    const col = Math.floor(x / CELL_PX);
    const row = Math.floor(y / CELL_PX);
    const key = `${col}:${row}`;
    if (!grid.has(key)) grid.set(key, { pois: [] });
    grid.get(key)!.pois.push({ poi, x, y });
  }

  hitGridRef.current = grid;
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

  // ── Grid espacial para hit-test rápido ─────────────────
  const hitGridRef = useRef<Map<string, GridCell>>(new Map());
  const gridColsRef = useRef(0);
  const gridRowsRef = useRef(0);

  // ── drawPOIs ──────────────────────────────────────────────

  const drawPOIs = useCallback(async () => {
    if (!visible || !canvasRef.current) return;

    // Verificar que el mapa tenga dimensiones válidas
    const mapSize = map.getSize();
    if (mapSize.x === 0 || mapSize.y === 0) {
      console.warn('[Canvas] Mapa sin dimensiones válidas, reintentando en 200ms...');
      setTimeout(() => { if (visible) drawPOIs(); }, 200);
      return;
    }

    const leafletBounds = map.getBounds();

    // Si el mapa no tiene altura aún, reintentar
    if (Math.abs(leafletBounds.getNorth() - leafletBounds.getSouth()) < 0.0001) {
      console.warn('[Canvas] bbox inválido (south==north), reintentando en 200ms...');
      setTimeout(() => { if (visible) drawPOIs(); }, 200);
      return;
    }

    // Fix defensivo: garantizar south < north y west < east
    const s = leafletBounds.getSouth();
    const n = leafletBounds.getNorth();
    const w = leafletBounds.getWest();
    const e = leafletBounds.getEast();
    const bounds: Bounds = {
      south: Math.min(s, n),
      north: Math.max(s, n),
      west:  Math.min(w, e),
      east:  Math.max(w, e),
    };
    const zoom = map.getZoom();

    try {
      let pois: POI[] = [];

      // Intentar usar el índice espacial si está listo, sino cargar desde IndexedDB
      if (readyRef.current) {
        pois = await poiSpatialIndex.query(bounds, {
          categories: activeCategories,
          showBestOnly,
          zoom,
        });
      } else {
        console.log('[CanvasPOILayer] Índice no listo, cargando desde IndexedDB...');
        pois = await getPOIsFromDB(bounds, activeCategories, []);
      }

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

      // Construir grid espacial para hit-test instantáneo
      buildHitGrid(allPois, map, canvas.width, canvas.height, paneOffset, hitGridRef, gridColsRef, gridRowsRef);
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

    // Dibujar inmediatamente sin esperar al índice espacial
    setTimeout(() => drawPOIs(), 100);

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

  // ── Hit-test con grid espacial (O(1) en lugar de O(n)) ───

  const handleCanvasClick = useCallback((e: L.LeafletMouseEvent) => {
    if (getPreventClick()) return;
    if (!onPoiClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const zoom = map.getZoom();
    const hitR = iconSizePx(zoom) / 2 + 6;

    const px = e.originalEvent.clientX - rect.left;
    const py = e.originalEvent.clientY - rect.top;

    const col = Math.floor(px / CELL_PX);
    const row = Math.floor(py / CELL_PX);
    const grid = hitGridRef.current;

    let best: { poi: POI; dist: number } | null = null;

    // Solo revisar celda tocada + 8 vecinas
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const cell = grid.get(`${col + dc}:${row + dr}`);
        if (!cell) continue;
        for (const { poi, x, y } of cell.pois) {
          const dist = Math.hypot(x - px, y - py);
          if (dist < hitR && (!best || dist < best.dist)) {
            best = { poi, dist };
          }
        }
      }
    }

    if (best) onPoiClick(best.poi);
  }, [map, onPoiClick]);

  // ── Debounce ──────────────────────────────────────────────

  const debouncedDraw = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(drawPOIs, 300);
  }, [drawPOIs]);

  useMapEvents({
    moveend: debouncedDraw,
    zoomend: debouncedDraw,
    click: handleCanvasClick,
  });

  useEffect(() => {
    debouncedDraw();
  }, [activeCategories, showBestOnly, debouncedDraw]);

  return null;
}
