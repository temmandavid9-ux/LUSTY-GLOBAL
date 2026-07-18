import { LustyLiveRadar } from './LustyLiveRadar';

interface CompanionMapProps {
  onStartChat: (companionId: string) => void;
  onOpenBooking: (companionId: string) => void;
}

export default function CompanionMap({ onStartChat }: CompanionMapProps) {
  return (
    <div id="companion-map-container" className="w-full h-full p-4 md:p-6 bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center overflow-y-auto no-scrollbar">
      <div className="w-full max-w-6xl mb-4">
        <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          🗺️ Live Location Services
          <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/30 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-widest font-bold">GPS Nodes Active</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Explore local host companions mapped relative to your physical coordinates. Initiate secure conversations immediately.
        </p>
      </div>

      <LustyLiveRadar 
        currentUserId=""
        onStartChat={onStartChat}
      />
    </div>
  );
}
