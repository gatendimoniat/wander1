import { POI, POICategory, Bounds } from './types';

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
        store.createIndex('regionCategory', ['regionId', 'category'], { unique: false });
        store.createIndex('regionId', 'regionId', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('location', ['lat', 'lng'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePOIs(pois: POI[], regionId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const poi of pois) {
      const record = { ...poi, regionId };
      store.put(record);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPOIsByRegionAndCategory(
  regionId: string,
  category?: POICategory
): Promise<POI[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('regionCategory');

    const pois: POI[] = [];

    if (category) {
      const range = IDBKeyRange.bound([regionId, category], [regionId, category + '\uffff']);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          pois.push(cursor.value);
          cursor.continue();
        }
      };

      request.onerror = () => reject(request.error);
    } else {
      const range = IDBKeyRange.bound([regionId, ''], [regionId, '\uffff']);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          pois.push(cursor.value);
          cursor.continue();
        }
      };

      request.onerror = () => reject(request.error);
    }

    tx.oncomplete = () => resolve(pois);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPOIsInBounds(
  bounds: Bounds,
  categories: POICategory[],
  downloadedRegions: string[]
): Promise<POI[]> {
  if (downloadedRegions.length === 0) return [];

  const allPois: POI[] = [];

  for (const regionId of downloadedRegions) {
    const regionPois = await getPOIsByRegionAndCategory(regionId);
    allPois.push(...regionPois);
  }

  const filtered = allPois.filter(poi => {
    const inBounds = poi.lat >= bounds.south &&
                     poi.lat <= bounds.north &&
                     poi.lng >= bounds.west &&
                     poi.lng <= bounds.east;
    const inCategories = categories.length === 0 || categories.includes(poi.category);
    return inBounds && inCategories;
  });

  return filtered.sort((a, b) => (b.importance || 0) - (a.importance || 0));
}

export async function deletePOIsByRegion(regionId: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('regionId');
    const range = IDBKeyRange.only(regionId);

    let count = 0;

    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        count++;
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deletePOIsByRegionAndCategory(regionId: string, category: POICategory): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('regionCategory');
    const range = IDBKeyRange.bound([regionId, category], [regionId, category + '\uffff']);

    let count = 0;

    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        count++;
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllPOIs(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const countRequest = store.count();
    countRequest.onsuccess = () => {
      const count = countRequest.result;
      store.clear();
      resolve(count);
    };

    countRequest.onerror = () => reject(countRequest.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPOICount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getDownloadedRegionsWithCounts(): Promise<{ regionId: string; count: number }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('regionId');

    const regionCounts: Map<string, number> = new Map();

    const request = index.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const regionId = cursor.value.regionId;
        regionCounts.set(regionId, (regionCounts.get(regionId) || 0) + 1);
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => {
      const result = Array.from(regionCounts.entries()).map(([regionId, count]) => ({
        regionId,
        count,
      }));
      resolve(result);
    };
    tx.onerror = () => reject(tx.error);
  });
}
