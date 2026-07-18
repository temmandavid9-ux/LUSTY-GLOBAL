import { ShieldAlert } from 'lucide-react';

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
        
        {/* NEW GOLDEN VIP LOGO - Large Scale */}
        <div className="flex flex-col items-center gap-5 select-none mb-8">
          {/* The Golden Globe/Monogram Icon (Increased Size) */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_rgba(250,204,21,0.25)]">
              <defs>
                {/* Liquid Luxury Gold Gradient */}
                <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FEF08A" />
                  <stop offset="50%" stopColor="#EAB308" />
                  <stop offset="100%" stopColor="#854D0E" />
                </linearGradient>
              </defs>

              {/* Outer Ring */}
              <circle cx="50" cy="50" r="42" stroke="url(#gold-gradient)" strokeWidth="3" fill="none" className="opacity-90" />
              
              {/* Inner Orbit Line */}
              <ellipse cx="50" cy="50" rx="42" ry="14" stroke="url(#gold-gradient)" strokeWidth="1.2" fill="none" transform="rotate(-28 50 50)" className="opacity-50" />
              
              {/* Intersecting L & G Monogram */}
              <text x="32" y="61" fill="url(#gold-gradient)" fontSize="32" fontWeight="900" fontFamily="Georgia, serif" letterSpacing="-2">
                L
              </text>
              <text x="50" y="61" fill="url(#gold-gradient)" fontSize="32" fontWeight="900" fontFamily="Georgia, serif" letterSpacing="-2">
                G
              </text>
              
              {/* VIP Sparkle Star */}
              <path d="M50 16 L52 21 L57 21 L53 24 L55 29 L50 26 L45 29 L47 24 L43 21 L48 21 Z" fill="url(#gold-gradient)" />
            </svg>
          </div>

          {/* Luxury Typography (Increased Size) */}
          <div className="flex flex-col items-center leading-tight">
            <span className="text-zinc-100 font-bold text-xl tracking-[0.35em] uppercase font-sans">
              Lusty Global
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-[1px] w-6 bg-yellow-500/50"></span>
              <span className="text-[12px] text-yellow-500 font-black tracking-[0.5em] uppercase">
                V I P
              </span>
              <span className="h-[1px] w-6 bg-yellow-500/50"></span>
            </div>
          </div>
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
