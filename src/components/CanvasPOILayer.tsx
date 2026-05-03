import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORY_CONFIG } from '@/lib/types';
import type { POI, POICategory } from '@/lib/types';
import poiSpatialIndex from '@/lib/poiSpatialIndex';

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  activeCategories?: POICategory[];
  showBestOnly?: boolean;
  visible?: boolean;
  campingCarPOIs?: POI[];
  onPoiClick?: (poi: POI) => void;
}

// ─── Radio del círculo según zoom ─────────────────────────────────────

function circleRadius(zoom: number): number {
  if (zoom >= 14) return 9;
  if (zoom >= 12) return 7;
  return 5;
}

// ─── Componente ─────────────────────────────────────────────────────────

export function CanvasPOILayer({
  activeCategories = [],
  showBestOnly = false,
  visible = true,
  campingCarPOIs = [],
  onPoiClick,
}: Props) {
  const map = useMap();

  // Un renderer canvas compartido para todos los markers
  const renderer   = useRef<L.Canvas>(L.canvas({ padding: 0.5 }));
  const layerGroup = useRef<L.LayerGroup>(L.layerGroup());
  // Map de poiId → marker para reutilizar sin recrear
  const markers    = useRef<Map<string, L.CircleMarker>>(new Map());
  const debounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef   = useRef(false);

  // ── Setup inicial ──────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) layerGroup.current.addTo(map);

    poiSpatialIndex.onReady(() => {
      readyRef.current = true;
      debouncedRefresh();
    });

    return () => {
      layerGroup.current.remove();
      markers.current.clear();
    };
  }, [map]);

  // ── Función principal de refresco ─────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!visible || !readyRef.current) return;

    const lb   = map.getBounds();
    const zoom = map.getZoom();

    // Bbox inválido — mapa sin altura aún
    if (Math.abs(lb.getNorth() - lb.getSouth()) < 0.0001) {
      setTimeout(refresh, 300);
      return;
    }

    const bounds = {
      south: lb.getSouth(), west: lb.getWest(),
      north: lb.getNorth(), east: lb.getEast(),
    };

    // Consulta al R-Tree en el Worker (< 2ms)
    const pois = await poiSpatialIndex.query(bounds, {
      categories: activeCategories,
      showBestOnly,
      zoom,
    });

    // Añadir camping-car POIs si los hay
    const extraPOIs = campingCarPOIs.filter(p =>
      p.lat >= bounds.south && p.lat <= bounds.north &&
      p.lng >= bounds.west  && p.lng <= bounds.east &&
      (activeCategories.length === 0 || activeCategories.includes(p.category as POICategory))
    );

    const allPOIs  = [...pois, ...extraPOIs];
    const nextIds  = new Set(allPOIs.map(p => p.id));
    const radius   = circleRadius(zoom);
    const lg       = layerGroup.current;
    const prev     = markers.current;

    // 1. Eliminar markers que ya no están en el viewport
    for (const [id, marker] of prev) {
      if (!nextIds.has(id)) {
        marker.remove();
        prev.delete(id);
      }
    }

    // 2. Añadir nuevos (reutiliza existentes)
    for (const poi of allPOIs) {
      if (prev.has(poi.id)) {
        // Actualizar radio si cambió el zoom
        prev.get(poi.id)!.setRadius(radius);
        continue;
      }

      const cfg    = CATEGORY_CONFIG[poi.category as POICategory] ?? CATEGORY_CONFIG['default'];
      const marker = L.circleMarker([poi.lat, poi.lng], {
        renderer:    renderer.current,
        radius,
        color:       '#fff',
        weight:      1.5,
        fillColor:   cfg.color,
        fillOpacity: 0.92,
        bubblingMouseEvents: false,
      });

      // Tooltip con emoji + nombre
      marker.bindTooltip(`${cfg.emoji} ${poi.name}`, {
        permanent:  false,
        direction:  'top',
        offset:     [0, -radius - 2],
        opacity:    0.95,
        className:  'poi-tooltip-canvas',
      });

      // Click instantáneo — gestionado por Leaflet internamente
      if (onPoiClick) {
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onPoiClick(poi);
        });
      }

      marker.addTo(lg);
      prev.set(poi.id, marker);
    }
  }, [map, visible, activeCategories, showBestOnly, campingCarPOIs, onPoiClick]);

  // ── Debounce ──────────────────────────────────────────────────────────

  const debouncedRefresh = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(refresh, 280);
  }, [refresh]);

  // ── Visibilidad ───────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      layerGroup.current.addTo(map);
      debouncedRefresh();
    } else {
      layerGroup.current.remove();
    }
  }, [visible]);

  // ── Filtros ───────────────────────────────────────────────────────────

  useEffect(() => {
    debouncedRefresh();
  }, [activeCategories, showBestOnly, debouncedRefresh]);

  // ── Eventos del mapa ─────────────────────────────────────────────────

  useMapEvents({
    moveend: debouncedRefresh,
    zoomend: debouncedRefresh,
  });

  return null;
}
