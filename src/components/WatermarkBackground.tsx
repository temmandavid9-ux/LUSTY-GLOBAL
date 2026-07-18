export const WatermarkBackground = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none flex items-center justify-center">
      {/* 
        This renders a giant, ultra-faint version of your logo 
        deep in the background of your app dashboard 
      */}
      <div className="relative w-[600px] h-[600px] opacity-[0.03] filter grayscale contrast-125 mix-blend-screen">
        <img 
          src="/logo.png" 
          alt="Background Watermark" 
          className="w-full h-full object-contain animate-[spin_120s_linear_infinite]" 
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};
