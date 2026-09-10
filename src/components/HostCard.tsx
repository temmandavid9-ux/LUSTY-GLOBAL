import { useState } from 'react';
import { Star, ShieldCheck, Calendar, MessageSquare, Lock } from 'lucide-react';
import ProposeRendezvousModal from './ProposeRendezvousModal';

interface HostCardProps {
  hostId?: string;
  hostUsername?: string;
  hourlyRate?: number;
  rating?: number;
  reviewsCount?: number;
  hostAvatar?: string;
  onStartChat?: (hostId?: string) => void;
}

export default function HostCard({
  hostId,
  hostUsername = "Black Boy",
  hourlyRate = 250.00,
  rating = 5.0,
  reviewsCount = 42,
  hostAvatar,
  onStartChat
}: HostCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-5 max-w-sm w-full space-y-4 font-sans text-white shadow-xl relative text-left">
      
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold font-mono text-base">@{hostUsername}</span>
          <ShieldCheck className="w-4 h-4 text-sky-400" />
        </div>
        <span className="text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
          Trending
        </span>
      </div>

      {/* Ratings & Status */}
      <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-1 text-amber-400 font-bold">
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <span>{rating.toFixed(1)}</span>
          <span className="text-zinc-500">({reviewsCount})</span>
        </div>
        <span>•</span>
        <span className="text-zinc-300">11.6K views</span>
      </div>

      <div className="text-xs text-zinc-300 bg-zinc-950 p-3 border border-zinc-850 rounded-2xl flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
        <span>Welcome to my VIP Lounge!</span>
      </div>

      <div className="text-[11px] text-zinc-400 font-mono space-y-1">
        <div>Age: <span className="text-white font-bold">24</span></div>
        <div>LAST ONLINE: <span className="text-zinc-300">Active now</span></div>
        <div className="text-red-400 font-bold pt-1">Lounge Live Broadcaster</div>
      </div>

      {/* Action Button */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-950/20 active:scale-[0.98]"
        >
          <Calendar className="w-4 h-4" />
          <span>BOOKING (${hourlyRate}/hr)</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button 
            type="button"
            onClick={() => onStartChat?.(hostId)}
            className="py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button 
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {/* Render Modal as a clean Portal/Overlay */}
      {isModalOpen && (
        <ProposeRendezvousModal
          hostUsername={hostUsername}
          hourlyRate={hourlyRate}
          hostAvatar={hostAvatar}
          onClose={() => setIsModalOpen(false)}
        />
      )}

    </div>
  );
}

export { HostCard };
