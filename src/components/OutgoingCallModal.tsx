import { useState, useEffect, useRef } from 'react';
import { PhoneOff, Volume2, VolumeX, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
import { VideoCallRoomConfig, logMissedCallInChat } from '../services/videoCallService';
import { supabase } from '../lib/supabase';

export interface OutgoingCallData {
  callId: string;
  bookingId: string;
  callerUsername: string;
  callerAvatar: string;
  receiverUsername: string;
  receiverAvatar: string;
  durationMinutes: number;
  location: string;
}

interface OutgoingCallModalProps {
  outgoingCall: OutgoingCallData | null;
  currentUsername: string;
  onCancelCall: () => void;
  onCallAccepted: (config: VideoCallRoomConfig) => void;
}

// 🔊 Web Audio Synthesizer Engine for realistic outgoing telephone ringback tone (double beep)
class RingbackSynthEngine {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;
  private isRinging: boolean = false;

  start() {
    if (this.isRinging) return;
    this.isRinging = true;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();

      const playRingbackPattern = () => {
        if (!this.ctx || !this.isRinging) return;
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        // Telecom double-beep ringback: 440Hz + 480Hz
        this.emitPulse(now, 0.5);
        this.emitPulse(now + 0.7, 0.5);
      };

      playRingbackPattern();
      this.intervalId = setInterval(playRingbackPattern, 3200);
    } catch (err) {
      console.warn("Ringback synth notice:", err);
    }
  }

  private emitPulse(startTime: number, duration: number) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, startTime);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(480, startTime);

    gain.gain.setValueAtTime(0.0, startTime);
    gain.gain.linearRampToValueAtTime(0.03, startTime + 0.05);
    gain.gain.setValueAtTime(0.03, startTime + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0.001, startTime + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
  }

  stop() {
    this.isRinging = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {
        // ignore
      }
      this.ctx = null;
    }
  }
}

export default function OutgoingCallModal({
  outgoingCall,
  currentUsername,
  onCancelCall,
  onCallAccepted
}: OutgoingCallModalProps) {
  const [isMutedSound, setIsMutedSound] = useState<boolean>(false);
  const ringbackSynthRef = useRef<RingbackSynthEngine>(new RingbackSynthEngine());

  // Listen for Realtime Call Accepted / Declined signals & Auto Ring Timeout (45s)
  useEffect(() => {
    if (!outgoingCall) return;

    // 45-second ring timeout if recipient does not answer
    const timeoutTimer = setTimeout(() => {
      ringbackSynthRef.current.stop();
      logMissedCallInChat(outgoingCall.callerUsername, outgoingCall.receiverUsername, "No Answer");
      toast.error(`No answer from @${outgoingCall.receiverUsername}. Missed call logged in chat.`, { duration: 4000 });
      onCancelCall();
    }, 45000);

    const channel = supabase.channel('vip_video_calls_channel', {
      config: { broadcast: { self: true } }
    });

    channel
      .on('broadcast', { event: 'CALL_ACCEPTED' }, (payload) => {
        const data = payload.payload;
        if (data && data.callId === outgoingCall.callId) {
          clearTimeout(timeoutTimer);
          ringbackSynthRef.current.stop();
          toast.success(`🎉 @${outgoingCall.receiverUsername} accepted the call! Connecting...`, { icon: '✨' });
          if (data.roomConfig) {
            onCallAccepted(data.roomConfig);
          }
        }
      })
      .on('broadcast', { event: 'CALL_REJECTED' }, (payload) => {
        const data = payload.payload;
        if (data && data.callId === outgoingCall.callId) {
          clearTimeout(timeoutTimer);
          ringbackSynthRef.current.stop();
          logMissedCallInChat(outgoingCall.callerUsername, outgoingCall.receiverUsername, "Declined");
          toast.error(`Call was declined by @${outgoingCall.receiverUsername}`, { icon: '📵' });
          onCancelCall();
        }
      })
      .subscribe();

    return () => {
      clearTimeout(timeoutTimer);
      supabase.removeChannel(channel);
    };
  }, [outgoingCall, onCallAccepted, onCancelCall]);

  // Audio ringback controller
  useEffect(() => {
    if (outgoingCall && !isMutedSound) {
      ringbackSynthRef.current.start();
    } else {
      ringbackSynthRef.current.stop();
    }

    return () => {
      ringbackSynthRef.current.stop();
    };
  }, [outgoingCall, isMutedSound]);

  const handleCancel = () => {
    if (!outgoingCall) return;

    ringbackSynthRef.current.stop();

    // Log missed call in chat
    logMissedCallInChat(outgoingCall.callerUsername, outgoingCall.receiverUsername, "Cancelled by Caller");

    // Broadcast cancellation signal to receiver
    try {
      supabase.channel('vip_video_calls_channel').send({
        type: 'broadcast',
        event: 'CALL_CANCELLED',
        payload: {
          callId: outgoingCall.callId,
          cancelledBy: currentUsername
        }
      });
    } catch (e) {
      // ignore
    }

    toast("Call cancelled", { icon: '🚫' });
    onCancelCall();
  };

  if (!outgoingCall) return null;
  if (outgoingCall.callerUsername && currentUsername && outgoingCall.callerUsername.toLowerCase() !== currentUsername.toLowerCase()) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-sm bg-zinc-950 border-2 border-emerald-500/40 rounded-3xl p-6 text-center shadow-2xl shadow-emerald-500/20 overflow-hidden font-sans">
        
        {/* Animated Radial Pulse Backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-blue-500/10 pointer-events-none" />
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none animate-pulse" />

        {/* Mute/Unmute Ringback Sound */}
        <button
          type="button"
          onClick={() => setIsMutedSound(!isMutedSound)}
          className="absolute top-4 right-4 p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
          title={isMutedSound ? "Unmute Ringback Sound" : "Mute Ringback Sound"}
        >
          {isMutedSound ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />}
        </button>

        {/* Target Receiver Avatar with Pulsing Rings */}
        <div className="relative w-24 h-24 mx-auto my-3 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-ping opacity-75" />
          <span className="absolute -inset-2 rounded-full border border-emerald-400/30 animate-pulse" />
          <img
            src={outgoingCall.receiverAvatar}
            alt={outgoingCall.receiverUsername}
            className="relative w-24 h-24 rounded-full object-cover border-2 border-emerald-500 shadow-xl"
          />
        </div>

        {/* Outgoing Header Info */}
        <div className="mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
            <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
            <span>Calling • Ringing Target Device</span>
          </div>

          <h3 className="text-xl font-black text-white tracking-tight">
            @{outgoingCall.receiverUsername}
          </h3>
          <p className="text-xs text-zinc-400 font-mono mt-0.5 animate-pulse">
            Waiting for recipient to answer...
          </p>
        </div>

        {/* Channel Details */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 my-4 font-mono text-xs text-center space-y-1">
          <div className="flex justify-between items-center text-zinc-400 text-[11px]">
            <span>Channel:</span>
            <span className="text-white font-bold">{outgoingCall.location}</span>
          </div>
          <div className="flex justify-between items-center text-emerald-400 text-[11px] font-bold border-t border-zinc-800/80 pt-1">
            <span>Stream Rate:</span>
            <span>100% Free VIP Call</span>
          </div>
        </div>

        {/* Cancel Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={handleCancel}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Cancel Call</span>
          </button>
        </div>

      </div>
    </div>
  );
}
