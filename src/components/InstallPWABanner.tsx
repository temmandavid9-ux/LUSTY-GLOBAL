import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
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

  if (!showPrompt) return null;

  return (
    <div id="pwa-install-banner" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-zinc-900/95 backdrop-blur-md border border-pink-500/30 p-4 rounded-2xl flex items-center justify-between z-50 shadow-2xl shadow-pink-950/30 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="Lusty VIP Logo" loading="eager" decoding="async" className="w-10 h-10 rounded-xl border border-amber-500/40 object-cover shadow-md shrink-0" />
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono">Install Lusty VIP App</h4>
          <p className="text-[11px] text-zinc-400 font-sans">Add to home screen for full-screen access & instant lounge alerts.</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-2">
        <button
          type="button"
          onClick={() => setShowPrompt(false)}
          className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-pink-900/20 cursor-pointer font-mono uppercase tracking-wide"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>
      </div>
    </div>
  );
}
