import { useState } from 'react';
import { Fingerprint, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';

interface BiometricScannerProps {
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
}

export default function BiometricScanner({ onSuccess, title = "Secure Handshake", subtitle = "Place finger on scanner to verify credentials" }: BiometricScannerProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);

  const startScan = () => {
    if (status === 'success' || status === 'scanning') return;
    
    setStatus('scanning');
    setProgress(0);
    
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setProgress(currentProgress);
      
      if (currentProgress >= 100) {
        clearInterval(interval);
        setStatus('success');
        setTimeout(() => {
          onSuccess();
        }, 1200);
      }
    }, 180);
  };

  return (
    <div id="biometric-scanner-component" className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/5 rounded-full blur-xl" />
      
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Lock className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono uppercase tracking-widest">Biometric Gateway</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-zinc-500 font-mono">SECURE</span>
        </div>
      </div>

      <h3 className="text-sm font-extrabold text-white mb-1">{title}</h3>
      <p className="text-xs text-zinc-400 mb-6 leading-relaxed">{subtitle}</p>

      {/* Interactive Scan Area */}
      <div 
        onClick={startScan}
        className={`w-32 h-32 mx-auto rounded-full border flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all duration-300 ${
          status === 'scanning' 
            ? 'border-pink-500 bg-pink-950/20 scale-105' 
            : status === 'success' 
            ? 'border-emerald-500 bg-emerald-950/20' 
            : 'border-zinc-700 bg-zinc-850 hover:border-pink-500/40 hover:bg-zinc-800'
        }`}
      >
        {/* Laser Scanning Line */}
        {status === 'scanning' && (
          <div 
            className="absolute left-0 w-full h-1 bg-pink-500 shadow-md shadow-pink-500/50 animate-bounce" 
            style={{ top: `${progress}%`, transition: 'top 0.1s linear' }}
          />
        )}

        {status === 'success' ? (
          <CheckCircle2 className="w-14 h-14 text-emerald-400 animate-scale-up" />
        ) : (
          <Fingerprint className={`w-14 h-14 transition ${
            status === 'scanning' ? 'text-pink-400 animate-pulse' : 'text-zinc-400'
          }`} />
        )}
      </div>

      {/* Progress & Feedback State */}
      <div className="mt-6">
        {status === 'idle' && (
          <p className="text-xs text-zinc-400 font-mono animate-pulse">TAP TO SCAN FINGERPRINT</p>
        )}
        {status === 'scanning' && (
          <div>
            <div className="w-32 h-1 bg-zinc-800 mx-auto rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-pink-500 transition-all duration-150" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-pink-400 font-mono uppercase tracking-widest">Decrypting Handshake... {progress}%</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex items-center justify-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-mono uppercase tracking-widest font-bold">VIP Handshake Verified</span>
          </div>
        )}
      </div>
    </div>
  );
}
