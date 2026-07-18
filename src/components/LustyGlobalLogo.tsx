export const LustyGlobalLogo = () => {
  return (
    <div className="flex items-center gap-3 select-none">
      {/* Container with a subtle golden glow effect to match the logo */}
      <div className="relative w-12 h-12 flex items-center justify-center rounded-full overflow-hidden border border-yellow-500/20 bg-zinc-950/50 p-1 shadow-[0_0_15px_rgba(234,179,8,0.15)]">
        <img 
          src="/logo.png" 
          alt="Lusty Global VIP Logo" 
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Premium Typography */}
      <div className="flex flex-col leading-tight">
        <span className="text-zinc-100 font-bold text-sm tracking-[0.25em] uppercase font-sans">
          Lusty Global
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="h-[1px] w-4 bg-yellow-500/50"></span>
          <span className="text-[9px] text-yellow-500 font-black tracking-[0.4em] uppercase font-mono">
            V I P
          </span>
          <span className="h-[1px] w-4 bg-yellow-500/50"></span>
        </div>
      </div>
    </div>
  );
};
