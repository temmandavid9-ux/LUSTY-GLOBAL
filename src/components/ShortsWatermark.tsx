import React from 'react';

interface ShortsWatermarkProps {
  username: string; // e.g. "misscakes"
  logoUrl?: string; // Optional custom logo image URL
}

export const ShortsWatermark: React.FC<ShortsWatermarkProps> = ({ 
  username, 
  logoUrl = "/logo.png" 
}) => {
  const cleanUsername = (username || 'VIP').replace(/^@/, '');
  const [imgError, setImgError] = React.useState(false);

  return (
    <div className="absolute top-4 right-4 z-40 pointer-events-none select-none">
      {/* ── Fully Rounded Capsule Pill Container (rounded-full) ── */}
      <div className="flex items-center gap-2.5 bg-black/80 backdrop-blur-md border border-white/10 pl-2 pr-4 py-1.5 rounded-full shadow-2xl">
        
        {/* ── 1. LOGO ICON (Left Side) ── */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500/20 via-zinc-900 to-amber-400/20 border border-amber-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
          {logoUrl && !imgError ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              onError={() => setImgError(true)}
              className="w-full h-full object-cover" 
            />
          ) : (
            /* Fallback vector icon if image fails to load */
            <span className="text-amber-400 font-black text-xs font-serif tracking-tighter">L</span>
          )}
        </div>

        {/* ── 2. TEXT CONTENT BLOCK ── */}
        <div className="flex flex-col">
          {/* Top Row: LUSTY GLOBAL + Red VIP Tag */}
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-white font-extrabold text-xs tracking-wider uppercase font-sans">
              LUSTY GLOBAL
            </span>
            <span className="text-rose-600 font-black text-[10px] tracking-wider uppercase">
              VIP
            </span>
          </div>

          {/* Bottom Row: Host Handle */}
          <span className="text-zinc-400 font-medium text-[11px] leading-tight mt-0.5">
            @{cleanUsername}
          </span>
        </div>

      </div>
    </div>
  );
};

export const drawWatermarkOnCanvas = (
  ctx: CanvasRenderingContext2D, 
  canvasWidth: number, 
  username: string
) => {
  const cleanUsername = (username || 'VIP').replace(/^@/, '');
  const paddingX = 14;
  const rectWidth = 160;
  const rectHeight = 36;
  const x = canvasWidth - rectWidth - 20;
  const y = 20;
  const radius = 18;

  // 1. Draw Pill Background
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = 'rgba(15, 15, 15, 0.75)';
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, rectWidth, rectHeight, radius);
  } else {
    ctx.rect(x, y, rectWidth, rectHeight);
  }
  ctx.fill();

  // 2. Draw "LUSTY GLOBAL" Text
  ctx.font = '900 12px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('LUSTY GLOBAL', x + paddingX, y + 16);

  // 3. Draw "VIP" Text
  const lustyWidth = ctx.measureText('LUSTY GLOBAL').width;
  ctx.font = '900 10px sans-serif';
  ctx.fillStyle = '#E11D48'; // Red VIP
  ctx.fillText('VIP', x + paddingX + lustyWidth + 5, y + 15);

  // 4. Draw "@username" Text
  ctx.font = '500 11px sans-serif';
  ctx.fillStyle = '#A1A1AA';
  ctx.fillText(`@${cleanUsername}`, x + paddingX, y + 30);
  
  ctx.restore();
};
