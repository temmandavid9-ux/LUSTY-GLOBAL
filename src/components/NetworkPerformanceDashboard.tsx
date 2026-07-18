import { RequestPayoutButton } from './RequestPayoutButton';
import { useHostMetrics } from '../hooks/useHostMetrics';

interface NetworkPerformanceDashboardProps {
  currentUserId: string;
  uiStats?: {
    totalViews?: string;
    totalLikes?: string;
    engRate?: string;
  };
}

export function NetworkPerformanceDashboard({ currentUserId, uiStats = {} }: NetworkPerformanceDashboardProps) {
  const { metrics } = useHostMetrics(currentUserId);

  return (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 flex flex-col gap-6">
      {/* Payout Management Header Section */}
      <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            Payout Management
          </h3>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
            Pending Balance: ₦{metrics.pendingPayouts.toLocaleString()}
          </p>
        </div>

        <RequestPayoutButton 
          currentUserId={currentUserId}
          pendingBalance={metrics.pendingPayouts}
          onPayoutRequested={() => window.location.reload()}
        />
      </div>

      {/* Network Performance Grid Block Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase font-mono">
            Network Performance
          </span>
        </div>

        {/* Updated Flexible Columns Layout Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          
          <div className="bg-zinc-900/50 border border-zinc-800/60 p-3.5 rounded-xl text-center">
            <div className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 mb-1">Total Views</div>
            <div className="text-base font-bold text-white font-mono">{uiStats.totalViews || '18.8k'}</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/60 p-3.5 rounded-xl text-center">
            <div className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 mb-1">Total Likes</div>
            <div className="text-base font-bold text-white font-mono">{uiStats.totalLikes || '2.6k'}</div>
          </div>

          {/* 🌟 NEW UPDATE BLOCK: Live Followers Aggregate Card */}
          <div className="bg-zinc-900/50 border border-pink-900/20 p-3.5 rounded-xl text-center">
            <div className="text-[9px] uppercase font-mono tracking-wider text-pink-500 mb-1">Followers</div>
            <div className="text-base font-bold text-pink-400 font-mono">
              {metrics.totalFollowers.toLocaleString()}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-amber-900/30 p-3.5 rounded-xl text-center relative overflow-hidden">
            <div className="text-[9px] uppercase font-mono tracking-wider text-amber-500 mb-1">Processing</div>
            <div className="text-base font-bold text-amber-400 font-mono">
              ₦{metrics.processingPayouts.toLocaleString()}
            </div>
            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-500 rounded-bl-md animate-pulse" />
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/60 p-3.5 rounded-xl text-center">
            <div className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 mb-1">Eng. Rate</div>
            <div className="text-base font-bold text-emerald-400 font-mono">{uiStats.engRate || '13.9%'}</div>
          </div>

        </div>
      </div>
    </div>
  );
}
