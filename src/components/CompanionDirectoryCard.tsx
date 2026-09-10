import { useState } from 'react';
import { Star, ShieldCheck, Calendar, MessageSquare, Lock } from 'lucide-react';
import ProposeRendezvousModal from './ProposeRendezvousModal';

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
  const activeFavorite = isFavorite ?? isFavorited ?? false;

  return (
    <>
      <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-5 space-y-4 font-sans text-white shadow-xl relative flex flex-col justify-between text-left">
        
        {/* Top Info & Favorite Toggle */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold font-mono text-base">@{companion.name || companion.username}</span>
              <ShieldCheck className="w-4 h-4 text-sky-400" />
            </div>
            <button 
              type="button"
              onClick={(e) => onToggleFavorite?.(companion.id, e)}
              className="text-zinc-400 hover:text-pink-500 transition p-1 cursor-pointer"
            >
              <span className={`text-sm ${activeFavorite ? 'text-pink-500 font-bold' : ''}`}>♥</span>
            </button>
          </div>

          {/* Ratings & Status */}
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 mb-3">
            <div className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{companion.rating || '5.0'}</span>
            </div>
            <span>•</span>
            <span className="text-zinc-300">${companion.ratePerHour || 250}/hr</span>
          </div>

          <div className="text-xs text-zinc-300 bg-zinc-950 p-3 border border-zinc-850 rounded-2xl flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Verified VIP guest. Rates available on demand</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsBookingModalOpen(true);
            }}
            className="w-full font-extrabold text-[10px] uppercase tracking-wider py-3 rounded-xl transition-all shadow-md cursor-pointer pointer-events-auto bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black flex items-center justify-center gap-1 shadow-amber-950/20 active:scale-[0.98]"
          >
            <Calendar className="w-4 h-4" />
            <span>BOOKING (${companion.ratePerHour || 250}/hr)</span>
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

      {/* Render Modal when clicked */}
      {isBookingModalOpen && (
        <ProposeRendezvousModal
          hostUsername={companion.name || companion.username || 'host'}
          hourlyRate={companion.ratePerHour || 250}
          onClose={() => setIsBookingModalOpen(false)}
        />
      )}
    </>
  );
}
