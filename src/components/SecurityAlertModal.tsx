import { ShieldCheck, Lock, EyeOff, CheckCircle2, AlertTriangle, X, ArrowRight } from 'lucide-react';

interface SecurityAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export default function SecurityAlertModal({ isOpen, onClose, onProceed }: SecurityAlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 animate-fadeIn select-none font-sans">
      <div className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-850 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-white text-left">
        {/* Top Accent Gradient Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-pink-500 to-purple-500" />
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 w-8 h-8 rounded-full flex items-center justify-center text-xs transition cursor-pointer z-10 border border-zinc-800"
          title="Close Alert"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Security Alert Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Security Verification
              </span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight mt-1">LUSTY VIP Security Notice</h3>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed mb-5 bg-zinc-900/60 border border-zinc-800/60 p-3.5 rounded-2xl">
          Before accessing sign in or account registration, please acknowledge our end-to-end security protocols for visitor safety and privacy.
        </p>

        {/* Key Security Points */}
        <div className="space-y-3 mb-6 font-sans">
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition">
            <div className="w-7 h-7 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-100">256-Bit P2P Session Encryption</h4>
              <p className="text-[11px] text-zinc-400 leading-normal">All video call streams, live chats, and data exchanges are end-to-end encrypted.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition">
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
              <EyeOff className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-100">Zero Data Leakage Policy</h4>
              <p className="text-[11px] text-zinc-400 leading-normal">Your personal IP, identity details, and call logs are never exposed or stored publicly.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition">
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-100">Strict 18+ Age & Escrow Protection</h4>
              <p className="text-[11px] text-zinc-400 leading-normal">By proceeding, you confirm you are 18+ and accept platform escrow authorization rules.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onProceed}
            className="w-full bg-gradient-to-r from-emerald-500 via-pink-500 to-rose-600 hover:from-emerald-600 hover:to-rose-700 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-xl shadow-pink-500/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Accept Security Terms & Proceed to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
