import { useState } from 'react';
import { Loader2, Wallet, X } from 'lucide-react';

interface CryptoPayoutModalProps {
  amount?: number;
  userId?: string;
  settledBalance?: number;
  onClose?: () => void;
  onPayoutSuccess?: (amount: number) => void;
}

export default function CryptoPayoutModal({
  amount = 250.00,
  userId,
  settledBalance,
  onClose,
  onPayoutSuccess
}: CryptoPayoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDisburseCrypto = async () => {
    if (loading) return;
    
    // Client safety check before hitting API
    if (typeof settledBalance === 'number' && amount > settledBalance) {
      setErrorMsg(`Insufficient funds. Your settled balance is $${settledBalance.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/request-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          userId: userId,
          payoutMethod: 'USDT_TRC20',
          timestamp: Date.now()
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to process crypto payout request');
      }

      setSuccess(true);
      if (onPayoutSuccess) {
        onPayoutSuccess(amount);
      }
    } catch (err: any) {
      console.error('Payout error:', err);
      setErrorMsg(err.message || 'Payout request failed. Please check your available balance and wallet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 max-w-md w-full relative space-y-5 shadow-2xl">
        
        {/* Close Button */}
        {onClose && (
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 p-2 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center">
            <Wallet className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-white font-black font-mono uppercase tracking-wider text-sm">
            CONFIRM USDT (TRC-20) PAYOUT
          </h3>
        </div>

        {success ? (
          <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-2xl text-center space-y-2 font-mono">
            <div className="text-emerald-400 font-bold text-xs uppercase">Payout Disbursed Successfully!</div>
            <p className="text-[11px] text-zinc-400">
              Your withdrawal of <span className="text-white font-bold">${amount.toFixed(2)} USD</span> has been routed to your connected USDT wallet node.
            </p>
          </div>
        ) : (
          <>
            {/* Details Box */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 space-y-3 font-mono">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <span className="text-zinc-500 text-xs">Payout Asset:</span>
                <span className="text-emerald-400 font-bold text-xs">USDT (TRC-20)</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-zinc-500 text-xs">Disbursement Amount:</span>
                <span className="text-emerald-400 font-black text-base">${amount.toFixed(2)} USD</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-xs text-center font-mono">
                {errorMsg}
              </div>
            )}

            <p className="text-[11px] text-zinc-400 text-center font-mono">
              Are you sure you want to disburse <span className="text-emerald-400 font-bold">${amount.toFixed(2)}</span> directly to your verified crypto wallet address?
            </p>

            {/* Actions */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleDisburseCrypto}
                className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-950 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Disbursing Funds...</span>
                  </>
                ) : (
                  <span>Confirm & Send Payout</span>
                )}
              </button>

              {onClose && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 transition cursor-pointer font-mono"
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export { CryptoPayoutModal, CryptoPayoutModal as FlutterwavePayoutModal };
