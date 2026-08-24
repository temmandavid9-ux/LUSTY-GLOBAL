import { useHostSettlements } from '../hooks/useHostSettlements';

export default function HostSettlementView({ currentUserId }: { currentUserId: string }) {
  const { pending, processing, settled } = useHostSettlements(currentUserId);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 max-w-lg mx-auto space-y-3 text-left font-sans">
      <div className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase font-bold">
        Host Settlement & Ledger Payouts
      </div>
      
      <div className="grid grid-cols-3 divide-x divide-zinc-800 border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 text-center">
        <div>
          <div className="text-[9px] font-mono text-zinc-400 uppercase">Pending</div>
          <div className="text-base font-mono font-bold text-white mt-1">${pending.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] font-mono text-zinc-400 uppercase">Processing</div>
          <div className="text-base font-mono font-bold text-red-400 mt-1">${processing.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] font-mono text-zinc-400 uppercase">Settled</div>
          <div className="text-base font-mono font-bold text-emerald-400 mt-1">${settled.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
