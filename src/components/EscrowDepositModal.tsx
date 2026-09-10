import { useState } from 'react';
import { Loader2, ShieldCheck, Wallet } from 'lucide-react';

interface EscrowDepositModalProps {
  amount?: number;
  recipientName?: string;
  onClose?: () => void;
}

export default function EscrowDepositModal({
  amount = 150.00,
  recipientName = '@samuel',
  onClose
}: EscrowDepositModalProps) {
  const [loading, setLoading] = useState(false);

  const handleCryptoDeposit = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceAmount: amount, 
          orderId: `escrow_deposit_${Date.now()}` 
        }),
      });

      const data = await res.json();
      const redirectUrl = data.invoice_url || data.payment_url || data.invoice_checkout_url;

      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        throw new Error(data.error || 'Could not generate crypto invoice URL');
      }
    } catch (err: any) {
      console.error('NOWPayments escrow error:', err);
      alert('Payment checkout failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 max-w-md w-full text-center space-y-6 shadow-2xl relative font-sans">
        
        {/* Header */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">
            Deposit Escrow Value
          </span>
          <div className="text-3xl font-black text-emerald-400 font-mono">
            ${amount.toFixed(2)}
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Transfer target recipient: <span className="text-cyan-400 font-bold">{recipientName}</span>
          </p>
        </div>

        {/* Crypto Node Info Box */}
        <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-2xl text-left space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono">
            <ShieldCheck className="w-4 h-4" />
            <span>Decentralized Escrow Protocol</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            All escrow deposits are processed securely through the TRC-20 network to protect both parties.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleCryptoDeposit}
            className="w-full py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-950"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Generating USDT Invoice...</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4 text-black" />
                <span>Pay with USDT (TRC-20)</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-850 text-zinc-400 transition cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export { EscrowDepositModal };
