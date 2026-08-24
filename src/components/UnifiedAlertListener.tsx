import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';

interface UnifiedAlertListenerProps {
  currentUserId: string;
}

// 🔊 Robust Web Audio Synthesizer fallback for 100% reliable offline/sandboxed alerts
class SynthAlarmEngine {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;

  start() {
    if (this.intervalId) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();

      const playBeep = () => {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, time);
        osc.frequency.exponentialRampToValueAtTime(1500, time + 0.2);
        osc.frequency.exponentialRampToValueAtTime(800, time + 0.4);
        
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.5);
      };

      playBeep();
      this.intervalId = setInterval(playBeep, 500);
    } catch (err) {
      console.warn("Synth alarm failed to start:", err);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

class SynthChimeEngine {
  play() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const time = ctx.currentTime;
      
      const playTone = (freq: number, delay: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time + delay);
        
        gain.gain.setValueAtTime(0.0, time + delay);
        gain.gain.linearRampToValueAtTime(0.08, time + delay + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, time + delay + dur);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time + delay);
        osc.stop(time + delay + dur);
      };

      playTone(880, 0, 0.3); // A5
      playTone(1318.51, 0.06, 0.5); // E6
    } catch (err) {
      console.warn("Synth chime failed to play:", err);
    }
  }
}

export function UnifiedAlertListener({ currentUserId }: UnifiedAlertListenerProps) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [latestBooking, setLatestBooking] = useState<any>(null);

  const bookingAudio = useRef<HTMLAudioElement | null>(null);
  const messageAudio = useRef<HTMLAudioElement | null>(null);
  const bookingAudioHasError = useRef(false);
  const messageAudioHasError = useRef(false);
  const synthAlarm = useRef<SynthAlarmEngine>(new SynthAlarmEngine());
  const synthChime = useRef<SynthChimeEngine>(new SynthChimeEngine());

  // Restore previous audio preferences on load & listen for external toggles from profile dropdown
  useEffect(() => {
    const saved = localStorage.getItem('lounge_alert_sounds_active');
    if (saved !== 'false') {
      setSoundEnabled(true);
    }

    const handleExternalToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetState = customEvent.detail?.enabled;
      if (typeof targetState === 'boolean') {
        setSoundEnabled(targetState);
        if (targetState) {
          localStorage.setItem('lounge_alert_sounds_active', 'true');
          toast.success("🔊 High-Volume Audio Alert Channels Armed & Active!", {
            icon: '🔔',
            style: {
              background: '#0c0a0f',
              color: '#ffffff',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              fontFamily: 'monospace',
              fontSize: '11px'
            }
          });
          synthChime.current.play();
        } else {
          localStorage.setItem('lounge_alert_sounds_active', 'false');
          stopAllSounds();
          toast.error("🔇 Audio alerts muted. Alarms will be visual only.", {
            style: {
              background: '#0c0a0f',
              color: '#ffffff',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              fontFamily: 'monospace',
              fontSize: '11px'
            }
          });
        }
      } else {
        handleToggleSound();
      }
    };

    window.addEventListener('lounge-toggle-sound-alert', handleExternalToggle);
    return () => {
      window.removeEventListener('lounge-toggle-sound-alert', handleExternalToggle);
    };
  }, []);

  // 🔓 Unlock browser audio autoplay restrictions on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.01);
        }
      } catch (e) {}

      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId || currentUserId === 'anon_user' || currentUserId.trim() === '') return;

    bookingAudioHasError.current = false;
    messageAudioHasError.current = false;

    // 2. Subscribe to Supabase Realtime alerts channel
    const alertsChannel = supabase
      .channel(`lounge_unified_alerts_${currentUserId}_${Math.random().toString(36).substring(2, 9)}`)
      
      // WATCH BOOKINGS FOR THIS HOST
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          const companionId = payload.new.companion_id || payload.new.companionId;
          if (companionId === currentUserId) {
            console.log('🚨 Realtime alert: New Booking Request received!', payload);
            setLatestBooking(payload.new);
            setIsRinging(true);
            triggerBookingAlarm();
          }
        }
      )
      
      // WATCH CHAT MESSAGES FOR THIS HOST
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const receiverId = payload.new.receiver_id || payload.new.recipient_id || payload.new.receiverId;
          const senderId = payload.new.sender_id || payload.new.senderId;
          
          if (receiverId === currentUserId && senderId !== currentUserId) {
            console.log('💬 Realtime alert: New Chat Message received!', payload);
            triggerMessageChime();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertsChannel);
      stopAllSounds();
    };
  }, [currentUserId, soundEnabled]);

  const triggerBookingAlarm = () => {
    if (!soundEnabled) {
      return;
    }

    if (!bookingAudio.current) {
      const bAudio = new Audio('/booking_alarm.mp3');
      bAudio.loop = true;
      bAudio.onerror = () => {
        bookingAudioHasError.current = true;
        synthAlarm.current.start();
      };
      bookingAudio.current = bAudio;
    }

    if (!bookingAudioHasError.current) {
      bookingAudio.current.play()
        .catch(() => {
          bookingAudioHasError.current = true;
          synthAlarm.current.start();
        });
    } else {
      synthAlarm.current.start();
    }
  };

  const triggerMessageChime = () => {
    if (!soundEnabled) return;

    if (!messageAudio.current) {
      const mAudio = new Audio('/message_chime.mp3');
      mAudio.loop = false;
      mAudio.onerror = () => {
        messageAudioHasError.current = true;
        synthChime.current.play();
      };
      messageAudio.current = mAudio;
    }

    if (!messageAudioHasError.current) {
      messageAudio.current.currentTime = 0;
      messageAudio.current.play()
        .catch(() => {
          messageAudioHasError.current = true;
          synthChime.current.play();
        });
    } else {
      synthChime.current.play();
    }
  };

  const stopAllSounds = () => {
    setIsRinging(false);
    if (bookingAudio.current) {
      try {
        bookingAudio.current.pause();
        bookingAudio.current.currentTime = 0;
      } catch (e) {}
    }
    synthAlarm.current.stop();
  };

  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (nextState) {
      localStorage.setItem('lounge_alert_sounds_active', 'true');
      toast.success("🔊 High-Volume Audio Alert Channels Armed & Active!", {
        icon: '🔔',
        style: {
          background: '#0c0a0f',
          color: '#ffffff',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          fontFamily: 'monospace',
          fontSize: '11px'
        }
      });
      
      // Warm up and verify audio context permissions
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1000, ctx.currentTime);
          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
        }
      } catch (e) {}

      // Test a quick audio cue
      synthChime.current.play();
    } else {
      localStorage.setItem('lounge_alert_sounds_active', 'false');
      stopAllSounds();
      toast.error("🔇 Audio alerts muted. Alarms will be visual only.", {
        style: {
          background: '#0c0a0f',
          color: '#ffffff',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          fontFamily: 'monospace',
          fontSize: '11px'
        }
      });
    }
  };

  return (
    <>
      {/* Flashing Red Fullscreen/Modal Siren Warning for Host Booking Requests */}
      {isRinging && (
        <div id="booking-alarm-overlay" className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-950/40 via-purple-950/40 to-pink-950/40 opacity-70" />
          <div className="max-w-md w-full bg-[#0a070e] border-2 border-pink-500/80 rounded-3xl p-6 text-center shadow-[0_0_50px_rgba(236,72,153,0.4)] relative overflow-hidden z-10 animate-bounce">
            <div className="w-16 h-16 mx-auto rounded-full bg-pink-500/10 flex items-center justify-center border border-pink-500/40 mb-4 animate-ping">
              <ShieldAlert className="w-8 h-8 text-pink-500" />
            </div>
            
            <h2 className="text-white font-black text-xl tracking-tight uppercase font-sans">
              🚨 NEW BOOKING REQUEST! 🚨
            </h2>
            
            <p className="text-zinc-300 text-xs mt-3 leading-relaxed">
              A VIP user has authorized funds in escrow and sent a live rendezvous proposal. The booking sound alarm is actively wailing.
            </p>

            <div className="mt-4 p-3 bg-zinc-950 rounded-2xl border border-zinc-900 text-left text-xs font-mono">
              <div className="flex justify-between mb-1">
                <span className="text-zinc-500">Proposed Rate:</span>
                <span className="text-emerald-400 font-bold">${latestBooking?.hourly_rate_at_booking || latestBooking?.rate || 'Escrow hold'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Duration:</span>
                <span className="text-zinc-300 font-bold">{latestBooking?.duration_hours || latestBooking?.duration || '1'} hours</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={stopAllSounds}
                className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-black uppercase text-xs tracking-wider rounded-2xl transition shadow-xl shadow-pink-950 cursor-pointer flex items-center justify-center gap-2"
              >
                <VolumeX className="w-4 h-4" />
                <span>Mute Alarm & Review</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
