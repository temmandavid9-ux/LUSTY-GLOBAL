import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import { VideoCallRoomConfig, startVideoCallSession, recordCallDecline, clearCallDecline, logMissedCallInChat } from '../services/videoCallService';
import { supabase } from '../lib/supabase';

export interface IncomingCallData {
  callId: string;
  bookingId: string;
  callerUsername: string;
  callerAvatar: string;
  receiverUsername: string;
  receiverAvatar: string;
  escrowDeposit: number;
  durationMinutes: number;
  location: string;
  roomUrl?: string;
  roomName?: string;
}

interface IncomingCallModalProps {
  currentUsername: string;
  onAcceptCall: (config: VideoCallRoomConfig) => void;
}

// 🔊 Web Audio Synthesizer Engine for realistic VIP phone ringtone sound
class RingtoneSynthEngine {
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

      const playDualToneRing = () => {
        if (!this.ctx || !this.isRinging) return;
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }

        const now = this.ctx.currentTime;

        // First Ring Pulse
        this.emitPulse(now, 440, 880); // A4 + A5
        // Second Ring Pulse (0.2s delay)
        this.emitPulse(now + 0.25, 480, 960);
      };

      playDualToneRing();
      this.intervalId = setInterval(playDualToneRing, 2200); // Ring pattern repeats every 2.2 seconds
    } catch (err) {
      console.warn("Web Audio Ringtone Synth engine notice:", err);
    }
  }

  private emitPulse(startTime: number, freq1: number, freq2: number) {
    if (!this.ctx) return;

    // Oscillator 1
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq1, startTime);
    gain1.gain.setValueAtTime(0.0, startTime);
    gain1.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.45);

    // Oscillator 2 (Harmonic Octave)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq2, startTime);
    gain2.gain.setValueAtTime(0.0, startTime);
    gain2.gain.linearRampToValueAtTime(0.05, startTime + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(startTime);
    osc2.stop(startTime + 0.45);
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

export default function IncomingCallModal({ currentUsername, onAcceptCall }: IncomingCallModalProps) {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isMutedSound, setIsMutedSound] = useState<boolean>(false);
  const ringtoneSynthRef = useRef<RingtoneSynthEngine>(new RingtoneSynthEngine());

  // Listen for Realtime Incoming Video Call Signals
  useEffect(() => {
    // 📡 1. Supabase Realtime Broadcast Channel for Cross-User Call Signaling
    const callChannel = supabase.channel('vip_video_calls_channel', {
      config: { broadcast: { self: true } }
    });

    callChannel
      .on('broadcast', { event: 'INCOMING_CALL' }, (payload) => {
        const data = payload.payload as IncomingCallData;
        console.log("📞 INCOMING_CALL signal received:", data);

        // 🛑 Guard: Do NOT pop up incoming call ringtone/modal if caller is the current user!
        if (data.callerUsername && currentUsername && data.callerUsername.toLowerCase() === currentUsername.toLowerCase()) {
          return;
        }

        // 🛑 Guard: Only show modal if current user is the intended receiver
        if (
          data.receiverUsername &&
          currentUsername &&
          data.receiverUsername.toLowerCase() !== currentUsername.toLowerCase()
        ) {
          return;
        }

        setIncomingCall(data);
      })
      .on('broadcast', { event: 'CALL_REJECTED' }, (payload) => {
        const data = payload.payload;
        if (incomingCall && incomingCall.callId === data?.callId) {
          setIncomingCall(null);
          toast.error(`Call was declined by @${data.rejectedBy || 'User'}`);
        }
      })
      .on('broadcast', { event: 'CALL_CANCELLED' }, (payload) => {
        const data = payload.payload;
        if (incomingCall && incomingCall.callId === data?.callId) {
          setIncomingCall(null);
          toast("Caller cancelled the call", { icon: '📵' });
        }
      })
      .subscribe();

    // 2. Custom Window Event for Direct Trigger (In-App buttons)
    const handleDirectIncomingCall = (e: any) => {
      const data = e.detail as IncomingCallData;
      if (data) {
        // Guard check for local dispatch
        if (data.callerUsername && currentUsername && data.callerUsername.toLowerCase() === currentUsername.toLowerCase()) {
          return;
        }
        if (data.receiverUsername && currentUsername && data.receiverUsername.toLowerCase() !== currentUsername.toLowerCase()) {
          return;
        }
        setIncomingCall(data);
      }
    };

    window.addEventListener('lounge-incoming-call-signal', handleDirectIncomingCall);

    return () => {
      supabase.removeChannel(callChannel);
      window.removeEventListener('lounge-incoming-call-signal', handleDirectIncomingCall);
    };
  }, [currentUsername, incomingCall?.callId]);

  // 🔊 Start Ringtone when modal pops up
  useEffect(() => {
    if (incomingCall && !isMutedSound) {
      ringtoneSynthRef.current.start();
    } else {
      ringtoneSynthRef.current.stop();
    }

    return () => {
      ringtoneSynthRef.current.stop();
    };
  }, [incomingCall, isMutedSound]);

  // Handle Accept
  const handleAccept = async () => {
    if (!incomingCall) return;

    ringtoneSynthRef.current.stop();

    // Clear any decline cooldown tracking since call was accepted
    clearCallDecline(incomingCall.callerUsername, incomingCall.receiverUsername);

    toast.success(`📞 Call Accepted! Connecting to 1-on-1 WebRTC session...`, { icon: '✨' });

    try {
      const roomConfig = await startVideoCallSession({
        bookingId: incomingCall.bookingId,
        durationMinutes: incomingCall.durationMinutes || 120,
        senderUsername: incomingCall.callerUsername,
        senderAvatar: incomingCall.callerAvatar,
        receiverUsername: incomingCall.receiverUsername,
        receiverAvatar: incomingCall.receiverAvatar,
        escrowDeposit: 0,
        location: incomingCall.location
      });

      // Broadcast CALL_ACCEPTED so caller's Outgoing Call Modal transitions to active video call
      try {
        await supabase.channel('vip_video_calls_channel').send({
          type: 'broadcast',
          event: 'CALL_ACCEPTED',
          payload: {
            callId: incomingCall.callId,
            roomConfig,
            acceptedBy: currentUsername
          }
        });
      } catch (e) {
        console.warn("Could not broadcast CALL_ACCEPTED:", e);
      }

      onAcceptCall(roomConfig);
    } catch (err) {
      console.error("Failed to accept call:", err);
      toast.error("Could not initialize video room.");
    } finally {
      setIncomingCall(null);
    }
  };

  // Handle Decline
  const handleDecline = () => {
    if (!incomingCall) return;

    ringtoneSynthRef.current.stop();

    // Record decline for rate limiting safeguard (15 min cooldown on 2 declines)
    recordCallDecline(incomingCall.callerUsername, incomingCall.receiverUsername);

    // Log missed call in chat
    logMissedCallInChat(incomingCall.callerUsername, incomingCall.receiverUsername, "Declined");

    // Broadcast rejection signal
    supabase.channel('vip_video_calls_channel').send({
      type: 'broadcast',
      event: 'CALL_REJECTED',
      payload: {
        callId: incomingCall.callId,
        rejectedBy: currentUsername
      }
    });

    toast("Call declined", { icon: '📵' });
    setIncomingCall(null);
  };

  if (!incomingCall) return null;
  if (incomingCall.callerUsername && currentUsername && incomingCall.callerUsername.toLowerCase() === currentUsername.toLowerCase()) {
    return null;
  }
  if (incomingCall.receiverUsername && currentUsername && incomingCall.receiverUsername.toLowerCase() !== currentUsername.toLowerCase()) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-sm bg-zinc-950 border-2 border-pink-500/40 rounded-3xl p-6 text-center shadow-2xl shadow-pink-500/20 overflow-hidden">
        
        {/* Animated Radial Pulse Backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/10 via-transparent to-purple-500/10 pointer-events-none" />
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-pink-500/20 blur-3xl rounded-full pointer-events-none animate-pulse" />

        {/* Mute/Unmute Sound Toggle */}
        <button
          type="button"
          onClick={() => setIsMutedSound(!isMutedSound)}
          className="absolute top-4 right-4 p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
          title={isMutedSound ? "Unmute Ringtone" : "Mute Ringtone"}
        >
          {isMutedSound ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />}
        </button>

        {/* Caller Avatar with Pulsing Rings */}
        <div className="relative w-24 h-24 mx-auto my-3 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-pink-500/40 animate-ping opacity-75" />
          <span className="absolute -inset-2 rounded-full border border-pink-400/30 animate-pulse" />
          <img
            src={incomingCall.callerAvatar}
            alt={incomingCall.callerUsername}
            className="relative w-24 h-24 rounded-full object-cover border-2 border-pink-500 shadow-xl"
          />
        </div>

        {/* Call Info Header */}
        <div className="mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Incoming VIP 1-on-1 Free Video Call</span>
          </div>

          <h3 className="text-xl font-black text-white tracking-tight">
            @{incomingCall.callerUsername}
          </h3>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">
            is calling you... (Direct Free Connection)
          </p>
        </div>

        {/* Clean Call Location / Status Badge */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 my-4 font-mono text-xs text-center space-y-1">
          <div className="flex justify-between items-center text-zinc-400 text-[11px]">
            <span>Channel:</span>
            <span className="text-white font-bold">{incomingCall.location}</span>
          </div>
          <div className="flex justify-between items-center text-emerald-400 text-[11px] font-bold border-t border-zinc-800/80 pt-1">
            <span>Session Rate:</span>
            <span>100% Free Direct Stream</span>
          </div>
        </div>

        {/* Action Buttons: Accept / Decline */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={handleDecline}
            className="py-3.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 rounded-2xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            onClick={handleAccept}
            className="py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-2xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>Accept Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}
