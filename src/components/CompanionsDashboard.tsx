import React, { useState, useMemo } from 'react';
import { SNAP_FILTERS } from '../utils/filterEffects';
import { FilterCard } from './FilterCard';

// Helper function to shuffle an array randomly (Fisher-Yates Shuffle)
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const CompanionsDashboard: React.FC = () => {
  const [onlyVerified, setOnlyVerified] = useState<boolean>(false);
  const [selectedFilterId, setSelectedFilterId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 1. RANDOMIZE ON LOGIN & SORT VERIFIED TO TOP
  const randomizedProfiles = useMemo(() => {
    // Separate profiles into verified and non-verified
    const verified = SNAP_FILTERS.filter((profile) => profile.isVerified);
    const unverified = SNAP_FILTERS.filter((profile) => !profile.isVerified);

    // Shuffle both groups independently so order varies on each login
    const shuffledVerified = shuffleArray(verified);
    const shuffledUnverified = shuffleArray(unverified);

    // Concatenate: Verified profiles ALWAYS placed first
    return [...shuffledVerified, ...shuffledUnverified];
  }, []); // Runs once on mount / user login

  // 2. FILTER BASED ON "ONLY VERIFIED" TOGGLE AND SEARCH
  const displayedProfiles = useMemo(() => {
    let filtered = randomizedProfiles;
    if (onlyVerified) {
      filtered = filtered.filter((profile) => profile.isVerified);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (profile) =>
          profile.name.toLowerCase().includes(term) ||
          profile.creator.toLowerCase().includes(term) ||
          profile.category.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [onlyVerified, randomizedProfiles, searchTerm]);

  return (
    <div className="w-full bg-zinc-950 text-white min-h-screen p-6 font-sans">
      
      {/* FILTER CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl mb-6">
        
        {/* Search Input */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 w-64">
          <svg className="w-4 h-4 text-zinc-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none w-full"
          />
        </div>

        {/* ONLY VERIFIED TOGGLE SWITCH */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-300 tracking-wider">ONLY VERIFIED</span>
          <button
            onClick={() => setOnlyVerified(!onlyVerified)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
              onlyVerified ? 'bg-pink-500 justify-end' : 'bg-zinc-700 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
          </button>
        </div>

      </div>

      {/* COMPANIONS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayedProfiles.map((profile) => (
          <FilterCard
            key={profile.id}
            filter={profile}
            isSelected={selectedFilterId === profile.id}
            onSelect={(selected) => setSelectedFilterId(selected.id)}
          />
        ))}
      </div>

    </div>
  );
};
