import { useState } from 'react';
import { LustyLiveRadar, RadarFilters } from './LustyLiveRadar';
import { SlidersHorizontal, Star, DollarSign, Wifi, RotateCcw, ChevronDown, ChevronUp, Sparkles, LocateFixed } from 'lucide-react';

interface CompanionMapProps {
  onStartChat: (companionId: string) => void;
  onOpenBooking?: (companionId: string) => void;
  currentUserId?: string;
}

export default function CompanionMap({ onStartChat, currentUserId = "" }: CompanionMapProps) {
  const defaultFilters: RadarFilters = {
    onlineOnly: false,
    minRating: 0,
    minRate: 0,
    maxRate: 1000
  };

  const [filters, setFilters] = useState<RadarFilters>(defaultFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(true);
  const [centerTrigger, setCenterTrigger] = useState<number>(0);

  // Count how many filters are currently active (non-default)
  const activeFilterCount = 
    (filters.onlineOnly ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.minRate > 0 || filters.maxRate < 1000 ? 1 : 0);

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const triggerCenterOnMe = () => {
    setCenterTrigger(prev => prev + 1);
  };

  return (
    <div id="companion-map-container" className="w-full h-full p-4 md:p-6 bg-zinc-950 text-zinc-100 flex flex-col items-center overflow-y-auto no-scrollbar">
      
      {/* Top Title & Header Row */}
      <div className="w-full max-w-6xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 flex-wrap">
            <span>🗺️ Live Location Services</span>
            <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/30 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-widest font-bold">GPS Nodes Active</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Explore local host companions mapped relative to your physical coordinates. Initiate secure conversations immediately.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Center on Me Button */}
          <button
            id="center-on-me-header-button"
            type="button"
            onClick={triggerCenterOnMe}
            className="px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border bg-[#0c0c0e] border-zinc-800 hover:border-pink-500/50 text-zinc-200 hover:text-white hover:bg-zinc-900 active:scale-95 shadow-md"
          >
            <LocateFixed className="w-4 h-4 text-pink-500" />
            <span>Center on Me</span>
          </button>

          {/* Filter Toggle Button */}
          <button
            id="toggle-filter-panel-button"
            type="button"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border ${
              activeFilterCount > 0
                ? 'bg-pink-500/10 border-pink-500/40 text-pink-400 hover:bg-pink-500/20'
                : 'bg-[#0c0c0e] border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-pink-500" />
            <span>Filter Hosts</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
            {isFilterPanelOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      {isFilterPanelOpen && (
        <div id="companion-map-filter-panel" className="w-full max-w-6xl bg-[#0c0c0e] border border-zinc-800/80 rounded-2xl p-4 md:p-5 mb-5 shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 font-mono">Radar Filter Parameters</h3>
            </div>
            
            {activeFilterCount > 0 && (
              <button
                id="reset-radar-filters-button"
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-mono text-zinc-400 hover:text-pink-400 flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. ONLINE STATUS FILTER */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Online Status</span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFilters(f => ({ ...f, onlineOnly: false }))}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                    !filters.onlineOnly
                      ? 'bg-zinc-800 border-zinc-600 text-white shadow'
                      : 'bg-zinc-950/60 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span>All Hosts</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilters(f => ({ ...f, onlineOnly: true }))}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                    filters.onlineOnly
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-zinc-950/60 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online Only</span>
                </button>
              </div>
            </div>

            {/* 2. MINIMUM RATING FILTER */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>Minimum Rating</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Any', value: 0 },
                  { label: '4.0★+', value: 4.0 },
                  { label: '4.5★+', value: 4.5 },
                  { label: '4.8★+', value: 4.8 },
                  { label: '5.0★', value: 5.0 }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilters(f => ({ ...f, minRating: opt.value }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                      filters.minRating === opt.value
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 shadow-md'
                        : 'bg-zinc-950/60 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. HOURLY RATE RANGE FILTER */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-pink-400" />
                  <span>Hourly Rate Range</span>
                </label>
                <span className="text-xs font-mono font-bold text-pink-400">
                  ${filters.minRate} - {filters.maxRate >= 1000 ? '$1000+' : `$${filters.maxRate}`}/hr
                </span>
              </div>

              {/* Quick Rate Presets */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  { label: 'Any Rate', min: 0, max: 1000 },
                  { label: '< $250', min: 0, max: 250 },
                  { label: '$250 - $350', min: 250, max: 350 },
                  { label: '$350+', min: 350, max: 1000 }
                ].map(preset => {
                  const isSelected = filters.minRate === preset.min && filters.maxRate === preset.max;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFilters(f => ({ ...f, minRate: preset.min, maxRate: preset.max }))}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer border ${
                        isSelected
                          ? 'bg-pink-500/20 border-pink-500/60 text-pink-400'
                          : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Range Sliders */}
              <div className="grid grid-cols-2 gap-2 items-center">
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block mb-0.5">Min: ${filters.minRate}/hr</span>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="25"
                    value={filters.minRate}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFilters(f => ({ ...f, minRate: Math.min(val, f.maxRate) }));
                    }}
                    className="w-full accent-pink-500 bg-zinc-900 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>

                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block mb-0.5">Max: ${filters.maxRate >= 1000 ? '1000+' : filters.maxRate}/hr</span>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={filters.maxRate}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFilters(f => ({ ...f, maxRate: Math.max(val, f.minRate) }));
                    }}
                    className="w-full accent-pink-500 bg-zinc-900 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* LIVE RADAR MAP COMPONENT */}
      <LustyLiveRadar 
        currentUserId={currentUserId}
        onStartChat={onStartChat}
        filters={filters}
        centerTrigger={centerTrigger}
      />
    </div>
  );
}

