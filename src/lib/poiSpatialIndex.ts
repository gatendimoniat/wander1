import RBush from 'rbush';
import type { POI, Bounds, POICategory } from './types';

interface RBushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  poi: POI;
}

let tree: RBush<RBushItem> | null = null;
let allPOIs: POI[] = [];
let isReady = false;
const readyCallbacks: Array<() => void> = [];

// ─── Helpers IndexedDB ──────────────────────────────────────────────

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
  console.log(`[POI Index] Árbol construido con ${pois.length} POIs`);
}

// ─── Funciones de consulta síncrona ─────────────────────────────────

function radiusKmForZoom(zoom: number): number {
  if (zoom >= 14) return 2;
  if (zoom >= 12) return 8;
  if (zoom >= 10) return 20;
  return 40;
}

function maxPOIsForZoom(zoom: number): number {
  if (zoom >= 15) return 300;
  if (zoom >= 13) return 150;
  if (zoom >= 11) return 80;
  return 50;
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
             Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
             Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── API pública ─────────────────────────────────────────────────────

export default {
  isReadyForQueries(): boolean {
    return isReady;
  },

  onReady(cb: () => void): void {
    if (isReady) { cb(); return; }
    readyCallbacks.push(cb);
  },

  async rebuildFromIndexedDB(): Promise<number> {
    const pois = await loadAllPOIs();
    buildTree(pois);
    isReady = true;
    readyCallbacks.forEach(cb => cb());
    readyCallbacks.length = 0;
    return pois.length;
  },

  async addPOIs(pois: POI[], regionId: string): Promise<void> {
    const poisWithRegion = pois.map(p => ({ ...p, regionId }));
    allPOIs = [...allPOIs, ...poisWithRegion];
    if (tree) {
      const newItems: RBushItem[] = poisWithRegion.map(poi => ({
        minX: poi.lng, minY: poi.lat, maxX: poi.lng, maxY: poi.lat, poi,
      }));
      tree.load(newItems);
    } else {
      buildTree(allPOIs);
    }
  },

  async removePOIsByRegion(regionId: string): Promise<void> {
    allPOIs = allPOIs.filter(poi => poi.regionId !== regionId);
    buildTree(allPOIs);
  },

  query(bounds: Bounds, options: {
    categories?: POICategory[];
    showBestOnly?: boolean;
    zoom: number;
    maxResults?: number;
  }): POI[] {
    if (!tree) return [];

    const { south, west, north, east } = bounds;
    const zoom = options.zoom;

    // 1. Consulta R-Tree por bbox
    const raw = tree.search({ minX: west, minY: south, maxX: east, maxY: north });

    // 2. Filtrar por categoría, importancia y radio
    const maxRadius = radiusKmForZoom(zoom);
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;

    const importanceThreshold = zoom >= 15 ? 0
      : zoom >= 13 ? 0.3
      : zoom >= 11 ? 0.5
      : zoom >= 9 ? 0.7
      : 0.85;

    const candidates: Array<{ poi: POI; dist: number }> = [];

    for (const item of raw) {
      const poi = item.poi;

      if (options.categories && options.categories.length > 0 && !options.categories.includes(poi.category as POICategory)) continue;
      if (options.showBestOnly && !poi.isBest) continue;
      if ((poi.importance ?? 1) < importanceThreshold) continue;

      const dist = distKm(centerLat, centerLng, poi.lat, poi.lng);
      if (dist > maxRadius) continue;

      candidates.push({ poi, dist });
    }

    // 3. Ordenar por importancia DESC, luego distancia ASC
    candidates.sort((a, b) => {
      const impDiff = (b.poi.importance ?? 1) - (a.poi.importance ?? 1);
      return impDiff !== 0 ? impDiff : a.dist - b.dist;
    });

    const maxResults = options.maxResults || maxPOIsForZoom(zoom);
    return candidates.slice(0, maxResults).map(c => c.poi);
  },

  waitUntilReady(timeoutMs: number = 10000): Promise<void> {
    if (isReady) return Promise.resolve();
    return new Promise((resolve) => {
      const cb = () => {
        readyCallbacks.splice(readyCallbacks.indexOf(cb), 1);
        resolve();
      };
      readyCallbacks.push(cb);
      setTimeout(() => {
        const idx = readyCallbacks.indexOf(cb);
        if (idx !== -1) {
          readyCallbacks.splice(idx, 1);
          resolve();
        }
      }, timeoutMs);
    });
  }
};
