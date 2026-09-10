export default function EscrowStatusBox() {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between font-sans">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div>
          <span className="text-xs font-bold text-zinc-200 block font-mono uppercase tracking-wider">
            USDT (TRC-20) ESCROW NODE ACTIVE
          </span>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Your bookings and escrow deposits are secured through decentralized blockchain invoicing.
          </p>
        </div>
      </div>
      <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-wider shrink-0">
        ✓ Ready for Escrow
      </span>
    </div>
  );
}

export { EscrowStatusBox };
