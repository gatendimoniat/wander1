import { POICategory } from './types';
import { ALL_REGIONS, RegionConfig } from './regionsConfig';

export interface DownloadEntry {
  id: string;
  regionId: string;
  regionName: string;
  category: POICategory | 'all';
  poiCount: number;
  downloadedAt: string;
  version: string;
  bounds: { south: number; west: number; north: number; east: number };
}

const REGISTRY_KEY = 'explorawander-download-registry';
const CURRENT_VERSION = '1.0';

function getRegistry(): DownloadEntry[] {
  try {
    const data = localStorage.getItem(REGISTRY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRegistry(registry: DownloadEntry[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

export function getDownloads(): DownloadEntry[] {
  return getRegistry();
}

export function getDownloadedRegionIds(): string[] {
  const registry = getRegistry();
  return [...new Set(registry.map(d => d.regionId))];
}

export function isRegionDownloaded(regionId: string, category?: POICategory): boolean {
  const registry = getRegistry();
  if (category) {
    return registry.some(d => d.regionId === regionId && (d.category === 'all' || d.category === category));
  }
  return registry.some(d => d.regionId === regionId);
}

export function addDownload(entry: Omit<DownloadEntry, 'id' | 'downloadedAt' | 'version'>): DownloadEntry {
  const registry = getRegistry();
  const existingIndex = registry.findIndex(
    d => d.regionId === entry.regionId && d.category === entry.category
  );

  const newEntry: DownloadEntry = {
    ...entry,
    id: `${entry.regionId}-${entry.category}`,
    downloadedAt: new Date().toISOString(),
    version: CURRENT_VERSION,
  };

  if (existingIndex >= 0) {
    registry[existingIndex] = newEntry;
  } else {
    registry.push(newEntry);
  }

  saveRegistry(registry);
  return newEntry;
}

export function removeDownload(id: string): void {
  const registry = getRegistry().filter(d => d.id !== id);
  saveRegistry(registry);
}

export function removeRegionDownloads(regionId: string): void {
  const registry = getRegistry().filter(d => d.regionId !== regionId);
  saveRegistry(registry);
}

export function clearAllDownloads(): void {
  saveRegistry([]);
}

export function getRegionById(regionId: string): RegionConfig | undefined {
  return ALL_REGIONS.find(r => r.id === regionId);
}

export function getDownloadStats(): { totalRegions: number; totalPOIs: number; totalEntries: number } {
  const registry = getRegistry();
  return {
    totalRegions: new Set(registry.map(d => d.regionId)).size,
    totalPOIs: registry.reduce((sum, d) => sum + d.poiCount, 0),
    totalEntries: registry.length,
  };
}
