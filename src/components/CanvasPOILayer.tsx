import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORY_CONFIG } from '@/lib/types';
import type { POI, POICategory } from '@/lib/types';
import poiSpatialIndex from '@/lib/poiSpatialIndex';

interface Props {
  activeCategories?: POICategory[];
  showBestOnly?: boolean;
  visible?: boolean;
  campingCarPOIs?: POI[];
  onPoiClick?: (poi: POI) => void;
}

function circleRadius(zoom: number): number {
  if (zoom >= 14) return 16;
  if (zoom >= 12) return 14;
  if (zoom >= 10) return 12;
  return 10;
}

export function CanvasPOILayer({
  activeCategories = [],
  showBestOnly = false,
  visible = true,
  campingCarPOIs = [],
  onPoiClick,
}: Props) {
  const map = useMap();
  const layerGroup = useRef<L.LayerGroup>(L.layerGroup());
  const markers    = useRef<Map<string, L.Marker>>(new Map());
  const debounce    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBounds  = useRef<{ south: number; west: number; north: number; east: number } | null>(null);
  const lastZoom    = useRef<number>(0);
  const readyRef  = useRef(false);

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

  const refresh = useCallback(async () => {
    if (!visible || !readyRef.current) return;

    const lb   = map.getBounds();
    const zoom = map.getZoom();

    if (Math.abs(lb.getNorth() - lb.getSouth()) < 0.0001) {
      setTimeout(refresh, 300);
      return;
    }

    const bounds = {
      south: lb.getSouth(), west: lb.getWest(),
      north: lb.getNorth(), east: lb.getEast(),
    };

    // Evitar refresh si bounds y zoom no han cambiado (evita parpadeo)
    const last = lastBounds.current;
    if (last &&
        last.south === bounds.south && last.north === bounds.north &&
        last.west === bounds.west && last.east === bounds.east &&
        lastZoom.current === zoom) {
      return;
    }
    lastBounds.current = bounds;
    lastZoom.current = zoom;

    const t0 = performance.now();

    let pois: POI[] = [];
    try {
      console.log('[T0.8] llamando query...');
      pois = poiSpatialIndex.query(bounds, {
        categories: activeCategories,
        showBestOnly,
        zoom,
      });
      console.log(`[T1] query: ${(performance.now()-t0).toFixed(0)}ms, ${pois.length} POIs`);
    } catch (err) {
      console.error('[CanvasPOI] Error en query:', err);
      pois = [];
    }

    const extraPOIs = campingCarPOIs.filter(p =>
      p.lat >= bounds.south && p.lat <= bounds.north &&
      p.lng >= bounds.west  && p.lng <= bounds.east &&
      (activeCategories.length === 0 || activeCategories.includes(p.category as POICategory))
    );

    const allPOIs  = [...pois, ...extraPOIs];
    const radius   = circleRadius(zoom);
    const lg       = layerGroup.current;
    const prev     = markers.current;

    // Limpiar TODOS los markers anteriores de golpe
    lg.clearLayers();
    prev.clear();

    console.log(`[Batch] creando ${allPOIs.length} markers nuevos`);

    const t1 = performance.now();
    let addedCount = 0;

    // Crear TODOS los markers de una vez (sin batches)
    for (const poi of allPOIs) {
      const cfg = CATEGORY_CONFIG[poi.category as POICategory] ?? CATEGORY_CONFIG['default'];

      // Usar divIcon para que los clicks sean nativos inmediatos
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: ${radius*2}px;
          height: ${radius*2}px;
          background: ${cfg.color};
          border-radius: 50%;
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${radius}px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">${cfg.emoji}</div>`,
        iconSize: [radius*2, radius*2],
        iconAnchor: [radius, radius],
      });

      const marker = L.marker([poi.lat, poi.lng], {
        icon,
        bubblingMouseEvents: false,
      });

      if (onPoiClick) {
        marker.on('click', (e) => {
          console.log('[T3] click recibido en:', poi.name);
          L.DomEvent.stopPropagation(e);
          onPoiClick(poi);
        });
      }

      marker.addTo(lg);
      prev.set(poi.id, marker);
      addedCount++;
    }

    console.log(`[T2] todos markers listos: ${(performance.now()-t1).toFixed(0)}ms (${addedCount} nuevos)`);
    console.log(`[Ttotal] refresh completo: ${(performance.now()-t0).toFixed(0)}ms`);
  }, [map, visible, activeCategories, showBestOnly, campingCarPOIs, onPoiClick]);

  const debouncedRefresh = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(refresh, 280);
  }, [refresh]);

  useEffect(() => {
    if (visible) {
      layerGroup.current.addTo(map);
      debouncedRefresh();
    } else {
      layerGroup.current.remove();
    }
  }, [visible]);

  useEffect(() => {
    debouncedRefresh();
  }, [activeCategories, showBestOnly, debouncedRefresh]);

  useMapEvents({
    moveend: debouncedRefresh,
    zoomend: debouncedRefresh,
  });

  return null;
}
