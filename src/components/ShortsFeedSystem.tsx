import { useState } from 'react';
import { LoungeShortsFeed } from './LoungeShortsFeed';
import { ReachAnalyticsPanel } from './ReachAnalyticsPanel';

interface ShortsFeedSystemProps {
  walletBalance?: number;
  onSpendFunds?: (amount: number) => Promise<void>;
  currentUserId?: string;
}

export default function ShortsFeedSystem({ walletBalance: _walletBalance = 1450.00, onSpendFunds: _onSpendFunds, currentUserId }: ShortsFeedSystemProps) {
  // Keep only 'feed' and 'analytics' tabs, defaulting to Lounge Broadcasts 'feed'
  const [activeTab, setActiveTab] = useState<'feed' | 'analytics'>('feed');

  return (
    <div className="w-full h-full bg-black relative flex flex-col">
      
      {/* ── TOP NAVIGATION HEADER: FORCE LOUNGE ONLY ── */}
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 tracking-wider">LUSTY GLOBAL VIP</span>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('feed')}
            className={`text-xs font-black uppercase tracking-wider transition relative py-1 ${
              activeTab === 'feed' ? 'text-pink-500 border-b-2 border-pink-500 pb-1' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Lounge Broadcasts
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={`text-xs font-black uppercase tracking-wider transition relative py-1 ${
              activeTab === 'analytics' ? 'text-pink-500 border-b-2 border-pink-500 pb-1' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Analytics Console
          </button>
        </div>
      </div>

      {/* ── CONDITIONAL SUB-SYSTEM RENDERING LAYER ── */}
      <div className="flex-1 w-full h-full">
        {activeTab === 'feed' ? (
          /* 🎥 Mounts your Lounge Shorts feed controller exclusively */
          <div className="w-full h-full">
            <LoungeShortsFeed currentUserId={currentUserId} />
          </div>
        ) : (
          /* 📊 Mounts your secure, real-time private telemetry panel */
          <div className="w-full h-full pt-16">
            <ReachAnalyticsPanel currentUserId={currentUserId || 'anonymous_lounge_guest'} />
          </div>
        )}
      </div>

    </div>
  );
}
