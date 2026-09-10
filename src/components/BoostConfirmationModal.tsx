import { useState } from 'react';
import { Loader2, Zap, X } from 'lucide-react';

interface BoostConfirmationModalProps {
  clipTitle?: string;
  boostTier?: string;
  deliverables?: string;
  priceAmount?: number;
  onClose?: () => void;
}

export default function BoostConfirmationModal({
  clipTitle = "can you see it? [location: London]",
  boostTier = "Starter Engagement Pack",
  deliverables = "Delivers ~500 Views & 50 Likes",
  priceAmount = 15.00,
  onClose
}: BoostConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCryptoPayment = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceAmount: priceAmount,
          orderId: `boost_campaign_${Date.now()}`,
          orderDescription: `${boostTier} - ${deliverables}`
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create crypto invoice');
      }

      // Check all possible URL keys returned by payment gateways
      const redirectUrl = data.invoice_url || data.payment_url || data.invoice_checkout_url || data.url;

      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        throw new Error('No invoice URL returned from payment gateway');
      }
    } catch (err: any) {
      console.error('Campaign crypto payment error:', err);
      setErrorMsg(err.message || 'Payment checkout failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 max-w-md w-full relative space-y-6 shadow-2xl text-left">
        
        {/* Close Button */}
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 p-2 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Icon & Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl mx-auto flex items-center justify-center">
            <Zap className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-white font-extrabold font-mono uppercase tracking-wider text-sm">
            CONFIRM CAMPAIGN PURCHASE
          </h3>
        </div>

        {/* Details Box */}
        <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 space-y-3 text-xs font-mono">
          <div className="flex justify-between border-b border-zinc-900 pb-2">
            <span className="text-zinc-500">Target Clip:</span>
            <span className="text-zinc-200 truncate max-w-[180px]">{clipTitle}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-900 pb-2">
            <span className="text-zinc-500">Boost Tier:</span>
            <span className="text-amber-400 font-bold">{boostTier}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-900 pb-2">
            <span className="text-zinc-500">Deliverables:</span>
            <span className="text-zinc-300">{deliverables}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-zinc-500">Gateway Node:</span>
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">USDT (TRC-20)</span>
          </div>
        </div>

        {/* Total Debit Amount */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between font-mono">
          <span className="text-xs text-zinc-400 uppercase font-bold">Total Invoice Amount:</span>
          <span className="text-lg font-black text-emerald-400">${priceAmount.toFixed(2)} USD</span>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-xs text-center font-mono">
            {errorMsg}
          </div>
        )}

        <p className="text-[11px] text-zinc-400 text-center font-mono">
          Clicking confirm will generate a secure USDT (TRC-20) invoice to accelerate your video instantly.
        </p>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={handleCryptoPayment}
            className="w-full py-3.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-950"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Generating USDT Invoice...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-black fill-black" />
                <span>Confirm & Pay ${priceAmount.toFixed(2)} (USDT)</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 transition cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export { BoostConfirmationModal };
