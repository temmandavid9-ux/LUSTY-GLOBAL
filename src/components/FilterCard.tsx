import React from 'react';
import { VideoFilter } from '../utils/filterEffects';

interface FilterCardProps {
  filter: VideoFilter;
  isSelected: boolean;
  onSelect: (filter: VideoFilter) => void;
}

export const FilterCard: React.FC<FilterCardProps> = ({ filter, isSelected, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(filter)}
      className={`relative rounded-2xl overflow-hidden cursor-pointer border-2 transition-all bg-zinc-900 group ${
        isSelected ? 'border-pink-500 shadow-lg shadow-pink-500/20' : 'border-zinc-800'
      }`}
    >
      {/* Profile Image */}
      <div className="relative h-72 w-full overflow-hidden">
        <img 
          src={filter.previewUrl} 
          alt={filter.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
        />

        {/* TOP RIGHT: ONLINE BADGE */}
        <div className="absolute top-3 right-3 bg-emerald-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wider">
          ONLINE
        </div>

        {/* TOP LEFT: VERIFIED CHECKMARK & TRENDING BADGE */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
          
          {/* ONLY DISPLAY IF PROFILE IS VERIFIED */}
          {filter.isVerified && (
            <>
              {/* VIP / TRENDING Tag */}
              {filter.category === 'Trending' && (
                <div className="flex items-center gap-1 bg-rose-500/90 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider shadow-md">
                  <span>TRENDING</span>
                </div>
              )}

              {/* Blue Verified Check Icon */}
              <div className="w-5 h-5 text-blue-400 drop-shadow-md">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                  <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-3.999-4-3.999-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.149-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.575 9.55.7 10.92.7 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238 1.25 1.273 2.62 2.148 4.2 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6zm-12.7 4.3l-4.2-4.2 1.4-1.4 2.8 2.8 6.8-6.8 1.4 1.4-8.2 8.2z" />
                </svg>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="p-3 bg-zinc-900 flex justify-between items-center">
        <div>
          <p className="text-white text-xs font-semibold truncate">{filter.name}</p>
          <p className="text-zinc-400 text-[10px] truncate">@{filter.creator}</p>
        </div>
      </div>
    </div>
  );
};
