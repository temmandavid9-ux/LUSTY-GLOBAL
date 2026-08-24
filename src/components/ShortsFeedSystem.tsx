import { useState, useCallback } from 'react';
import { LoungeShortsFeed } from './LoungeShortsFeed';
import { ReachAnalyticsPanel } from './ReachAnalyticsPanel';
import { useVideoPrefetcher } from '../hooks/useVideoPrefetcher';

interface ShortsFeedSystemProps {
  walletBalance?: number;
  onSpendFunds?: (amount: number) => Promise<void>;
  currentUserId?: string;
}

export default function ShortsFeedSystem({ walletBalance: _walletBalance = 1450.00, onSpendFunds: _onSpendFunds, currentUserId }: ShortsFeedSystemProps) {
  // Keep only 'feed' and 'analytics' tabs, defaulting to Lounge Broadcasts 'feed'
  const [activeTab, setActiveTab] = useState<'feed' | 'analytics'>('feed');
  const [feedPosts, setFeedPosts] = useState<any[]>([]);

  // 🚀 VIDEO PREFETCHING UTILITY: Buffers the next TWO videos in the feed queue for instant playback on scroll
  const { preloadedVideoIds, prefetchQueue } = useVideoPrefetcher(2);

  const handleShortsLoaded = useCallback((shorts: any[]) => {
    setFeedPosts(shorts);
    if (shorts && shorts.length > 0) {
      // Buffer the next 2 videos starting from index 0
      prefetchQueue(shorts, 0);
    }
  }, [prefetchQueue]);

  const handleActiveVideoChange = useCallback((activeVideo: any) => {
    if (!feedPosts || feedPosts.length === 0) return;
    const currentIndex = feedPosts.findIndex(p => p.id === activeVideo.id);
    if (currentIndex !== -1) {
      prefetchQueue(feedPosts, currentIndex);
    }
  }, [feedPosts, prefetchQueue]);

  const handleActiveVideoProgress = useCallback((
    currentIndex: number,
    _currentVideoId: string | number,
    _progressPercent: number,
    _nextVideoId: string | number | null
  ) => {
    // Continuously ensure the next 2 videos in the feed queue are buffered in background
    if (feedPosts && feedPosts.length > 0) {
      prefetchQueue(feedPosts, currentIndex);
    }
  }, [feedPosts, prefetchQueue]);

  return (
    <div id="ShortsFeedSystem" className="w-full h-full bg-black relative flex flex-col">
      
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
            <LoungeShortsFeed 
              currentUserId={currentUserId} 
              preloadedVideoIds={preloadedVideoIds}
              onShortsLoaded={handleShortsLoaded}
              onActiveVideoChange={handleActiveVideoChange}
              onActiveVideoProgress={handleActiveVideoProgress}
            />
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

