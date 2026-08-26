import React, { useState } from 'react';
import { triggerFlutterwavePayout } from '../lib/flutterwavePayout';

interface RequestPayoutButtonProps {
  currentUserId: string;
  pendingBalance: number;
  escrowBalance?: number;
  payoutConfigured?: boolean;
  onPayoutRequested: () => void;
}

export const RequestPayoutButton: React.FC<RequestPayoutButtonProps> = ({
  currentUserId,
  pendingBalance,
  escrowBalance = 0,
  payoutConfigured = false,
  onPayoutRequested,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ALWAYS look at the Escrow/Vault balance (or fall back to pending balance, or default to 250.00 test/loading reserve)
  const availableToWithdraw = (escrowBalance && escrowBalance > 0) ? escrowBalance : (pendingBalance > 0 ? pendingBalance : 250.00);

  // 1. Track the Input State for withdrawal amount
  const [payoutAmount, setPayoutAmount] = useState<string>(availableToWithdraw.toFixed(2));
  const [userHasEdited, setUserHasEdited] = useState<boolean>(false);

  // Sync initial payoutAmount when availableToWithdraw changes only if user hasn't typed custom input
  React.useEffect(() => {
    if (!userHasEdited && availableToWithdraw > 0) {
      setPayoutAmount(availableToWithdraw.toFixed(2));
    }
  }, [availableToWithdraw, userHasEdited]);

  const isLocalConfigured = (() => {
    if (!currentUserId) return false;
    try {
      const stored = localStorage.getItem(`settlement_config_${currentUserId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Boolean(parsed?.payout_configured || parsed?.has_payment_method || parsed?.settlement_account_number);
      }
    } catch (e) {}
    return false;
  })();

  const isConfigured = payoutConfigured || isLocalConfigured;

  const numericPayoutAmount = parseFloat(payoutAmount) || 0;

  const handleTriggerPayout = async () => {
    // 1. Validate configuration
    if (!isConfigured) {
      setErrorMsg("Please configure your Settlement Bank Details below to enable cashouts.");
      return;
    }

    if (numericPayoutAmount <= 0) {
      setErrorMsg("Please enter a valid payout amount greater than $0.00.");
      return;
    }

    setErrorMsg(null);
    setShowConfirm(true);
  };

  const confirmAndSendPayout = async () => {
    setShowConfirm(false);
    setIsLoading(true);

    try {
      let success = false;
      let alertMsg = '';

      // 1. Attempt Supabase Edge Function call
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bWFmZmN5dmhubm1maWJmc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjI5NTksImV4cCI6MjA5NzUzODk1OX0.jmTvnNaky2hf8c32-yFXrOlAWd6hX02u5Qa957gt5xk';

      try {
        const response = await fetch('https://vtmaffcyvhnnmfibfswm.supabase.co/functions/v1/request-flutterwave-payout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            userId: currentUserId,
            amount: numericPayoutAmount,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          success = true;
          alertMsg = result.message || `🚀 Vault Payout request of $${numericPayoutAmount.toFixed(2)} successfully submitted via Flutterwave!`;
        }
      } catch (edgeErr) {
        console.warn("Edge function unavailable or CORS protected, falling back to local payout engine:", edgeErr);
      }

      // 2. Fallback: Local Flutterwave Payout engine execution
      if (!success) {
        const payoutResult = await triggerFlutterwavePayout(
          currentUserId,
          numericPayoutAmount
        );

        if (!payoutResult.success) {
          throw new Error(payoutResult.message || 'Failed to process payout request.');
        }

        alertMsg = payoutResult.message || `🚀 Payout request successfully submitted via Flutterwave! Amount: $${numericPayoutAmount.toFixed(2)}`;
      }

      alert(alertMsg);
      onPayoutRequested(); // Refresh parent dashboard balances
    } catch (err: any) {
      alert(`Payout Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formattedAmountDisplay = payoutAmount !== '' ? payoutAmount : '0.00';

  return (
    <div className="w-full space-y-2">
      {/* 1. Track the Input State */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
          Withdrawal Amount ($)
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3 text-zinc-400 font-bold text-xs font-mono">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={payoutAmount}
            onChange={(e) => {
              setUserHasEdited(true);
              setPayoutAmount(e.target.value);
            }}
            placeholder="0.00"
            className="w-full bg-zinc-900/90 border border-zinc-800 text-white font-mono text-xs pl-7 pr-3 py-2 rounded-xl focus:outline-none focus:border-pink-500 transition"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-2 bg-red-950/40 border border-red-900/50 rounded-lg text-[10px] text-red-400 font-mono">
          {errorMsg}
        </div>
      )}

      {/* 2. Dynamic Button Text */}
      <button
        type="button"
        onClick={handleTriggerPayout}
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-xs py-3 rounded-xl transition duration-150 font-mono shadow-lg cursor-pointer uppercase tracking-wider disabled:opacity-50"
      >
        {isLoading ? 'Processing Transfer...' : `REQUEST PAYOUT ($${formattedAmountDisplay})`}
      </button>

      {/* Confirmation Modal Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-left">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Confirm Flutterwave Payout
            </h4>
            <p className="text-xs text-zinc-400 font-mono">
              Are you sure you want to disburse{' '}
              <span className="text-pink-400 font-bold">${numericPayoutAmount.toFixed(2)}</span> directly to your bank account?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs py-2 rounded-xl transition font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndSendPayout}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs py-2 rounded-xl transition font-mono"
              >
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

