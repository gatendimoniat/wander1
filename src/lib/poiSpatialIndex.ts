import type { POI, Bounds, POICategory } from './types';

type WorkerMessage = {
  type: string;
  payload?: any;
};

class POISpatialIndex {
  private worker: Worker | null = null;
  private pendingPromises: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private messageId = 0;
  private readyPromise: Promise<void> | null = null;
  private readyResolver: (() => void) | null = null;
  private readyCallbacks: Array<() => void> = [];
  private isReady = false;

  constructor() {
    if (typeof window !== 'undefined' && 'Worker' in window) {
      try {
        this.worker = new Worker(new URL('./poiWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (error) => console.error('[POI Index] Error en worker:', error);
      } catch (error) {
        console.error('[POI Index] No se pudo inicializar el worker:', error);
      }
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { type, payload } = event.data;
    const queryId = payload?.queryId;

    if (queryId && this.pendingPromises.has(queryId)) {
      const promise = this.pendingPromises.get(queryId)!;
      switch (type) {
        case 'rebuildComplete':
          this.isReady = true;
          promise.resolve(payload);
          // Resolver también la promesa de ready pendiente
          if (this.readyResolver) {
            this.readyResolver();
            this.readyResolver = undefined;
          }
          // Notificar a los callbacks de onReady
          this.notifyReady();
          break;
        case 'addComplete':
        case 'removeComplete':
          promise.resolve(payload);
          break;
        case 'queryResult':
          promise.resolve(payload.pois);
          break;
        case 'error':
          promise.reject(new Error(payload.error));
          // También resolver ready promise en caso de error
          if (this.readyResolver) {
            this.readyResolver();
            this.readyResolver = undefined;
          }
          break;
      }
      this.pendingPromises.delete(queryId);
    } else if (type === 'rebuildComplete') {
      this.isReady = true;
      // Resolver la promesa de ready pendiente
      if (this.readyResolver) {
        this.readyResolver();
        this.readyResolver = undefined;
      }
      // Notificar a los callbacks de onReady
      this.notifyReady();
    } else if (type === 'log') {
      console.log(`[POI Worker] ${payload.message}`);
    }
  }

  isReadyForQueries(): boolean {
    return this.isReady;
  }

  onReady(cb: () => void): void {
    if (this.isReady) { cb(); return; }
    this.readyCallbacks.push(cb);
  }

  private notifyReady(): void {
    this.isReady = true;
    this.readyCallbacks.forEach(cb => cb());
    this.readyCallbacks = [];
  }

  async waitUntilReady(timeoutMs: number = 10000): Promise<void> {
    if (this.isReady) return Promise.resolve();
    if (this.readyPromise) return this.readyPromise;
    
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolver = resolve;
      
      // If it becomes ready while we're setting up, resolve immediately
      if (this.isReady) {
        this.readyResolver();
        this.readyResolver = undefined;
        return;
      }
      
      // Timeout to prevent hanging forever
      setTimeout(() => {
        if (!this.isReady) {
          console.warn('[POI Index] Timeout esperando a que el índice esté listo');
          this.readyResolver = undefined;
          this.readyPromise = null;
          resolve(); // Resolve anyway to continue
        }
      }, timeoutMs);
    });
    
    return this.readyPromise;
  }

  async rebuildFromIndexedDB(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker no disponible'));
        return;
      }
      const id = String(this.messageId++);
      console.log('[POI Index] Enviando rebuild con queryId:', id);
      this.pendingPromises.set(id, { 
        resolve: (v: any) => {
          console.log('[POI Index] Rebuild completado, count:', v.count);
          resolve(v.count);
        }, 
        reject 
      });
      this.worker.postMessage({ type: 'rebuild', payload: { queryId: id } });
    });
  }

  async addPOIs(pois: POI[], regionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker no disponible'));
        return;
      }
      const id = String(this.messageId++);
      this.pendingPromises.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'addPOIs', payload: { pois, regionId, queryId: id } });
    });
  }

  async removePOIsByRegion(regionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker no disponible'));
        return;
      }
      const id = String(this.messageId++);
      this.pendingPromises.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'removeRegion', payload: { regionId, queryId: id } });
    });
  }

  async query(bounds: Bounds, options: {
    categories?: POICategory[];
    showBestOnly?: boolean;
    zoom: number;
    maxResults?: number;
  }): Promise<POI[]> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker no disponible'));
        return;
      }
      const id = String(this.messageId++);
      this.pendingPromises.set(id, { resolve, reject });
      this.worker.postMessage({
        type: 'query',
        payload: {
          bounds,
          categories: options.categories,
          showBestOnly: options.showBestOnly,
          zoom: options.zoom,
          maxResults: options.maxResults || 400,
          queryId: id,
        },
      });
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
  }
}

const poiSpatialIndex = new POISpatialIndex();
export default poiSpatialIndex;
