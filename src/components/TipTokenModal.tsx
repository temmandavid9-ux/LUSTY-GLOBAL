import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';

export default function TipTokenModal({ 
  currentUserId, 
  receiverId, 
  defaultAmount = 50.00 
}: { 
  currentUserId?: string; 
  receiverId?: string; 
  defaultAmount?: number;
}) {
  const [selectedAmount, setSelectedAmount] = useState<number>(defaultAmount);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tipError, setTipError] = useState('');

  const tipOptions = [5, 10, 20, 50, 100];

  const handleSendTipCrypto = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setTipError('');

    try {
      if (!currentUserId) {
        alert("Please log in to send a tip token.");
        setIsProcessing(false);
        return;
      }

      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceAmount: selectedAmount,
          orderId: `tip_token_${currentUserId}_to_${receiverId || 'platform'}_${Date.now()}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create crypto tip invoice');
      }

      if (data.invoice_url) {
        window.location.href = data.invoice_url;
      } else {
        throw new Error('No invoice URL returned from payment gateway');
      }

    } catch (err: any) {
      console.error("Error during tip token checkout:", err);
      setTipError(err.message || "Failed to process crypto tip.");
      alert(err.message || "Failed to process crypto tip.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3 font-sans">
      <button
        type="button"
        onClick={handleSendTipCrypto}
        disabled={isProcessing}
        className="bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-white px-5 py-3 rounded-2xl flex items-center gap-3 transition cursor-pointer disabled:opacity-50 active:scale-[0.98]"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span className="text-xs font-mono font-bold tracking-wide">Generating Invoice...</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider font-mono">Send Tips Token</span>
              <Send className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">to client (${selectedAmount})</span>
          </>
        )}
      </button>

      <div className="flex items-center gap-2">
        {tipOptions.map((amount) => {
          const isSelected = selectedAmount === amount;
          return (
            <button
              key={amount}
              type="button"
              onClick={() => setSelectedAmount(amount)}
              className={`px-4 py-3 rounded-2xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-950 border border-pink-400/30'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700'
              }`}
            >
              <span className="text-[10px] opacity-70">💎</span>
              <span>${amount}</span>
            </button>
          );
        })}
      </div>

      {tipError && (
        <div className="w-full mt-2 p-2 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400 text-xs text-center font-mono">
          {tipError}
        </div>
      )}
    </div>
  );
}

export { TipTokenModal };
