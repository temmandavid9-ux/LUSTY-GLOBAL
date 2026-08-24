export const WatermarkBackground = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none flex items-center justify-center">
      {/* Giant ambient rotating background watermark */}
      <div className="relative w-[500px] h-[500px] md:w-[650px] md:h-[650px] opacity-[0.05] filter contrast-125 animate-[spin_160s_linear_infinite]">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bgGoldGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#854d0e" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>
          </defs>

          {/* Golden Diamond Frame */}
          <rect
            x="18"
            y="18"
            width="64"
            height="64"
            rx="12"
            transform="rotate(45 50 50)"
            fill="none"
            stroke="url(#bgGoldGrad)"
            strokeWidth="3"
          />

          {/* Centered LV Monogram */}
          <g fill="url(#bgGoldGrad)">
            <polygon points="50,26 53,30 47,30" />
            <path d="
              M 35,38 L 40,38 L 40,58 L 54,58 L 54,62 L 35,62 Z 
              M 65,38 L 59,38 L 50,56 L 46,56 L 43,48 L 48,48 L 50,52 L 58,38 Z
            " />
            <polygon points="50,70 51.5,72 50,74 48.5,72" />
          </g>
        </svg>
      </div>
    </div>
  );
};
