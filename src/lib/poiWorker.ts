import RBush from 'rbush';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface POI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  category: string;
  importance?: number;
  isBest?: boolean;
  regionId?: string;
}

interface RBushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  poi: POI;
}

// ─── Helper: distancia Haversine en km ──────────────────────────────────────
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
             Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
             Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── POIs máximos por zoom ──────────────────────────────────────────────────
function maxPOIsForZoom(zoom: number): number {
  if (zoom >= 14) return 300;
  if (zoom >= 12) return 150;
  return 50;
}

// ─── Radio en km por zoom ───────────────────────────────────────────────────
function radiusKmForZoom(zoom: number): number {
  if (zoom >= 14) return 2;
  if (zoom >= 12) return 8;
  if (zoom >= 10) return 20;
  return 40;
}

// ─── Estado del Worker ───────────────────────────────────────────────────────
let tree: RBush<RBushItem> | null = null;
let allPOIs: POI[] = [];

// ─── Helpers IndexedDB ──────────────────────────────────────────────────────
const DB_NAME = 'explorawander-pois';
const DB_VERSION = 1;
const STORE_NAME = 'pois';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('regionId', 'regionId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadAllPOIs(): Promise<POI[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as POI[]);
    request.onerror = () => reject(request.error);
  });
}

function buildTree(pois: POI[]) {
  tree = new RBush<RBushItem>(16);
  const items: RBushItem[] = pois.map(poi => ({
    minX: poi.lng,
    minY: poi.lat,
    maxX: poi.lng,
    maxY: poi.lat,
    poi,
  }));
  tree.load(items);
  allPOIs = pois;
  self.postMessage({ type: 'log', payload: { message: `Árbol construido con ${pois.length} POIs` } });
}

// ─── Manejador de mensajes ──────────────────────────────────────────────────
self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'rebuild':
      try {
        self.postMessage({ type: 'log', payload: { message: `Rebuild: cargando POIs de IndexedDB...` } });
        const pois = await loadAllPOIs();
        self.postMessage({ type: 'log', payload: { message: `Rebuild: ${pois.length} POIs cargados de IndexedDB` } });
        if (pois.length > 0) {
          self.postMessage({ type: 'log', payload: { message: `Rebuild: ejemplo POI: ${JSON.stringify(pois[0]).substring(0, 100)}` } });
        }
        buildTree(pois);
        self.postMessage({ type: 'rebuildComplete', payload: { count: pois.length, queryId: payload.queryId } });
      } catch (error) {
        self.postMessage({ type: 'error', payload: { error: (error as Error).message, queryId: payload.queryId } });
      }
      break;

    case 'addPOIs':
      try {
        const { pois: newPois, regionId, queryId } = payload;
        const poisWithRegion = newPois.map((poi: POI) => ({ ...poi, regionId }));
        const newItems: RBushItem[] = poisWithRegion.map(poi => ({
          minX: poi.lng,
          minY: poi.lat,
          maxX: poi.lng,
          maxY: poi.lat,
          poi,
        }));
        allPOIs = [...allPOIs, ...poisWithRegion];
        if (tree) {
          tree.load(newItems); // Inserción incremental, no reconstrucción
        } else {
          buildTree(allPOIs);
        }
        self.postMessage({ type: 'addComplete', payload: { count: newPois.length, queryId } });
      } catch (error) {
        self.postMessage({ type: 'error', payload: { error: (error as Error).message, queryId: payload.queryId } });
      }
      break;

    case 'removeRegion':
      try {
        const { regionId, queryId } = payload;
        allPOIs = allPOIs.filter(poi => poi.regionId !== regionId);
        buildTree(allPOIs);
        self.postMessage({ type: 'removeComplete', payload: { count: allPOIs.length, queryId } });
      } catch (error) {
        self.postMessage({ type: 'error', payload: { error: (error as Error).message, queryId: payload.queryId } });
      }
      break;

    case 'query':
      try {
        const queryStart = performance.now();
        const { bounds, categories, showBestOnly, zoom, maxResults: maxResultsOverride, queryId } = payload;
        if (!tree) {
          self.postMessage({ type: 'queryResult', payload: { pois: [], queryId } });
          return;
        }

        const { south, west, north, east } = bounds;

        // Validar y corregir bounds inválidos (south==north o west==east)
        let s = south, w = west, n = north, e = east;
        if (Math.abs(n - s) < 0.001) { s -= 0.01; n += 0.01; }
        if (Math.abs(e - w) < 0.001) { w -= 0.01; e += 0.01; }

        // Centro del viewport
        const centerLat = (s + n) / 2;
        const centerLng = (w + e) / 2;
        const maxRadius = radiusKmForZoom(zoom);
        const maxResults = maxPOIsForZoom(zoom);

        // Log temporal para debug (usar variables corregidas)
        console.log(`[Worker] bounds: S${s.toFixed(4)} W${w.toFixed(4)} N${n.toFixed(4)} E${e.toFixed(4)}`);
        console.log(`[Worker] center: ${centerLat.toFixed(4)},${centerLng.toFixed(4)} radio:${maxRadius}km`);

        // 1. Consulta R-Tree por bbox (usar bounds corregidos)
        const raw = tree.search({ minX: w, minY: s, maxX: e, maxY: n });

        // 2. Filtrar por categoría, importancia y radio
        const importanceThreshold = zoom >= 15 ? 0
          : zoom >= 13 ? 0.3
          : zoom >= 11 ? 0.5
          : zoom >= 9 ? 0.7
          : 0.85;

        const candidates: Array<{ poi: POI; dist: number }> = [];

        for (const item of raw) {
          const poi = item.poi;

          if (categories && categories.length > 0 && !categories.includes(poi.category)) continue;
          if (showBestOnly && !poi.isBest) continue;
          if ((poi.importance ?? 1) < importanceThreshold) continue;

          // Filtro por radio
          const dist = distKm(centerLat, centerLng, poi.lat, poi.lng);
          if (dist > maxRadius) continue;

          candidates.push({ poi, dist });
        }

        // 3. Ordenar por importancia DESC, luego distancia ASC
        candidates.sort((a, b) => {
          const impDiff = (b.poi.importance ?? 1) - (a.poi.importance ?? 1);
          return impDiff !== 0 ? impDiff : a.dist - b.dist;
        });

         const result = candidates.slice(0, maxResults).map(c => c.poi);

        // Log temporal para verificar filtros
        const queryElapsed = Math.round(performance.now() - queryStart);
        console.log(`[Worker] zoom:${zoom} radio:${maxRadius}km resultado:${result.length}/${candidates.length} candidatos (${queryElapsed}ms)`);

        self.postMessage({ type: 'queryResult', payload: { pois: result, queryId } });
      } catch (error) {
        self.postMessage({ type: 'error', payload: { error: (error as Error).message, queryId: payload.queryId } });
      }
      break;
  }
};
