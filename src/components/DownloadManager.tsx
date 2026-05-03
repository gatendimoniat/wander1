import { useState, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Download, Trash2, HardDrive, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronRight, MapPin, Database, X } from 'lucide-react';
import { toast } from 'sonner';
import { ALL_REGIONS, SPAIN_REGIONS, PORTUGAL_REGIONS, FRANCE_REGIONS, RegionConfig } from '@/lib/regionsConfig';
import { getDownloads, isRegionDownloaded, getDownloadStats, removeRegionDownloads, clearAllDownloads } from '@/lib/downloadRegistry';
import { deletePOIsByRegion, clearAllPOIs } from '@/lib/poiManager';
import { downloadRegionPOIs, DownloadProgress } from '@/lib/downloadManager';
import poiSpatialIndex from '@/lib/poiSpatialIndex';

interface DownloadManagerProps {
  onDownloadComplete?: () => void;
}

export default function DownloadManager({ onDownloadComplete }: DownloadManagerProps) {
  const isMobile = useIsMobile();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set(['spain']));
  const [stats, setStats] = useState(getDownloadStats);

  const refreshStats = useCallback(() => {
    setStats(getDownloadStats());
  }, []);

  const toggleCountry = (country: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  };

  const handleDownload = async (region: RegionConfig) => {
    if (downloading) return;
    if (isRegionDownloaded(region.id)) {
      toast.info(`${region.name} ya está descargado`);
      return;
    }

    setDownloading(region.id);
    setProgress({ status: 'downloading', message: `Descargando ${region.name}...`, progress: 0 });

    try {
      const result = await downloadRegionPOIs(region, (p) => {
        setProgress(p);
      });

      if (result.success) {
        toast.success(`${result.poiCount} POIs descargados para ${region.name}`);
        refreshStats();
        // Add POIs to spatial index
        if (result.pois && result.pois.length > 0) {
          await poiSpatialIndex.addPOIs(result.pois, region.id);
        }
        onDownloadComplete?.();
      } else {
        toast.error(`Error descargando ${region.name}`);
      }
    } catch (error) {
      toast.error(`Error: ${error}`);
    } finally {
      setDownloading(null);
      setProgress(null);
    }
  };

  const handleDelete = async (regionId: string, regionName: string) => {
    if (!confirm(`Eliminar todos los POIs de ${regionName}?`)) return;
    
    try {
      const count = await deletePOIsByRegion(regionId);
      removeRegionDownloads(regionId);
      refreshStats();
      // Remove from spatial index
      await poiSpatialIndex.removePOIsByRegion(regionId);
      toast.success(`${count} POIs eliminados de ${regionName}`);
      onDownloadComplete?.();
    } catch (error) {
      toast.error(`Error eliminando: ${error}`);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Eliminar TODOS los POIs descargados? Esta acción no se puede deshacer.')) return;
    
    try {
      const count = await clearAllPOIs();
      clearAllDownloads();
      refreshStats();
      // Rebuild spatial index from scratch (will be empty)
      await poiSpatialIndex.rebuildFromIndexedDB();
      toast.success(`${count} POIs eliminados`);
      onDownloadComplete?.();
    } catch (error) {
      toast.error(`Error: ${error}`);
    }
  };

  const groupedRegions = {
    spain: { name: 'España', icon: '🇪🇸', regions: SPAIN_REGIONS },
    portugal: { name: 'Portugal', icon: '🇵🇹', regions: PORTUGAL_REGIONS },
    france: { name: 'Francia', icon: '🇫🇷', regions: FRANCE_REGIONS },
  };

  const downloadStats = getDownloads();

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="bg-sidebar-accent/50 rounded-lg p-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-sidebar-primary" />
          <span className="font-medium">{stats.totalPOIs.toLocaleString()} POIs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-green-400" />
          <span>{stats.totalRegions} regiones</span>
        </div>
        {stats.totalPOIs > 0 && (
          <button
            onClick={handleDeleteAll}
            className="ml-auto flex items-center gap-1 text-red-400 hover:text-red-300 transition"
          >
            <Trash2 className="w-3 h-3" />
            Eliminar todo
          </button>
        )}
      </div>

      {/* Storage info */}
      <div className="text-xs text-sidebar-foreground/40 px-1">
        <HardDrive className="w-3 h-3 inline mr-1" />
        Datos guardados localmente en el navegador (IndexedDB)
      </div>

      {/* Regions list */}
      {Object.entries(groupedRegions).map(([country, group]) => {
        const isExpanded = expandedCountries.has(country);
        const downloadedInCountry = downloadStats.filter(d => d.regionId.startsWith(country));

        return (
          <div key={country}>
            <button
              onClick={() => toggleCountry(country)}
              className="w-full flex items-center gap-2 py-2 px-1 text-sm font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground transition"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>{group.icon}</span>
              <span>{group.name}</span>
              {downloadedInCountry.length > 0 && (
                <span className="ml-auto text-xs text-green-400 font-normal">
                  {downloadedInCountry.length} descargada{downloadedInCountry.length > 1 ? 's' : ''}
                </span>
              )}
            </button>

            {isExpanded && (
              <div className="ml-4 space-y-1.5">
                {group.regions.map(region => {
                  const isDownloaded = isRegionDownloaded(region.id);
                  const downloadInfo = downloadStats.find(d => d.regionId === region.id);
                  const isCurrentDownloading = downloading === region.id;

                  return (
                    <div
                      key={region.id}
                      className={`flex items-center gap-2 p-2 rounded-lg transition ${
                        isDownloaded ? 'bg-green-500/10 border border-green-500/20' : 'bg-sidebar-accent/30 hover:bg-sidebar-accent/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{region.name}</span>
                          {isDownloaded && (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                          )}
                        </div>
                        {downloadInfo && (
                          <div className="text-xs text-sidebar-foreground/50 mt-0.5">
                            {downloadInfo.poiCount.toLocaleString()} POIs · {new Date(downloadInfo.downloadedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {isCurrentDownloading && progress ? (
                        <div className="flex items-center gap-2 text-xs">
                          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                          <span className="text-blue-400">{progress.progress}%</span>
                        </div>
                      ) : isDownloaded ? (
                        <button
                          onClick={() => handleDelete(region.id, region.name)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition shrink-0"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(region)}
                          disabled={!!downloading}
                          className="flex items-center gap-1 bg-sidebar-primary/20 text-sidebar-primary px-2 py-1.5 rounded text-xs font-medium hover:bg-sidebar-primary/30 transition disabled:opacity-50 shrink-0"
                        >
                          <Download className="w-3 h-3" />
                          Descargar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Download all button */}
      {!downloading && stats.totalPOIs === 0 && (
        <div className="pt-2 border-t border-sidebar-border">
          <button
            onClick={async () => {
              if (!confirm('Descargar todas las regiones? Esto puede tardar varios minutos.')) return;
              setDownloading('all');
              let totalPOIs = 0;
              for (const region of ALL_REGIONS) {
                setProgress({ status: 'downloading', message: `Descargando ${region.name}...`, progress: 0 });
                const result = await downloadRegionPOIs(region, (p) => setProgress(p));
                if (result.success) totalPOIs += result.poiCount;
              }
              toast.success(`${totalPOIs} POIs descargados en total`);
              refreshStats();
              onDownloadComplete?.();
              setDownloading(null);
              setProgress(null);
            }}
            className="w-full bg-gradient-to-r from-green-500/20 to-blue-500/20 text-sidebar-primary py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar todas las regiones
          </button>
        </div>
      )}

      {/* Progress indicator */}
      {progress && downloading && (
        <div className="bg-sidebar-accent/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            {progress.status === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : progress.status === 'complete' ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            )}
            <span className="text-sm">{progress.message}</span>
          </div>
          {progress.poiCount && (
            <div className="text-xs text-sidebar-foreground/50">
              {progress.poiCount.toLocaleString()} puntos de interés
            </div>
          )}
          <div className="w-full bg-sidebar-border rounded-full h-1.5">
            <div
              className="bg-sidebar-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
