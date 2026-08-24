import { ShieldAlert } from 'lucide-react';
import { LustyGlobalLogo } from './LustyGlobalLogo';

interface AgeGateProps {
  onVerify: () => void;
}

export default function AgeGate({ onVerify }: AgeGateProps) {
  const handleExit = () => {
    window.location.href = 'https://www.google.com';
  };

  return (
    <div id="age-gate-container" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 px-4">
      {/* Visual background lights with warm golden glow */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-yellow-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-yellow-700/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-700" />
        
        {/* OFFICIAL GOLDEN VIP LOGO - Large Scale */}
        <div className="mb-8 flex justify-center">
          <LustyGlobalLogo size="lg" />
        </div>

        <div className="w-16 h-16 rounded-full bg-zinc-850 flex items-center justify-center mx-auto mb-6 text-yellow-500 border border-yellow-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-bold text-white mb-3">Age Verification Required</h1>
        
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          This system contains verified host directories, live lounge video streaming, and escrow-based booking tools meant strictly for consenting adults. You must be <span className="text-yellow-500 font-semibold">18 years or older</span> to enter.
        </p>

        <div className="flex flex-col gap-3">
          <button
            id="btn-verify-age"
            onClick={onVerify}
            className="w-full bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-700 hover:to-yellow-500 text-zinc-950 font-black text-sm py-3 px-6 rounded-2xl active:scale-95 transition shadow-lg shadow-yellow-500/20"
          >
            I am 18+ — Enter Lounge
          </button>
          
          <button
            id="btn-exit-age"
            onClick={handleExit}
            className="w-full bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold text-sm py-3 px-6 rounded-2xl transition"
          >
            Leave Site
          </button>
        </div>

        <div className="mt-6 text-[10px] text-zinc-500 font-mono tracking-tight">
          By clicking enter, you agree to our Terms of VIP Membership.
        </div>
      </div>
    </div>
  );
}
