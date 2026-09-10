import { useState } from 'react';
import { Star, Calendar, MessageSquare, Lock } from 'lucide-react';
import ProposeRendezvousModal from './ProposeRendezvousModal';
import VerifiedBadge from './VerifiedBadge';

interface CompanionDirectoryCardProps {
  companion: any;
  onStartChat: (companionId: string) => void;
  currentUser?: any;
  currentUserId?: string;
  isFavorite?: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
  onWalletDeduction?: (amount: number) => void;
  onAddBooking?: (booking: any) => void;
}

export function CompanionDirectoryCard({
  companion,
  onStartChat,
  currentUser: _currentUser,
  currentUserId: _currentUserId,
  isFavorite,
  isFavorited,
  onToggleFavorite,
  onWalletDeduction: _onWalletDeduction,
  onAddBooking: _onAddBooking
}: CompanionDirectoryCardProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const username = companion.name || companion.username || 'vision';
  const rate = companion.ratePerHour || 250;
  const rating = companion.rating || 5.0;
  const reviews = companion.reviewsCount || 42;
  const avatar = companion.images?.[0] || companion.avatar || companion.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";
  const views = companion.views || "11.2K";
  const isTrending = companion.isTrending ?? true;
  const isOnline = companion.isOnline ?? companion.is_online ?? true;
  const isVipSelect = companion.isVipSelect ?? true;
  const activeFavorite = isFavorite ?? isFavorited ?? false;
  const isVerified = Boolean(companion.is_verified || companion.isVerified);

  const lastLoginTimestamp = companion.last_login || companion.lastLogin || companion.lastSeen || companion.last_seen;

  const formatLastSeen = (timestamp: any) => {
    if (!timestamp) return 'Active now';
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 'Active now';
    const diffMinutes = Math.floor((Date.now() - time) / 60000);
    if (diffMinutes <= 5) return 'Active now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <>
      <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-4 space-y-3 font-sans text-white shadow-xl relative flex flex-col justify-between overflow-hidden text-left">
        
        {/* Top Image Banner & Badges */}
        <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-zinc-950">
          <img 
            src={avatar} 
            alt={username} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1117] via-transparent to-black/40" />

          <div className="absolute top-3 left-3 flex items-center gap-2">
            {isVipSelect && (
              <span className="bg-pink-600/90 text-white font-mono text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-md">
                VIP SELECT
              </span>
            )}
          </div>

          <div className="absolute top-3 right-3">
            {isOnline && (
              <span className="bg-emerald-500/90 text-black font-mono text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> ONLINE
              </span>
            )}
          </div>

          <div className="absolute bottom-3 right-3 bg-emerald-500 text-black font-mono font-black text-xs px-2.5 py-1 rounded-xl shadow-lg">
            ${rate}/hr
          </div>
        </div>

        {/* Username & Verification */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold font-mono text-base">@{username}</span>
            {isVerified && <VerifiedBadge variant="blue" size={16} />}
          </div>
          <button 
            type="button"
            onClick={(e) => onToggleFavorite?.(companion.id, e)}
            className="text-zinc-400 hover:text-pink-500 transition p-1 cursor-pointer"
          >
            <span className={`text-base ${activeFavorite ? 'text-pink-500 font-bold' : ''}`}>♥</span>
          </button>
        </div>

        {/* Ratings & Views */}
        <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-1 text-amber-400 font-bold">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{typeof rating === 'number' ? rating.toFixed(1) : rating}</span>
            <span className="text-zinc-500">({reviews})</span>
          </div>
          <span>•</span>
          <span className="text-zinc-300">👁 {views}</span>
          {isTrending && (
            <>
              <span>•</span>
              <span className="text-pink-400 font-bold">🔥 Trending</span>
            </>
          )}
        </div>

        {/* Location / Status Note */}
        <div className="text-xs text-zinc-300 bg-zinc-950 p-2.5 border border-zinc-850 rounded-2xl flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Verified VIP guest. Rates available on demand</span>
        </div>

        {/* Meta details (Active now colored emerald green) */}
        <div className="text-[11px] text-zinc-400 font-mono space-y-0.5">
          <div>Age: <span className="text-white font-bold">{companion.age || 24}</span></div>
          <div>
            LAST ONLINE: <span className={isOnline ? "text-emerald-400 font-bold" : "text-zinc-300 font-bold"}>
              {isOnline ? 'Active now' : formatLastSeen(lastLoginTimestamp)}
            </span>
          </div>
          <div className="text-red-400 font-bold">Lounge Live Broadcaster</div>
        </div>

        {/* Action Buttons */}
        <div className="pt-1 space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsBookingModalOpen(true);
            }}
            className="w-full font-extrabold text-[11px] uppercase tracking-wider py-3 rounded-xl transition-all shadow-md cursor-pointer pointer-events-auto bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black flex items-center justify-center gap-2 shadow-amber-950/20 active:scale-[0.98]"
          >
            <Calendar className="w-4 h-4" />
            <span>BOOKING (${rate}/HR)</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button 
              type="button"
              onClick={() => onStartChat(companion.id)}
              className="py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button 
              type="button"
              className="py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Cancel</span>
            </button>
          </div>
        </div>

      </div>

      {/* Render Modal */}
      {isBookingModalOpen && (
        <ProposeRendezvousModal
          hostUsername={username}
          hourlyRate={rate}
          onClose={() => setIsBookingModalOpen(false)}
        />
      )}
    </>
  );
}
