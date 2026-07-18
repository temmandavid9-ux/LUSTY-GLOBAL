import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface RequestPayoutButtonProps {
  currentUserId: string;
  pendingBalance: number; // Total amount currently pending
  onPayoutRequested: () => void; // Callback function to refresh dashboard stats
  payoutConfigured?: boolean;
}

export function RequestPayoutButton({ currentUserId, pendingBalance, onPayoutRequested, payoutConfigured = false }: RequestPayoutButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const triggerPayoutRequest = async () => {
    try {
      setIsProcessing(true);
      setMessage(null);

      // Execute the secure RPC backend update function
      const { data: updatedCount, error: rpcError } = await supabase.rpc('request_host_payout', {
        host_id_param: currentUserId
      });

      let finalCount = updatedCount;

      if (rpcError) {
        console.warn("RPC function request_host_payout failed/not found, trying robust client fallback:", rpcError.message);
        
        // Robust client-side fallback update to update all 'pending' ledger items for this host to 'processing'
        const { data: updatedRecords, error: fallbackError } = await supabase
          .from('platform_ledger')
          .update({ settlement_status: 'processing' })
          .eq('recipient_id', currentUserId)
          .eq('settlement_status', 'pending')
          .select();

        if (fallbackError) {
          throw fallbackError;
        }

        finalCount = updatedRecords ? updatedRecords.length : 0;
      }

      if (finalCount > 0) {
        setMessage({
          type: 'success',
          text: `💰 Success! ${finalCount} ledger entries have been updated to 'processing'. Your settlement is being reviewed.`
        });
        
        // Trigger parent re-fetch to clear the pending UI numbers
        onPayoutRequested();
        
      } else {
        setMessage({
          type: 'error',
          text: "No pending ledger records found to process."
        });
      }
    } catch (err: any) {
      console.error("❌ Payout submission failed:", err.message || err);
      setMessage({
        type: 'error',
        text: "Failed to submit payout request. Please try again later."
      });
    } finally {
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  const handlePayoutClick = () => {
    if (!payoutConfigured) {
      setMessage({
        type: 'error',
        text: "Please configure your Settlement Bank Details below to enable cashouts."
      });
      return;
    }
    if (pendingBalance <= 0) {
      setMessage({
        type: 'error',
        text: "You don't have any pending balances available for payout request."
      });
      return;
    }
    setShowConfirm(true);
  };

  const isEnabled = payoutConfigured && pendingBalance > 0 && !isProcessing;

  return (
    <div className="flex flex-col gap-2">
      {!showConfirm ? (
        <button
          type="button"
          onClick={handlePayoutClick}
          disabled={!isEnabled}
          className={`font-semibold tracking-wide text-xs uppercase px-5 py-2.5 rounded-lg border transition duration-150 shadow-sm w-full text-center flex items-center justify-center gap-2
            ${isEnabled
              ? 'bg-pink-600 hover:bg-pink-500 border-pink-500 text-white cursor-pointer'
              : 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
            }`}
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing Request...
            </>
          ) : (
            payoutConfigured ? "Request Payout" : "Configure Bank Details Below to Cash Out"
          )}
        </button>
      ) : (
        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 space-y-2 animate-fadeIn">
          <p className="text-[11px] text-zinc-300 font-medium">
            Confirm payout request for pending balance of <span className="text-pink-400 font-bold font-mono">${pendingBalance.toFixed(2)}</span>?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={triggerPayoutRequest}
              className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-bold text-[10px] uppercase py-1.5 px-3 rounded transition cursor-pointer"
            >
              Yes, Confirm
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[10px] uppercase py-1.5 px-3 rounded transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-2.5 rounded-lg text-[11px] font-sans border leading-relaxed animate-fadeIn mt-1
          ${message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
