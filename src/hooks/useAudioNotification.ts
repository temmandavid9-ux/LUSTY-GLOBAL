import { useEffect, useRef, useCallback } from 'react';

interface UseAudioNotificationOptions {
  currentUserId?: string | null;
  soundUrl?: string;
  enabled?: boolean;
}

export function useAudioNotification(options: UseAudioNotificationOptions = {}) {
  const { currentUserId, soundUrl = '/message_chime.mp3', enabled = true } = options;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isUnlockedRef = useRef<boolean>(false);

  // Preload audio file & setup AudioContext
  useEffect(() => {
    try {
      const audio = new Audio(soundUrl);
      audio.preload = 'auto';
      audioRef.current = audio;
    } catch (err) {
      console.warn('Failed to initialize Audio element:', err);
    }

    // Pre-approve browser audio autoplay on first user gesture
    const unlockAudio = () => {
      if (isUnlockedRef.current) return;
      
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioContextClass();
          }
          if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
          }
          // Play silent buffer to pre-authorize playback
          const buffer = audioCtxRef.current.createBuffer(1, 1, 22050);
          const source = audioCtxRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtxRef.current.destination);
          source.start(0);
        }

        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            if (audioRef.current) audioRef.current.currentTime = 0;
          }).catch(() => {});
        }

        isUnlockedRef.current = true;
      } catch (err) {
        console.warn('Audio unlock warning:', err);
      }

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
  }, [soundUrl]);

  // Fallback synthetic high-res chime tone if mp3 fails or is missing
  const playSynthChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6 note

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (err) {
      console.warn('Synth chime error:', err);
    }
  }, []);

  // Main notification trigger
  const playNotificationSound = useCallback((senderId?: string | null) => {
    if (!enabled) return;

    // 🛑 Ensure sound triggers ONLY when the message sender is NOT the current user
    if (senderId && currentUserId && senderId === currentUserId) {
      return;
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        // Success playing preloaded audio file
      }).catch((err) => {
        console.warn('Audio file play failed, using synth chime fallback:', err);
        playSynthChime();
      });
    } else {
      playSynthChime();
    }
  }, [currentUserId, enabled, playSynthChime]);

  // Helper method accepting message object directly
  const notifyNewMessage = useCallback((message: { sender_id?: string; senderId?: string; user_id?: string }) => {
    const sender = message.sender_id || message.senderId || message.user_id;
    playNotificationSound(sender);
  }, [playNotificationSound]);

  return {
    playNotificationSound,
    notifyNewMessage,
    playSynthChime
  };
}
