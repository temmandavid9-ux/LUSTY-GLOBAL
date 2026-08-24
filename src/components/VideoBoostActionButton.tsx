import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { executeCardPayment } from '../utils/processPayment';

interface ShortVideoBoosterButtonProps {
  shortId: string;
  videoTitle: string;
  isAlreadyBoosted?: boolean;
  boosterLevel?: number;
  onBoostComplete?: () => void;
}

export const VideoBoostActionButton: React.FC<ShortVideoBoosterButtonProps> = ({
  shortId,
  videoTitle,
  isAlreadyBoosted = false,
  boosterLevel = 1,
  onBoostComplete
}) => {
  const [showBoostConfirmModal, setShowBoostConfirmModal] = useState(false);
  const [isBoostingPost, setIsBoostingPost] = useState(false);

  const handleTriggerPostBoost = () => {
    setShowBoostConfirmModal(true);
  };

  const handleConfirmAndPayBoost = async () => {
    setIsBoostingPost(true);
    const boostPriceCents = 5000; // $50.00 USD
    
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await executeCardPayment({
        amountInCents: boostPriceCents,
        description: `7-Day Top Feed Boost: ${videoTitle}`,
        metadata: {
          videoId: shortId,
          boostType: 'WeeklyTopFeedAccelerator',
          tx_ref_prefix: 'boost-'
        },
        onSuccess: async () => {
          const { error: updateErr } = await supabase
            .from('short_videos')
            .update({
              is_boosted: true,
              boost_expires_at: expiresAt,
              booster_level: 2
            })
            .eq('id', shortId);

          if (updateErr) console.warn('Database update fallback warning:', updateErr.message);

          toast.success(`🎉 $50.00 Debited! "${videoTitle}" is boosted to the top of every feed for 7 days!`, { duration: 6000 });
          setShowBoostConfirmModal(false);
          
          if (onBoostComplete) {
            onBoostComplete();
          }
        }
      });
    } catch (err: any) {
      toast.error(err.message || 'Payment authorization failed. Please try again.');
    } finally {
      setIsBoostingPost(false);
    }
  };

  return (
    <>
      {/* 🚀 BOOST CIRCULAR ICON BUTTON */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTriggerPostBoost();
          }}
          className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-rose-500 flex items-center justify-center border border-amber-400 text-white shadow-lg shadow-pink-500/25 active:scale-90 hover:brightness-110 transition cursor-pointer"
          title="Boost this Broadcast"
        >
          <span className="text-lg">🚀</span>
        </button>
        <span className="text-[9px] font-sans font-black uppercase tracking-widest text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {isAlreadyBoosted ? `${boosterLevel}X BOOSTED` : 'BOOST'}
        </span>
      </div>

      {/* 🚀 PRE-DEBIT CONFIRMATION MODAL */}
      {showBoostConfirmModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
            
            <button
              type="button"
              disabled={isBoostingPost}
              onClick={() => setShowBoostConfirmModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-zinc-900 border border-zinc-800 cursor-pointer"
            >
              ✕
            </button>

            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 text-lg">
              🚀
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-100 uppercase tracking-wider font-mono">
                Confirm 7-Day Feed Top Boost
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Push your video to the top of all user feeds for 7 days.
              </p>
            </div>

            <div className="bg-zinc-900/90 rounded-2xl p-4 border border-zinc-800 text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Target Broadcast:</span>
                <span className="text-zinc-200 font-bold truncate max-w-[150px]">
                  {videoTitle || "Current Loop"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Boost Duration:</span>
                <span className="text-amber-400 font-bold">7 Days Top Placement</span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Payment Method:</span>
                <span className="text-zinc-300 font-mono">Card on File</span>
              </div>
              <div className="border-t border-zinc-800 pt-2.5 flex justify-between items-center text-sm font-black text-white">
                <span>Total Debit Amount:</span>
                <span className="text-emerald-400 font-mono text-base">$50.00 USD</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-tight">
              Clicking confirm will charge your linked card <strong className="text-zinc-300">$50.00</strong> to pin this video to the top of all user feeds.
            </p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={isBoostingPost}
                onClick={() => setShowBoostConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBoostingPost}
                onClick={handleConfirmAndPayBoost}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isBoostingPost ? 'Processing...' : 'Confirm & Pay $50.00'}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
};
