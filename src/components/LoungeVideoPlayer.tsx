import { useRef, useState, useEffect } from 'react';

interface PlayerProps {
  videoUrl: string;
  isActive: boolean; // Managed by the parent list container
}

export function LoungeVideoPlayer({ videoUrl, isActive }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);

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
        src={videoUrl}
        loop
        playsInline
        controls
        muted // Muted by default to bypass strict browser auto-play blockers
        autoPlay // Let the browser assist the IntersectionObserver
        className="w-full h-full object-cover"
      />

      {/* 🌟 THE OFFICIAL PLATFORM WATERMARK OVERLAY */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none opacity-40 mix-blend-screen select-none">
        <p className="font-black text-[10px] tracking-widest text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex items-center gap-1 font-mono">
          <span className="text-pink-500 animate-pulse">👑</span> LUSTY GLOBAL <span className="text-pink-500">VIP</span>
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
