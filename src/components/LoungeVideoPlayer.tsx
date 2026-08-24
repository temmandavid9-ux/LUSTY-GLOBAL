import { useRef, useState, useEffect } from 'react';
import { getSafeVideoUrl, RELIABLE_FALLBACK_VIDEO } from '../utils/videoUtils';

interface PlayerProps {
  videoUrl: string;
  poster?: string;
  isActive: boolean; // Managed by the parent list container
}

export function LoungeVideoPlayer({ videoUrl, poster, isActive }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const [hasError, setHasError] = useState(false);

  const safeUrl = hasError ? RELIABLE_FALLBACK_VIDEO : getSafeVideoUrl(videoUrl);

  // 🔄 Handle Auto-Play / Pause when scroll focus shifts
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.log("Auto-play blocked by browser policy:", err));
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // Reset clip to start
      setIsPlaying(false);
    }
  }, [isActive]);

  // 👆 Manual Tap to Pause / Play Toggle
  const handleVideoTap = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }

    // Trigger transient center play/pause badge animation
    setShowIndicator(true);
    setTimeout(() => setShowIndicator(false), 500);
  };

  return (
    <div 
      className="relative w-full h-[80vh] max-h-[700px] bg-black rounded-2xl border border-zinc-900 overflow-hidden flex items-center justify-center cursor-pointer select-none"
      onClick={handleVideoTap}
    >
      <video
        ref={videoRef}
        src={safeUrl}
        poster={poster}
        loop
        playsInline
        crossOrigin="anonymous"
        preload="metadata" // Download metadata first to save cellular data and decoding resources
        muted // Muted by default to bypass strict browser auto-play blockers
        onError={(e) => {
          console.warn("Video load failed. Switching to fallback stream.", e);
          if (!hasError) setHasError(true);
        }}
        className="w-full h-full object-cover"
      />

      {hasError && (
        <div className="absolute top-3 right-3 bg-rose-950/80 border border-rose-800/50 text-rose-300 text-[10px] px-2.5 py-1 rounded-full font-mono z-20">
          ⚠️ CDN Source Blocked - Loaded Fallback Stream
        </div>
      )}

      {/* 🌟 OFFICIAL PLATFORM WATERMARK OVERLAY */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none select-none flex items-center gap-2 opacity-75 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
        <div className="w-5 h-5 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <rect
              x="18"
              y="18"
              width="64"
              height="64"
              rx="12"
              transform="rotate(45 50 50)"
              fill="#090a16"
              stroke="#d4af37"
              strokeWidth="4"
            />
            <g fill="#d4af37">
              <polygon points="50,26 53,30 47,30" />
              <path d="
                M 35,38 L 40,38 L 40,58 L 54,58 L 54,62 L 35,62 Z 
                M 65,38 L 59,38 L 50,56 L 46,56 L 43,48 L 48,48 L 50,52 L 58,38 Z
              " />
            </g>
          </svg>
        </div>
        
        <p className="font-extrabold text-[11px] tracking-widest text-white uppercase flex items-center gap-1 font-sans">
          LUSTY GLOBAL <span className="text-yellow-400 font-mono">VIP</span>
        </p>
      </div>

      {/* 🎬 Transient Play/Pause Overlay Indicator */}
      {showIndicator && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none animate-ping duration-300">
          <div className="bg-zinc-900/90 border border-zinc-700 text-white p-4 rounded-full shadow-2xl">
            {isPlaying ? (
              <span className="text-xl">▶️</span>
            ) : (
              <span className="text-xl">⏸️</span>
            )}
          </div>
        </div>
      )}

      {/* 🔈 Static Tap UI Clue */}
      <div className="absolute bottom-4 right-4 bg-black/60 px-2 py-1 rounded text-[10px] text-zinc-400 font-mono pointer-events-none backdrop-blur-md border border-zinc-800">
        {isPlaying ? "⏸ Tapped to Pause" : "▶ Tapped to Play"}
      </div>
    </div>
  );
}
