interface LustyGlobalLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  layout?: 'vertical' | 'horizontal';
}

export const LustyGlobalLogo = ({
  size = 'md',
  className = '',
  showText = true,
  layout = 'vertical',
}: LustyGlobalLogoProps = {}) => {
  const emblemSize = {
    sm: 'w-8 h-8 md:w-9 md:h-9',
    md: 'w-12 h-12 md:w-14 md:h-14',
    lg: 'w-20 h-20 md:w-24 md:h-24',
  }[size];

  const titleSize = {
    sm: 'text-[10px] tracking-[0.15em]',
    md: 'text-xs tracking-[0.2em]',
    lg: 'text-lg md:text-xl tracking-[0.3em]',
  }[size];

  const subSize = {
    sm: 'text-[7px] tracking-[0.2em]',
    md: 'text-[8px] tracking-[0.3em]',
    lg: 'text-[10px] md:text-[11px] tracking-[0.4em]',
  }[size];

  const dividerWidth = {
    sm: 'w-2',
    md: 'w-3',
    lg: 'w-5',
  }[size];

  const isHorizontal = layout === 'horizontal';

  return (
    <div className={`flex ${isHorizontal ? 'flex-row items-center gap-2' : 'flex-col items-center'} select-none shrink-0 ${className}`}>
      {/* 1. Diamond Emblem */}
      <div className={`relative ${emblemSize} flex items-center justify-center shrink-0`}>
        {/* Soft Gold Glow */}
        <div className="absolute inset-0 bg-yellow-500/25 blur-md rounded-full pointer-events-none" />

        {/* Crisp High-Res Vector Emblem */}
        <img
          src="/logo.svg"
          alt="Lusty Global VIP Logo"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain relative z-10 drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]"
          onError={(e) => {
            // Fallback to icon-192 if svg fails to render
            (e.target as HTMLImageElement).src = '/icon-192.png';
          }}
        />
      </div>

      {/* 2. Typography */}
      {showText && (
        <div className={`flex flex-col ${isHorizontal ? 'items-start text-left' : 'items-center text-center'} leading-tight shrink-0`}>
          <span className={`text-zinc-100 font-extrabold uppercase font-sans whitespace-nowrap ${titleSize}`}>
            Lusty Global
          </span>

          <div className="flex items-center gap-1 mt-0.5">
            <span className={`h-[1px] bg-yellow-500/40 ${dividerWidth}`} />
            <span className={`text-yellow-400 font-black uppercase font-mono whitespace-nowrap ${subSize}`}>
              V I P
            </span>
            <span className={`h-[1px] bg-yellow-500/40 ${dividerWidth}`} />
          </div>
        </div>
      )}
    </div>
  );
};


