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
        const { bounds, categories, showBestOnly, zoom, maxResults, queryId } = payload;
        if (!tree) {
          self.postMessage({ type: 'queryResult', payload: { pois: [], queryId } });
          return;
        }

        const { south, west, north, east } = bounds;
        const results = tree.search({ minX: west, minY: south, maxX: east, maxY: north });
        let filtered = results.map(item => item.poi);

        if (categories && categories.length > 0) {
          filtered = filtered.filter((poi: POI) => categories.includes(poi.category));
        }

        if (showBestOnly) {
          filtered = filtered.filter((poi: POI) => poi.isBest);
        }

        const importanceThreshold = zoom >= 15 ? 0
          : zoom >= 13 ? 0.3
          : zoom >= 11 ? 0.5
          : zoom >= 9 ? 0.7
          : 0.85;
        filtered = filtered.filter((poi: POI) => (poi.importance ?? 1) >= importanceThreshold);

        if (filtered.length > maxResults) {
          filtered.sort((a: POI, b: POI) => (b.importance ?? 1) - (a.importance ?? 1));
          filtered = filtered.slice(0, maxResults);
        }

        self.postMessage({ type: 'queryResult', payload: { pois: filtered, queryId } });
      } catch (error) {
        self.postMessage({ type: 'error', payload: { error: (error as Error).message, queryId: payload.queryId } });
      }
      break;
  }
};
