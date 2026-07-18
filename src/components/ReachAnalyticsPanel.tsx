import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, Percent, Eye } from 'lucide-react';
import { formatMetricCount } from '../utils/formatMetrics';

interface LoungeShortItem {
  id: string;
  video_url: string;
  caption: string;
  views_count: number;
  likes_count: number;
  host_id: string;
  profiles?: {
    username: string;
    avatar_url: string;
    is_verified: boolean;
    title: string;
  };
}

interface ReachAnalyticsPanelProps {
  currentUserId: string;
}

export function ReachAnalyticsPanel({ currentUserId }: ReachAnalyticsPanelProps) {
  const [videos, setVideos] = useState<LoungeShortItem[]>([]);
  const [totalFollowers, setTotalFollowers] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // ── 1. CORE DATA STREAM FETCH ──
  const fetchLoungeAnalyticsData = async () => {
    if (!currentUserId) return;
    try {
      const { data: shortsData, error: shortsError } = await supabase
        .from('lounge_shorts')
        .select(`
          id,
          video_url,
          caption,
          views_count,
          likes_count,
          host_id,
          profiles:host_id ( username, avatar_url, is_verified, title )
        `)
        .eq('host_id', currentUserId)
        .order('created_at', { ascending: false });

      if (shortsError) throw shortsError;
      if (shortsData) setVideos(shortsData as any);

      // Fetch accurate real-time followers 
      const { count, error: followError } = await supabase
        .from('user_followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', currentUserId);

      if (!followError) setTotalFollowers(count || 0);

    } catch (err) {
      console.error("Error fetching analytics stream:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── 2. REAL-TIME MULTI-CHANNEL LISTENER UPDATE ──
  useEffect(() => {
    if (!currentUserId) return;

    // Run initial population fetch
    fetchLoungeAnalyticsData();

    // Listen to the live shorts changes channel
    const shortsChannel = supabase
      .channel(`lounge-analytics-stream-${Math.random().toString(36).substring(2, 11)}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'lounge_shorts' 
        },
        (payload) => {
          // 🧠 In-Memory Check: Only trigger a re-fetch if the changed row belongs to THIS host
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          
          if (newRow?.host_id === currentUserId || oldRow?.host_id === currentUserId) {
            console.log('⚡ Target metrics updated! Syncing pipeline counters...');
            fetchLoungeAnalyticsData(); // Auto-hydrate interface views
          }
        }
      )
      .subscribe();

    // Listen to live fan follower changes
    const followsChannel = supabase
      .channel(`lounge-followers-stream-${Math.random().toString(36).substring(2, 11)}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_followers' 
        },
        () => {
          fetchLoungeAnalyticsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shortsChannel);
      supabase.removeChannel(followsChannel);
    };
  }, [currentUserId]);

  // ── 3. METRIC CALCULATIONS ──
  const aggregatedViews = videos.reduce((acc, curr) => acc + (curr.views_count || 0), 0);
  const aggregatedLikes = videos.reduce((acc, curr) => acc + (curr.likes_count || 0), 0);
  const computedEngagement = aggregatedViews > 0 
    ? ((aggregatedLikes / aggregatedViews) * 100).toFixed(1) 
    : '0.0';

  const maxViewTrend = Math.max(...videos.map(v => v.views_count), 100);

  const formatCompact = (val: number): string => {
    return formatMetricCount(val);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-500 font-mono text-xs">
        Establishing live telemetry pipeline...
      </div>
    );
  }

  return (
    <div className="w-full bg-zinc-950 p-4 md:p-6 overflow-y-auto h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
              <TrendingUp className="w-4 h-4 text-pink-500" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-white uppercase font-sans">Lounge Live Telemetry</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time auditable performance metrics streaming live from database triggers.
          </p>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-850">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="font-mono uppercase font-black tracking-wider text-emerald-400">Connected Realtime</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Eye className="w-10 h-10 text-white" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-500 block mb-1">Total Views</span>
          <span className="text-2xl font-black text-white font-mono tracking-tight">{formatCompact(aggregatedViews)}</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-10 h-10 text-pink-500" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-500 block mb-1">Total Likes</span>
          <span className="text-2xl font-black text-pink-500 font-mono tracking-tight">{formatCompact(aggregatedLikes)}</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Percent className="w-10 h-10 text-emerald-400" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-500 block mb-1">Engagement Rate</span>
          <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">{computedEngagement}%</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Users className="w-10 h-10 text-amber-400" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-500 block mb-1">Lounge Fans</span>
          <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">{formatCompact(totalFollowers)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-850 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
            <span className="text-xs uppercase font-mono tracking-widest text-zinc-400 font-black">Video Performance Chart</span>
          </div>

          <div className="relative h-[160px] w-full flex items-end justify-between gap-1 border-b border-zinc-800 pb-2">
            {videos.slice(0, 7).map((v, idx) => {
              const viewHeight = Math.max(10, Math.min(100, (v.views_count / maxViewTrend) * 100));
              return (
                <div key={v.id} className="flex-1 flex flex-col items-center group relative">
                  <div className="w-full flex items-end justify-center h-[110px]">
                    <div 
                      style={{ height: `${viewHeight}%` }} 
                      className="w-4 bg-gradient-to-t from-pink-700/40 to-pink-500 rounded-t-sm transition-all duration-300"
                    />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-mono mt-2">Clip #{videos.length - idx}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
            <span className="text-xs uppercase font-mono tracking-widest text-zinc-400 font-black">Live Video Standings</span>
          </div>
          <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto no-scrollbar">
            {videos.map((vid, idx) => (
              <div key={vid.id} className="w-full flex items-center justify-between border border-zinc-850/40 rounded-xl p-2.5 text-xs bg-zinc-900/30">
                <span className="font-mono text-zinc-500 font-bold">#{idx + 1}</span>
                <span className="text-zinc-300 truncate max-w-[120px]">{vid.caption || "Untitled Broadcast"}</span>
                <span className="text-pink-500 font-mono text-[10px]">❤️ {formatCompact(vid.likes_count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
