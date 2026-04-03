import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[2000] md:left-auto md:right-4 md:w-80">
      <div className="bg-sidebar text-sidebar-foreground rounded-xl shadow-2xl border border-sidebar-border p-4 flex items-center gap-3">
        <div className="bg-sidebar-primary rounded-lg p-2 shrink-0">
          <Download className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Instal·la ExploraWander</p>
          <p className="text-xs text-sidebar-foreground/60">Accedeix ràpidament des de la pantalla d'inici</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-sidebar-primary text-sidebar-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition shrink-0"
        >
          Instal·lar
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="p-1 hover:bg-sidebar-accent rounded shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
