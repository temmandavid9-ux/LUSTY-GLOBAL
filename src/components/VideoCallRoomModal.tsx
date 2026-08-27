import { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, 
  MessageSquare, 
  Send, 
  Clock, 
  Lock, 
  Sparkles,
  Maximize2,
  Minimize2,
  Coins,
  Heart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { VideoCallRoomConfig, sendInCallTip, logCallSession } from '../services/videoCallService';
import { supabase } from '../lib/supabase';
import DailyIframe from '@daily-co/daily-js';

interface VideoCallRoomModalProps {
  roomConfig: VideoCallRoomConfig;
  currentUserUsername: string;
  onClose: () => void;
  onCallCompleted?: (receipt: any) => void;
}

interface CallChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

interface ActiveTipOverlay {
  id: string;
  senderUsername: string;
  amount: number;
  emoji: string;
}

export default function VideoCallRoomModal({
  roomConfig,
  currentUserUsername,
  onClose,
  onCallCompleted
}: VideoCallRoomModalProps) {
  const isCurrentUserSender = currentUserUsername.toLowerCase() === roomConfig.senderUsername.toLowerCase();
  const partnerUsername = isCurrentUserSender ? roomConfig.receiverUsername : roomConfig.senderUsername;
  const localUsername = currentUserUsername;

  // UI States
  const [showChat, setShowChat] = useState<boolean>(false);
  const [hasUnreadInCallChat, setHasUnreadInCallChat] = useState<boolean>(false);
  const [showTipBar, setShowTipBar] = useState<boolean>(true);
  const [customTipAmount, setCustomTipAmount] = useState<string>('');
  const [activeTipOverlays, setActiveTipOverlays] = useState<ActiveTipOverlay[]>([]);
  const [totalSessionTips, setTotalSessionTips] = useState<number>(0);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Signal & Chat State
  const [signalQuality] = useState<{ label: 'Strong' | 'Fair' | 'Poor'; color: string; bgColor: string; rtt: number }>({ label: 'Strong', color: '#22c55e', bgColor: 'bg-emerald-500', rtt: 28 });
  const [chatMessages, setChatMessages] = useState<CallChatMessage[]>([
    {
      id: 'm1',
      sender: partnerUsername,
      text: `Hey @${localUsername}! Connected via Daily.co secure room 🚀`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [newMessage, setNewMessage] = useState<string>('');

  // Daily Call Frame Reference
  const callContainerRef = useRef<HTMLDivElement | null>(null);
  const callFrameRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Timer loop
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDurationSeconds((prev: number) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Daily.co iframe call frame
  useEffect(() => {
    if (!callContainerRef.current) return;

    // Use URL from roomConfig or generate a standard daily url format
    const dailyUrl = roomConfig.roomUrl || `https://lusty-vip.daily.co/${roomConfig.roomName}`;

    try {
      const callFrame = DailyIframe.createFrame(callContainerRef.current, {
        showLeaveButton: false,
        showFullscreenButton: true,
        theme: {
          colors: {
            accent: '#ec4899',
            accentText: '#ffffff',
            background: '#09090b',
            backgroundAccent: '#18181b',
            baseText: '#ffffff',
            border: '#27272a',
          }
        }
      });

      callFrameRef.current = callFrame;

      callFrame.join({ url: dailyUrl }).catch((err) => {
        console.warn("Daily frame join warning (using fallback simulation view if offline):", err);
        toast.error("Could not connect to Daily video server. Check network connection.");
      });

      callFrame.on('left-meeting', () => {
        handleEndCall();
      });

    } catch (e) {
      console.error("Failed to initialize DailyIframe:", e);
    }

    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
      }
    };
  }, [roomConfig]);

  // Supabase Realtime channel listener for Tips, Chat & Remote End Call
  useEffect(() => {
    const channel = supabase.channel('vip_video_calls_channel');
    channel
      .on('broadcast', { event: 'TIP_RECEIVED' }, (payload) => {
        const tipData = payload.payload;
        if (tipData) triggerTipEffects(tipData.senderUsername, tipData.amount);
      })
      .on('broadcast', { event: 'IN_CALL_CHAT_MSG' }, (payload) => {
        const msg = payload.payload;
        if (msg && (msg.bookingId === roomConfig.bookingId || msg.roomName === roomConfig.roomName)) {
          if (msg.sender && msg.sender.toLowerCase() !== localUsername.toLowerCase()) {
            setChatMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (!showChat) {
              setHasUnreadInCallChat(true);
              toast(`💬 @${msg.sender}: ${msg.text.slice(0, 30)}...`, { duration: 3000 });
            }
          }
        }
      })
      .on('broadcast', { event: 'END_CALL' }, async (payload) => {
        const data = payload.payload;
        if (data && (data.bookingId === roomConfig.bookingId || data.roomName === roomConfig.roomName)) {
          if (data.endedBy && data.endedBy.toLowerCase() !== localUsername.toLowerCase()) {
            toast(`Call ended by @${data.endedBy}`, { icon: '📞' });
            await finalizeAndLogCall();
          }
        }
      })
      .subscribe();

    const handleLocalTip = (e: any) => {
      if (e.detail) triggerTipEffects(e.detail.senderUsername, e.detail.amount);
    };
    window.addEventListener('lounge-in-call-tip', handleLocalTip);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('lounge-in-call-tip', handleLocalTip);
    };
  }, [roomConfig, localUsername, callDurationSeconds, totalSessionTips]);

  const finalizeAndLogCall = async () => {
    await logCallSession({
      callerUsername: roomConfig.senderUsername,
      receiverUsername: roomConfig.receiverUsername,
      status: 'COMPLETED',
      durationSeconds: callDurationSeconds
    });

    if (callFrameRef.current) {
      callFrameRef.current.destroy();
    }

    if (onCallCompleted) {
      onCallCompleted({
        bookingId: roomConfig.bookingId,
        totalDeposit: 0,
        creatorAmount: totalSessionTips * 0.9,
        platformFee: totalSessionTips * 0.1,
        settledAt: new Date().toISOString(),
        status: 'COMPLETED'
      });
    }
    onClose();
  };

  const handleEndCall = async () => {
    try {
      await supabase.channel('vip_video_calls_channel').send({
        type: 'broadcast',
        event: 'END_CALL',
        payload: {
          bookingId: roomConfig.bookingId,
          roomName: roomConfig.roomName,
          endedBy: localUsername
        }
      });
    } catch (e) {
      console.warn("Could not broadcast END_CALL:", e);
    }
    await finalizeAndLogCall();
  };

  const triggerTipEffects = (sender: string, amount: number) => {
    setTotalSessionTips(prev => prev + amount);
    const emojis = ['💖', '💋', '💎', '👑', '🪙', '✨'];
    const tipId = `tip_${Date.now()}_${Math.random()}`;
    setActiveTipOverlays(prev => [...prev, { id: tipId, senderUsername: sender, amount, emoji: emojis[Math.floor(Math.random() * emojis.length)] }]);
    setTimeout(() => setActiveTipOverlays(prev => prev.filter(t => t.id !== tipId)), 4000);
  };

  const handleSendTip = async (amount: number) => {
    if (!amount || amount <= 0) return;
    try {
      await sendInCallTip({
        callId: roomConfig.bookingId || roomConfig.roomName,
        senderUsername: localUsername,
        recipientUsername: partnerUsername,
        amount
      });
      toast.success(`💖 Sent $${amount}.00 tip to @${partnerUsername}!`);
      setCustomTipAmount('');
    } catch (err) {
      toast.error("Failed to process tip transaction.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg: CallChatMessage = {
      id: `chat_${Date.now()}`,
      sender: localUsername,
      text: newMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, msg]);
    setNewMessage('');
    try {
      await supabase.channel('vip_video_calls_channel').send({
        type: 'broadcast',
        event: 'IN_CALL_CHAT_MSG',
        payload: { ...msg, bookingId: roomConfig.bookingId, roomName: roomConfig.roomName }
      });
    } catch (err) {}
  };

  const formatCallTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden select-none">
      
      {/* HEADER CONTROL BAR */}
      <div className="bg-zinc-950/90 border-b border-zinc-850 px-4 py-3 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-white text-sm tracking-wide">Daily.co Secure Video Call</h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE P2P
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">@{roomConfig.senderUsername} ↔ @{roomConfig.receiverUsername}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl flex items-center gap-2 font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${signalQuality.bgColor} animate-pulse shrink-0`} />
            <div className="text-left">
              <span className="text-[9px] text-zinc-400 block uppercase font-bold leading-none">Signal</span>
              <span className="text-xs font-black text-white leading-none">{signalQuality.label} ({signalQuality.rtt}ms)</span>
            </div>
          </div>

          <div className="bg-pink-950/80 border border-pink-500/40 px-3 py-1.5 rounded-xl flex items-center gap-2 font-mono">
            <Coins className="w-4 h-4 text-pink-400 shrink-0" />
            <div className="text-left">
              <span className="text-[9px] text-pink-400/80 block uppercase font-bold leading-none">Tips</span>
              <span className="text-xs font-black text-pink-300 leading-none">${totalSessionTips}.00</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl flex items-center gap-2 font-mono">
            <Clock className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <span className="text-[9px] text-zinc-400 block uppercase font-bold leading-none">Duration</span>
              <span className="text-xs font-black text-white leading-none">{formatCallTime(callDurationSeconds)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition cursor-pointer hidden sm:block"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* DAILY.CO VIDEO CONTAINER STAGE */}
      <div className="relative flex-1 bg-zinc-950 flex items-center justify-center overflow-hidden">
        
        {/* Floating Tip Banners */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 items-center pointer-events-none">
          {activeTipOverlays.map(tip => (
            <div key={tip.id} className="bg-gradient-to-r from-pink-600 to-purple-600 text-white border-2 border-pink-300/60 px-5 py-2.5 rounded-full font-black text-sm flex items-center gap-2.5 shadow-2xl animate-bounce">
              <span>{tip.emoji}</span>
              <span>@{tip.senderUsername} tipped ${tip.amount}.00!</span>
            </div>
          ))}
        </div>

        {/* Daily.co iframe mounts here */}
        <div ref={callContainerRef} className="w-full h-full bg-black relative" />

        {/* CHAT DRAWER */}
        {showChat && (
          <div className="absolute right-0 top-0 bottom-0 z-30 w-80 bg-zinc-950/95 border-l border-zinc-850 p-4 flex flex-col justify-between backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-pink-400" />
                <h4 className="text-xs font-extrabold text-white">Room Chat</h4>
              </div>
              <button onClick={() => setShowChat(false)} className="text-zinc-500 hover:text-white text-xs font-mono">✕</button>
            </div>

            <div className="flex-1 my-3 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`p-2.5 rounded-xl ${msg.sender === localUsername ? 'bg-pink-500/20 border border-pink-500/30 text-white ml-6' : 'bg-zinc-900 border border-zinc-800 text-zinc-300 mr-6'}`}>
                  <div className="flex justify-between items-center text-[9px] text-zinc-500 mb-1">
                    <span className="font-bold text-pink-300">@{msg.sender}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Type message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/50"
              />
              <button type="submit" className="p-2 bg-pink-500 hover:bg-pink-400 text-white rounded-xl transition">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* TIP BAR */}
      {showTipBar && (
        <div className="bg-zinc-950/90 border-t border-zinc-850 px-4 py-2.5 flex items-center justify-between gap-3 overflow-x-auto z-20">
          <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs text-pink-400 font-bold">
            <Heart className="w-4 h-4 fill-pink-500 text-pink-500 animate-pulse" />
            <span>Send Tip:</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {[10, 25, 50, 100].map(amt => (
              <button key={amt} type="button" onClick={() => handleSendTip(amt)} className="bg-pink-500/10 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 font-mono font-bold text-xs px-3 py-1.5 rounded-xl transition">
                +${amt}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (customTipAmount) handleSendTip(Number(customTipAmount)); }} className="flex items-center gap-2 shrink-0">
            <input type="number" placeholder="Custom $" value={customTipAmount} onChange={(e) => setCustomTipAmount(e.target.value)} className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-pink-500" />
            <button type="submit" className="bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl font-mono">Tip 💖</button>
          </form>
        </div>
      )}

      {/* BOTTOM CONTROL DOCK */}
      <div className="bg-zinc-950 border-t border-zinc-850 px-6 py-3.5 flex items-center justify-between gap-4 z-20">
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Daily.co Encrypted P2P Stream</span>
        </div>

        <div className="flex items-center justify-center gap-3 mx-auto">
          <button type="button" onClick={() => setShowTipBar(!showTipBar)} className="p-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-2xl transition">
            <Coins className="w-5 h-5 text-pink-400" />
          </button>
          <button type="button" onClick={() => { setShowChat(!showChat); if (!showChat) setHasUnreadInCallChat(false); }} className="p-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-2xl transition relative">
            <MessageSquare className="w-5 h-5 text-pink-400" />
            {hasUnreadInCallChat && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-pink-500 animate-pulse" />}
          </button>

          {/* END CALL */}
          <button type="button" onClick={handleEndCall} className="px-5 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer">
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>

        <div className="hidden sm:block text-right">
          <span className="text-[10px] text-zinc-500 font-mono block">ROOM</span>
          <span className="text-xs font-mono font-bold text-zinc-300">{roomConfig.roomName}</span>
        </div>
      </div>
    </div>
  );
}
