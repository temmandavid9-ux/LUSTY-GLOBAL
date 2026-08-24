import { useState, useEffect } from 'react';
import { PhoneOff, PhoneIncoming, PhoneOutgoing, Video, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCallHistory, CallSessionRecord, initiateVideoCallSignal } from '../services/videoCallService';
import { COMPANIONS } from '../data';

interface RecentCallsViewProps {
  currentUsername: string;
  onSelectUserForChat?: (userId: string) => void;
}

export default function RecentCallsView({ currentUsername, onSelectUserForChat }: RecentCallsViewProps) {
  const [callLogs, setCallLogs] = useState<CallSessionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'MISSED' | 'COMPLETED' | 'DECLINED'>('ALL');
  const [isCallingUser, setIsCallingUser] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const records = await fetchCallHistory(currentUsername);
      setCallLogs(records);
    } catch (e) {
      console.warn("Failed to load call history:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();

    const handleUpdate = () => {
      loadHistory();
    };

    window.addEventListener('lounge-call-history-updated', handleUpdate);
    window.addEventListener('lounge-missed-call-logged', handleUpdate);

    return () => {
      window.removeEventListener('lounge-call-history-updated', handleUpdate);
      window.removeEventListener('lounge-missed-call-logged', handleUpdate);
    };
  }, [currentUsername]);

  // Format Duration MM:SS
  const formatDuration = (secs?: number) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Format Date/Time
  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recently';
    }
  };

  // Handle Redial / Call Back
  const handleCallBack = async (otherUsername: string) => {
    setIsCallingUser(otherUsername);
    const companion = COMPANIONS.find(c => c.username.toLowerCase() === otherUsername.toLowerCase());
    const otherAvatar = companion ? companion.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';
    const myCompanion = COMPANIONS.find(c => c.username.toLowerCase() === currentUsername.toLowerCase());
    const myAvatar = myCompanion ? myCompanion.avatar : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80';

    toast.loading(`Calling @${otherUsername}...`, { id: 'callback_toast' });

    try {
      const res = await initiateVideoCallSignal({
        senderUsername: currentUsername,
        senderAvatar: myAvatar,
        receiverUsername: otherUsername,
        receiverAvatar: otherAvatar,
        isFreeCall: true,
        location: 'VIP Direct Call Session'
      });

      toast.dismiss('callback_toast');
      if (res.success) {
        toast.success(`Ringing @${otherUsername}...`, { icon: '📞' });
      } else {
        toast.error(res.message || `Could not call @${otherUsername}`);
      }
    } catch (e) {
      toast.dismiss('callback_toast');
      toast.error(`Call attempt failed.`);
    } finally {
      setIsCallingUser(null);
    }
  };

  // Filter logs
  const filteredLogs = callLogs.filter(log => {
    if (filter === 'ALL') return true;
    if (filter === 'MISSED') return log.status === 'MISSED';
    if (filter === 'COMPLETED') return log.status === 'COMPLETED';
    if (filter === 'DECLINED') return log.status === 'DECLINED' || log.status === 'CANCELLED';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#09090b]/80 border border-zinc-900 rounded-2xl md:rounded-3xl overflow-hidden">
      {/* Top Header */}
      <div className="p-4 bg-[#0c0c0e] border-b border-zinc-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              Recent Call Logs
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                {callLogs.length} Total
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono">
              Recorded WebRTC Direct Video & Audio Connections
            </p>
          </div>
        </div>

        <button
          onClick={loadHistory}
          disabled={loading}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition active:scale-95 cursor-pointer"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-pink-400' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-[#09090b] border-b border-zinc-900 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {(['ALL', 'COMPLETED', 'MISSED', 'DECLINED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filter === tab
                ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {tab === 'ALL' && 'All Calls'}
            {tab === 'COMPLETED' && '🟢 Answered'}
            {tab === 'MISSED' && '🔴 Missed'}
            {tab === 'DECLINED' && '🟠 Declined'}
          </button>
        ))}
      </div>

      {/* Call History List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs">
            Loading call history...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center text-zinc-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <PhoneOff className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-300">No Call Logs Found</p>
              <p className="text-xs text-zinc-500 font-mono mt-1">
                {filter !== 'ALL' ? `No calls match the "${filter}" filter.` : 'You have not made or received any video calls yet.'}
              </p>
            </div>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isCaller = log.caller_username.toLowerCase() === currentUsername.toLowerCase();
            const otherUser = isCaller ? log.receiver_username : log.caller_username;
            const companion = COMPANIONS.find(c => c.username.toLowerCase() === otherUser.toLowerCase());
            const avatar = companion ? companion.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';

            const isCompleted = log.status === 'COMPLETED';
            const isMissed = log.status === 'MISSED';

            return (
              <div
                key={log.id || `log_${index}`}
                className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 p-3.5 rounded-2xl flex items-center justify-between transition group"
              >
                {/* Left Side: Avatar, Name & Status */}
                <div 
                  className={`flex items-center gap-3 min-w-0 ${companion && onSelectUserForChat ? 'cursor-pointer hover:opacity-90' : ''}`}
                  onClick={() => {
                    if (companion && onSelectUserForChat) {
                      onSelectUserForChat(companion.id);
                    }
                  }}
                >
                  <div className="relative shrink-0">
                    <img
                      src={avatar}
                      alt={otherUser}
                      className="w-11 h-11 rounded-full object-cover border border-zinc-700 bg-zinc-800"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white border-2 border-zinc-950 text-[10px] ${
                      isCompleted ? 'bg-emerald-500' : isMissed ? 'bg-rose-500' : 'bg-amber-500'
                    }`}>
                      {isCaller ? (
                        <PhoneOutgoing className="w-2.5 h-2.5" />
                      ) : (
                        <PhoneIncoming className="w-2.5 h-2.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">@{otherUser}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                        isCompleted 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : isMissed 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {isCompleted ? 'Completed' : isMissed ? 'Missed' : 'Declined'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        {formatTime(log.created_at)}
                      </span>
                      {isCompleted && log.duration_seconds ? (
                        <span className="text-emerald-400 font-bold">
                          ⏱ {formatDuration(log.duration_seconds)}
                        </span>
                      ) : log.reason ? (
                        <span className="text-zinc-500 italic">
                          ({log.reason})
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right Side: Call Back Button */}
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => handleCallBack(otherUser)}
                    disabled={isCallingUser === otherUser}
                    className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-pink-950/30 cursor-pointer disabled:opacity-50"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Call Back</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
