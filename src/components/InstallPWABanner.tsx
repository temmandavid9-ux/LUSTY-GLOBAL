import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare, Monitor, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Module level storage to catch early beforeinstallprompt events before component mounts
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    (window as any).deferredPWAInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
  });
}

export function triggerPWAInstall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('trigger-pwa-install'));
  }
}

export function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => globalDeferredPrompt || (window as any).deferredPWAInstallPrompt || null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [deviceOS, setDeviceOS] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    // Detect OS & standalone status
    if (typeof window !== 'undefined') {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);

      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
        setDeviceOS('ios');
      } else if (/android/i.test(userAgent)) {
        setDeviceOS('android');
      } else {
        setDeviceOS('desktop');
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      (window as any).deferredPWAInstallPrompt = e;
      setDeferredPrompt(e);
      // Automatically show banner if prompt is fired and not dismissed in session
      if (sessionStorage.getItem('pwa_banner_dismissed') !== 'true') {
        setShowBanner(true);
      }
    };

    const handlePromptAvailable = () => {
      if (globalDeferredPrompt || (window as any).deferredPWAInstallPrompt) {
        setDeferredPrompt(globalDeferredPrompt || (window as any).deferredPWAInstallPrompt);
        if (sessionStorage.getItem('pwa_banner_dismissed') !== 'true') {
          setShowBanner(true);
        }
      }
    };

    const handleTriggerInstall = () => {
      // Direct install request triggered by Header or menu button
      if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true) {
        toast.success("✨ Lusty VIP is already installed on your device as a PWA!", {
          icon: '📱',
          style: { background: '#09090b', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.3)', fontFamily: 'monospace' }
        });
        return;
      }

      const currentPrompt = deferredPrompt || globalDeferredPrompt || (window as any).deferredPWAInstallPrompt;
      if (currentPrompt) {
        executePrompt(currentPrompt);
      } else {
        // Browser didn't fire prompt automatically - show step-by-step instructions modal
        setShowInstructionsModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('trigger-pwa-install', handleTriggerInstall);

    // Initial check if prompt already exists
    if (globalDeferredPrompt || (window as any).deferredPWAInstallPrompt) {
      setDeferredPrompt(globalDeferredPrompt || (window as any).deferredPWAInstallPrompt);
      if (sessionStorage.getItem('pwa_banner_dismissed') !== 'true') {
        setShowBanner(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('trigger-pwa-install', handleTriggerInstall);
    };
  }, [deferredPrompt]);

  const executePrompt = async (promptObj: any) => {
    try {
      promptObj.prompt();
      const { outcome } = await promptObj.userChoice;
      if (outcome === 'accepted') {
        toast.success("🎉 Lusty VIP installed successfully!", { icon: '✨' });
        setShowBanner(false);
      } else {
        toast("PWA installation canceled. You can install anytime from the header.", { icon: 'ℹ️' });
      }
    } catch (err) {
      console.warn("PWA prompt error:", err);
      setShowInstructionsModal(true);
    } finally {
      globalDeferredPrompt = null;
      (window as any).deferredPWAInstallPrompt = null;
      setDeferredPrompt(null);
    }
  };

  const handleInstallClick = () => {
    if (isStandalone) {
      toast.success("Lusty VIP is already running in app mode!", { icon: '✅' });
      return;
    }

    const currentPrompt = deferredPrompt || globalDeferredPrompt || (window as any).deferredPWAInstallPrompt;
    if (currentPrompt) {
      executePrompt(currentPrompt);
    } else {
      setShowInstructionsModal(true);
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (isStandalone) return null;

  return (
    <>
      {/* ── 1. BOTTOM FLOATING PWA BANNER ── */}
      {showBanner && (
        <div id="pwa-install-banner" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-zinc-950/95 backdrop-blur-xl border border-pink-500/40 p-4 rounded-2xl flex items-center justify-between z-50 shadow-2xl shadow-pink-950/40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img src="/icon-192.png" alt="Lusty VIP Logo" loading="eager" decoding="async" className="w-10 h-10 rounded-xl border border-pink-500/50 object-cover shadow-md" />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-zinc-950" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span>Install Lusty VIP</span>
                <span className="text-[9px] bg-pink-500/20 text-pink-400 border border-pink-500/30 px-1.5 py-0.2 rounded font-mono">PWA App</span>
              </h4>
              <p className="text-[11px] text-zinc-400 font-sans mt-0.5">Full screen experience, offline access & live lounge alerts.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            <button
              type="button"
              onClick={handleDismissBanner}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleInstallClick}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-pink-900/30 cursor-pointer font-mono uppercase tracking-wide active:scale-95 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 2. MANUAL PWA INSTALLATION INSTRUCTIONS MODAL ── */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-pink-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setShowInstructionsModal(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <img src="/icon-192.png" alt="Lusty VIP Icon" className="w-12 h-12 rounded-2xl border border-pink-500/50 shadow-lg object-cover" />
              <div>
                <h3 className="text-base font-black text-white font-mono uppercase tracking-wide">Install Lusty VIP PWA</h3>
                <p className="text-xs text-pink-400 font-mono">Manual Web App Installation Guide</p>
              </div>
            </div>

            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase font-mono border-b border-zinc-800 pb-2">
                <Smartphone className="w-4 h-4 text-pink-500" />
                <span>Instructions for {deviceOS === 'ios' ? 'iOS / iPhone' : deviceOS === 'android' ? 'Android Device' : 'Desktop Browser'}</span>
              </div>

              {deviceOS === 'ios' ? (
                <ol className="text-xs text-zinc-300 space-y-2.5 font-sans">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">1</span>
                    <span>Tap the <strong className="text-white flex items-center gap-1 inline-flex"><Share className="w-3.5 h-3.5 text-pink-400 inline" /> Share</strong> button in Safari's toolbar.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">2</span>
                    <span>Scroll down and tap <strong className="text-white flex items-center gap-1 inline-flex"><PlusSquare className="w-3.5 h-3.5 text-pink-400 inline" /> Add to Home Screen</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">3</span>
                    <span>Tap <strong className="text-pink-400">Add</strong> in the top right corner to launch as an app!</span>
                  </li>
                </ol>
              ) : deviceOS === 'android' ? (
                <ol className="text-xs text-zinc-300 space-y-2.5 font-sans">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">1</span>
                    <span>Tap Chrome's <strong className="text-white">three dots menu (⋮)</strong> in top right.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">2</span>
                    <span>Select <strong className="text-white flex items-center gap-1 inline-flex"><Download className="w-3.5 h-3.5 text-pink-400 inline" /> Install App</strong> or <strong>Add to Home Screen</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">3</span>
                    <span>Confirm installation to launch full screen.</span>
                  </li>
                </ol>
              ) : (
                <ol className="text-xs text-zinc-300 space-y-2.5 font-sans">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">1</span>
                    <span>Click the <strong className="text-white flex items-center gap-1 inline-flex"><Monitor className="w-3.5 h-3.5 text-pink-400 inline" /> Install</strong> icon in your browser's address bar (right side).</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">2</span>
                    <span>Or open browser settings menu (⋮) and select <strong className="text-white">"Install Lusty Global VIP..."</strong></span>
                  </li>
                </ol>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-bold text-xs py-2.5 rounded-xl border border-zinc-800 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Got It</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
