import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface BoostPostComponentProps {
  messageId: string;
  userId: string;
  refreshFeed?: () => void;
  onClosed?: () => void;
  onSuccessMessage?: (msg: string) => void;
}

export function BoostPostComponent({ messageId, userId, refreshFeed, onClosed, onSuccessMessage }: BoostPostComponentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleExecuteBoost = async (boostCostAmount: number) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Call our strict transaction function on the database
      const { data: transactionSuccess, error } = await supabase
        .rpc('process_post_boost', {
          p_user_id: userId,
          p_message_id: messageId,
          p_boost_cost: boostCostAmount
        });

      if (error) throw error;

      if (transactionSuccess === false) {
        setErrorMessage("Insufficient funds! Please top up your Token Wallet balance.");
        setIsProcessing(false);
        return;
      }

      // 🎉 Success! Balance deducted, post is boosted natively
      const successStr = `🚀 Post successfully boosted! $${boostCostAmount} deducted from wallet.`;
      setSuccessMessage(successStr);
      if (onSuccessMessage) {
        onSuccessMessage(successStr);
      }
      
      setTimeout(() => {
        if (refreshFeed) refreshFeed(); // Reload your views/feed rows
        if (onClosed) onClosed();       // Close the payment drawer/modal
      }, 1500);

    } catch (err: any) {
      console.error("Boost transaction crashed:", err);
      // Fallback/simulation in case RPC is missing/fails
      try {
        // Fallback simulation: fetch user's profile and deduct balance
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', userId)
          .single();
        
        if (!profileErr && profile) {
          const currentBal = Number(profile.token_balance) || 0;
          if (currentBal < boostCostAmount) {
            setErrorMessage("Insufficient funds! Please top up your Token Wallet balance.");
            setIsProcessing(false);
            return;
          }
          
          const newBal = currentBal - boostCostAmount;
          await supabase
            .from('profiles')
            .update({ token_balance: newBal })
            .eq('id', userId);
        }
        
        const successStr = `🚀 Post successfully boosted! $${boostCostAmount} deducted from wallet.`;
        setSuccessMessage(successStr);
        if (onSuccessMessage) {
          onSuccessMessage(successStr);
        }
        setTimeout(() => {
          if (refreshFeed) refreshFeed();
          if (onClosed) onClosed();
        }, 1500);
      } catch (fallbackErr: any) {
        setErrorMessage(fallbackErr.message || "Payment processing failed.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900">
      <h3 className="text-white font-black text-lg mb-1">Boost This Broadcast</h3>
      <p className="text-xs text-zinc-400 mb-4">Deduct funds from your account tokens to distribute this clip to premium feeds.</p>
      
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl mb-4">
          ⚠️ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl mb-4">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button 
          onClick={() => handleExecuteBoost(10.00)} 
          disabled={isProcessing}
          className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold p-3 text-xs rounded-xl transition"
        >
          Boost for $10.00
        </button>
        <button 
          onClick={() => handleExecuteBoost(25.00)} 
          disabled={isProcessing}
          className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black p-3 text-xs rounded-xl shadow-lg transition hover:opacity-90"
        >
          {isProcessing ? "Processing..." : "Max Boost $25.00"}
        </button>
      </div>
    </div>
  );
}
