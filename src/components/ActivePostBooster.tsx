import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Zap, Sparkles, AlertCircle } from 'lucide-react';
import { executeCardPayment } from '../utils/processPayment';

interface BoosterProps {
  videoId: string;
  currentUserId: string;
  walletBalance?: number;
  onPaymentSuccess?: () => void;
  onBoostSuccess?: () => void;
}

export function ActivePostBooster({ 
  videoId, 
  currentUserId: _currentUserId, 
  walletBalance: _walletBalance = 150.00, 
  onPaymentSuccess, 
  onBoostSuccess 
}: BoosterProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isBoosted, setIsBoosted] = useState(false);
  const [boostTimeRemaining, setBoostTimeRemaining] = useState<string | null>(null);

  const BOOSTER_PACKAGE_COST = 50.00; // Updated to $50.00

  // Check live boost status from table
  const checkLiveBoostStatus = useCallback(async () => {
    if (!videoId) return;
    try {
      const { data, error } = await supabase
        .from('short_video_metrics')
        .select('is_boosted, boosted_until')
        .eq('video_id', videoId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.is_boosted && data.boosted_until) {
        const expiresAt = new Date(data.boosted_until).getTime();
        const now = new Date().getTime();

        if (expiresAt > now) {
          setIsBoosted(true);
          const diffMs = expiresAt - now;
          const hoursLeft = Math.ceil(diffMs / (1000 * 60 * 60));
          setBoostTimeRemaining(`${hoursLeft} Hours Left`);
        } else {
          setIsBoosted(false);
          await supabase
            .from('short_video_metrics')
            .update({ is_boosted: false })
            .eq('video_id', videoId);
        }
      } else {
        setIsBoosted(false);
      }
    } catch (err: any) {
      console.warn("Failed to sync booster state data:", err.message);
    }
  }, [videoId]);

  useEffect(() => {
    if (videoId) {
      checkLiveBoostStatus();
    }
  }, [videoId, checkLiveBoostStatus]);

  const handlePurchasePackage = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      console.log(`Forwarding $${BOOSTER_PACKAGE_COST.toFixed(2)} charge directly to Flutterwave Gateway...`);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await executeCardPayment({
        userId: _currentUserId,
        amount: BOOSTER_PACKAGE_COST,
        description: '7-Day Post Visibility Boost Package',
        metadata: {
          videoId,
          boostType: 'TopFeedAccelerator',
          tx_ref_prefix: 'boost-'
        },
        onSuccess: async () => {
          // 🚀 Payment confirmed! Write the engagement multipliers straight to the database
          await supabase
            .from('short_video_metrics')
            .upsert({
              video_id: videoId,
              is_boosted: true,
              boosted_until: expiresAt.toISOString(),
              likes_count: 520,
              views_count: 2450
            }, { onConflict: 'video_id' });

          try {
            await supabase
              .from('short_videos')
              .update({
                is_boosted: true
              })
              .eq('id', videoId);
          } catch (e) {
            console.warn("Could not update short_videos boosting flag directly", e);
          }

          setSuccessMessage("💳 Card Charged $50.00 Successfully! Your video is boosted to the top of the feed.");
          setIsBoosted(true);
          setBoostTimeRemaining("7 Days Left");
          
          if (onPaymentSuccess) {
            onPaymentSuccess();
          } else if (onBoostSuccess) {
            onBoostSuccess();
          }
        }
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Network error during checkout authentication.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-sm bg-zinc-950 p-5 rounded-3xl text-white border border-zinc-900 shadow-2xl font-sans">
      
      {/* ── 🎯 RETAINED: Main Feature Action Title ── */}
      <h3 className="text-base font-bold text-white tracking-wide mb-4">
        Visibility Booster Node
      </h3>

      {isBoosted ? (
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-3.5 flex flex-col gap-2 text-center items-center mb-2">
          <div className="w-9 h-9 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500 animate-pulse border border-pink-500/20">
            <Zap className="w-4 h-4 fill-pink-500" />
          </div>
          <p className="text-xs font-semibold text-zinc-300">
            This post is currently prioritized on the primary global discovery feed.
          </p>
          <span className="text-[11px] font-mono font-bold text-pink-400 bg-pink-950/30 px-3 py-0.5 rounded-full border border-pink-900/40 mt-1">
            Timer: {boostTimeRemaining}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Package Cost Settlement Display Box */}
          <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-850 p-4 rounded-xl mb-1">
            <span className="text-xs text-zinc-400 font-medium">
              Top Feed Package Cost:
            </span>
            <span className="text-sm font-black text-emerald-400 font-mono">
              $50.00
            </span>
          </div>

          {/* 💳 Direct Debit Card Action Trigger */}
          <button
            type="button"
            onClick={handlePurchasePackage}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition duration-250 hover:opacity-95 active:scale-[0.98] shadow-lg cursor-pointer text-center block disabled:opacity-50"
          >
            {isProcessing ? "Authorizing Payment Gateway..." : "Pay $50 & Boost to Top"}
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 bg-rose-950/40 border border-rose-900/50 text-rose-400 text-xs p-2.5 rounded-xl font-medium text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mt-3 bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 text-xs p-2.5 rounded-xl font-medium text-center flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

    </div>
  );
}

export default ActivePostBooster;
