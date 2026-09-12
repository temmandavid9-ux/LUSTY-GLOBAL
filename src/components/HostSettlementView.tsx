import { useState } from 'react';
import { useHostSettlements } from '../hooks/useHostSettlements';

export interface HostSettlementLedgerPayoutsProps {
  pending?: number;
  processing?: number;
  settled?: number;
  onRequestPayout?: (amount: number) => void;
}

export function HostSettlementLedgerPayouts({ 
  pending = 0.00, 
  processing = 0.00, 
  settled = 0.00,
  onRequestPayout 
}: HostSettlementLedgerPayoutsProps) {
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('0.00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const parsedAmount = parseFloat(withdrawalAmount) || 0;

  const handlePayout = async () => {
    setErrorMessage('');
    if (parsedAmount <= 0) return;

    // Enforce check: withdrawal cannot exceed settled balance
    if (parsedAmount > settled) {
      setErrorMessage(`Cannot withdraw. Requested amount exceeds settled balance ($${settled.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (onRequestPayout) {
        await onRequestPayout(parsedAmount);
      } else {
        await fetch('/api/host/payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: parsedAmount })
        });
      }
    } catch (err) {
      console.error('Payout submission error:', err);
      setErrorMessage('Failed to process payout request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[#121214] border border-zinc-800/80 rounded-2xl p-5 space-y-4 font-mono text-left">
      {/* HEADER */}
      <div className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">
        HOST SETTLEMENT & LEDGER PAYOUTS
      </div>

      {/* THREE-COLUMN STATS BOX */}
      <div className="grid grid-cols-3 divide-x divide-zinc-800 border border-zinc-700/60 rounded-2xl p-4 bg-[#0a0a0c]/80 text-center">
        <div className="px-1">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            PENDING
          </div>
          <div className="text-base font-extrabold text-cyan-400 font-mono">
            ${pending.toFixed(2)}
          </div>
        </div>

        <div className="px-1">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            PROCESSING
          </div>
          <div className="text-base font-extrabold text-[#ff4b72] font-mono">
            ${processing.toFixed(2)}
          </div>
        </div>

        <div className="px-1">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            SETTLED
          </div>
          <div className="text-base font-extrabold text-emerald-400 font-mono">
            ${settled.toFixed(2)}
          </div>
        </div>
      </div>

      {/* WITHDRAWAL AMOUNT FIELD */}
      <div className="space-y-1.5 pt-1">
        <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          WITHDRAWAL AMOUNT ($)
        </label>
        <div className="relative flex items-center bg-[#0a0a0c] border border-zinc-800/90 rounded-xl px-3.5 py-3">
          <span className="text-zinc-400 font-bold text-sm mr-2">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max={settled}
            value={withdrawalAmount}
            onChange={(e) => {
              setWithdrawalAmount(e.target.value);
              setErrorMessage('');
            }}
            placeholder="0.00"
            className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {errorMessage && (
        <div className="p-2.5 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono text-center">
          {errorMessage}
        </div>
      )}

      {/* REQUEST PAYOUT BUTTON */}
      <button
        onClick={handlePayout}
        disabled={isSubmitting || parsedAmount <= 0 || parsedAmount > settled}
        className="w-full bg-[#ff2056] hover:bg-[#ff003c] disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-2xl transition shadow-lg shadow-pink-950/30 cursor-pointer active:scale-[0.98]"
      >
        {isSubmitting
          ? 'PROCESSING...'
          : `REQUEST PAYOUT ($${parsedAmount.toFixed(2)})`}
      </button>
    </div>
  );
}

export default function HostSettlementView({ currentUserId }: { currentUserId: string }) {
  const { pending, processing, settled } = useHostSettlements(currentUserId);
  return <HostSettlementLedgerPayouts pending={pending} processing={processing} settled={settled} />;
}

