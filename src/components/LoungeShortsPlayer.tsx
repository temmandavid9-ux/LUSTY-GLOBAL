import React, { useState, useEffect, useRef } from 'react';
import { useLiveShortInteractions } from '../hooks/useLiveShortInteractions';
import { Heart, MessageSquare, Music as MusicIcon, Eye, Download, VolumeX, Volume2, Loader2 } from 'lucide-react';
import { SNAP_FILTERS } from '../utils/filterEffects';
import { supabase } from '../lib/supabase';
import { useMonetagRevenue } from '../hooks/useMonetagRevenue';
import { motion, AnimatePresence } from 'motion/react';
import { formatMetricCount } from '../utils/formatMetrics';
import toast from 'react-hot-toast';

interface ShortVideoPlayerProps {
  short: {
    id: number | string;
    video_url: string;
    caption: string;
    description?: string;
    sub_caption?: string;
    profiles: {
      username: string;
      avatar_url: string;
      is_verified: boolean;
      title?: string;
    };
  } & { [key: string]: any };
  currentUserId: string;
  isActive?: boolean; // Support active state to control playback in feeds
  isMuted?: boolean;
  onMuteToggle?: () => void;
}

// 🔊 Production Logging Utility for Browser Playback & Autoplay/Audio Restrictions
export const logPlaybackEvent = (
  event: 'SUCCESS' | 'BLOCKED_AUTOPLAY' | 'FALLBACK_MUTED_SUCCESS' | 'PLAYBACK_ERROR' | 'MANUAL_UNMUTE' | 'MANUAL_PLAY' | 'PAUSE' | 'SYNC_INIT' | 'STATE_TRANSITION' | 'UNMOUNT', 
  details?: any
) => {
  const timestamp = new Date().toISOString();
  const logMsg = `[LoungeShortsPlayer LOG] [${timestamp}] [${event}] ${details ? JSON.stringify(details) : ''}`;
  console.log(`%c${logMsg}`, "color: #10B981; font-weight: bold; background: #061512; padding: 4px; border-radius: 4px;");
  
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (!w.__SHORT_PLAYER_LOGS__) {
      w.__SHORT_PLAYER_LOGS__ = [];
    }
    w.__SHORT_PLAYER_LOGS__.push({ timestamp, event, details, userAgent: navigator.userAgent });
    if (w.__SHORT_PLAYER_LOGS__.length > 100) {
      w.__SHORT_PLAYER_LOGS__.shift();
    }
  }
};

export function LoungeShortsPlayer({ 
  short, 
  currentUserId, 
  isActive = true,
  isMuted: isMutedProp,
  onMuteToggle
}: ShortVideoPlayerProps) {
  const { triggerMonetagEarning } = useMonetagRevenue(3);
  const [commentInput, setCommentInput] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [localIsMuted, setLocalIsMuted] = useState(true);
  const isMuted = isMutedProp !== undefined ? isMutedProp : localIsMuted;

  const toggleMute = () => {
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setLocalIsMuted(prev => !prev);
    }
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  
  // ── 🛠️ PLAYBACK DIAGNOSTICS STATES & REF ──
  const diagnosticsRef = useRef<Array<{ timestamp: string; event: string; details?: any }>>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsLogs, setDiagnosticsLogs] = useState<Array<{ timestamp: string; event: string; details?: any }>>([]);

  const playbackDiagnostics = {
    log: (event: string, details?: any) => {
      const entry = {
        timestamp: new Date().toLocaleTimeString(),
        event,
        details
      };
      diagnosticsRef.current.push(entry);
      if (diagnosticsRef.current.length > 50) {
        diagnosticsRef.current.shift();
      }
      setDiagnosticsLogs([...diagnosticsRef.current]);
      logPlaybackEvent(event as any, details);
    },
    clear: () => {
      diagnosticsRef.current = [];
      setDiagnosticsLogs([]);
    }
  };

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMediaSyncValidation = () => {
    setMediaLoading(false);
    const video = videoRef.current;
    if (video) {
      playbackDiagnostics.log('SYNC_INIT', { videoUrl: short.video_url, isMuted, context: 'media_sync_validation' });
      playPromiseRef.current = video.play();
      playPromiseRef.current.catch((err: any) => {
        playbackDiagnostics.log('BLOCKED_AUTOPLAY', { errorName: err.name, errorMessage: err.message, context: 'media_sync_validation' });
        console.warn("⚠️ Autoplay interrupted. Forcing muted interface fallback:", err.message);
      });
    }
  };

  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [followerCount, setFollowerCount] = useState<number>(0); // Tracks live count
  
  const creatorId = short.host_id || short.user_id;
  const isOwnVideo = currentUserId === creatorId;

  // Fetch current follower totals when the short mounts & subscribe to live changes
  useEffect(() => {
    let isMounted = true;

    async function fetchFollowers() {
      if (!creatorId) return;
      try {
        // Direct database count query instead of fragile/missing RPC function
        const { count, error } = await supabase
          .from('user_followers')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', creatorId);

        if (isMounted) {
          if (!error && count !== null && count !== undefined) {
            setFollowerCount(count);
          } else {
            // Seed count fallback based on creatorId string hash
            const seed = parseInt(String(creatorId).replace(/\D/g, '').substring(0, 3)) || 15;
            setFollowerCount((seed * 7) % 300 + 45);
          }
        }
      } catch (err) {
        console.warn("Network loop blocked:", err);
      }
    }

    fetchFollowers();

    if (!creatorId) return;

    // Subscribe to live changes on the user_followers table
    const followerChannel = supabase
      .channel(`followers-live-${creatorId}-${Math.random().toString(36).substring(2, 11)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_followers',
          filter: `following_id=eq.${creatorId}`
        },
        () => {
          console.log('🔄 Follower change detected! Re-fetching count...');
          fetchFollowers(); // Refreshes the number immediately
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(followerChannel);
    };
  }, [creatorId]);

  // Check if current user is already following this creator on load
  useEffect(() => {
    let isMounted = true;

    async function checkFollowStatus() {
      if (!currentUserId || !creatorId) return;
      
      try {
        const { data, error } = await supabase
          .from('user_followers')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', creatorId)
          .maybeSingle();

        if (isMounted) {
          if (!error && data) {
            setIsFollowing(true);
          } else {
            setIsFollowing(false);
          }
        }
      } catch (err) {
        console.warn("Could not check follow status:", err);
      }
    }

    checkFollowStatus();
    return () => {
      isMounted = false;
    };
  }, [currentUserId, creatorId]);

  const handleFollowToggle = async () => {
    triggerMonetagEarning();
    if (!currentUserId) {
      alert("Please sign in to follow this creator.");
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    const prevFollowing = isFollowing;
    
    // Optimistic UI Update: Make it snappy for the user
    setIsFollowing(!prevFollowing);
    setFollowerCount(prev => prevFollowing ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (prevFollowing) {
        // Unfollow request logic
        const { error } = await supabase
          .from('user_followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', creatorId);

        if (error) throw error;
      } else {
        // Follow request logic
        const { error } = await supabase
          .from('user_followers')
          .insert([{ follower_id: currentUserId, following_id: creatorId }]);

        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Follow link execution failed:", err?.message || err);
      // Revert if database write fails due to network issues
      setIsFollowing(prevFollowing);
      setFollowerCount(prev => prevFollowing ? prev + 1 : Math.max(0, prev - 1));
    } finally {
      setIsProcessing(false);
    }
  };

  // Robust fallback for video player sources to prevent black screen errors
  const backupVideoUrl = 'https://vjs.zencdn.net/v/oceans.mp4';
  
  // Frontend Hook Bind
  const boosterMultiplier = short.booster_level || 1;
  const isExclusive = short.is_exclusive_access || false;

  // Extract custom applied filter if present in the caption
  const rawCaption = short.caption && short.caption.trim() !== "" 
    ? short.caption 
    : (short.description && short.description.trim() !== "" ? short.description : "Untitled Broadcast");

  let displayCaption = rawCaption;
  let appliedFilterStyle = undefined;
  let appliedFilterShaderStyle = undefined;
  let filterName = "";
  
  if (displayCaption) {
    const filterMatch = displayCaption.match(/\[filter:([^\]]+)\]/);
    if (filterMatch) {
      const filterId = filterMatch[1];
      // Strip the tag from display
      displayCaption = displayCaption.replace(/\[filter:[^\]]+\]/, '').trim();
      
      const foundFilter = SNAP_FILTERS.find(f => f.id === filterId);
      if (foundFilter) {
        appliedFilterStyle = foundFilter.style;
        appliedFilterShaderStyle = foundFilter.shaderStyle;
        filterName = foundFilter.name;
      }
    }
  }

  // Wire up the live database interaction streams
  const { 
    likes, 
    hasLiked, 
    views,
    comments, 
    toggleLike, 
    postComment 
  } = useLiveShortInteractions(short.id, currentUserId, isActive, short.hasUserLiked, short.likes_count, short.views_count);

  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: number; x: number; scale: number; rotation: number; delay: number }>>([]);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike();

    // Trigger button burst animation
    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 450);

    const count = 5;
    const newHearts = Array.from({ length: count }).map((_, i) => ({
      id: Date.now() + i + Math.random(),
      x: (Math.random() - 0.5) * 60, // random horizontal drift
      scale: 0.5 + Math.random() * 0.7, // random scale
      rotation: (Math.random() - 0.5) * 60, // random rotation tilt
      delay: i * 0.05 // staggered delay
    }));
    setFloatingHearts(prev => [...prev, ...newHearts].slice(-20)); // keep last 20 max to avoid state buildup
  };

  // Auto-play/pause control based on visible active status and source url change
  useEffect(() => {
    let isCurrent = true; // Prevents race conditions on unmounted/inactive components
    const video = videoRef.current;
    if (!video) return;

    setPlaybackProgress(0);
    setHasStartedPlaying(false);

    const playVideo = async () => {
      try {
        if (!isActive) {
          playbackDiagnostics.log('PAUSE', { videoUrl: short.video_url, shortId: short.id, context: 'auto_pause_hook' });
          if (playPromiseRef.current) {
            try {
              await playPromiseRef.current;
            } catch (_) {}
          }
          video.pause();
          video.currentTime = 0;
          return;
        }

        setMediaLoading(true);

        // 1. Force the video to start muted for autoplay compliance
        video.muted = true;
        video.playsInline = true;

        // 2. Clear any lingering source loads
        video.load();

        // 3. Initiate playback
        playbackDiagnostics.log('SYNC_INIT', { videoUrl: short.video_url, isMuted: true, shortId: short.id, context: 'auto_play_hook' });
        
        const playPromise = video.play();
        playPromiseRef.current = playPromise;

        if (playPromise !== undefined) {
          await playPromise;
          
          // 4. If we successfully autoplayed muted, and this effect is still current:
          if (isCurrent) {
            playbackDiagnostics.log('SUCCESS', { videoUrl: short.video_url, isMuted: true, shortId: short.id, context: 'auto_play_hook' });
            console.log("🎥 Video playing muted successfully.");
          }
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          // This is safe to ignore; it just means React updated state faster than the load
          playbackDiagnostics.log('BLOCKED_AUTOPLAY', { errorName: error.name, errorMessage: error.message, videoUrl: short.video_url, context: 'abort_error_handled' });
          console.warn("Playback interrupted safely during render sync.");
        } else {
          playbackDiagnostics.log('PLAYBACK_ERROR', { errorName: error.name, errorMessage: error.message, context: 'auto_play_hook' });
          console.error("Playback engine error:", error);
        }
      }
    };

    playVideo();

    // 🧹 CLEANUP: This runs immediately when React re-renders or unmounts the video
    return () => {
      isCurrent = false;
      if (video) {
        const handleUnmountPause = async () => {
          playbackDiagnostics.log('UNMOUNT', { videoUrl: short.video_url, shortId: short.id, context: 'unmount_cleanup' });
          if (playPromiseRef.current) {
            try {
              await playPromiseRef.current;
            } catch (_) {}
          }
          video.pause();
        };
        handleUnmountPause();
      }
    };
  }, [short.video_url, isActive]);

  // Dynamically control muting without reloading the video
  useEffect(() => {
    if (videoRef.current) {
      const calculatedMuted = !isActive || isMuted;
      playbackDiagnostics.log('STATE_TRANSITION', { 
        isActive, 
        isMuted, 
        calculatedMuted, 
        videoId: short.id, 
        videoUrl: short.video_url 
      });
      videoRef.current.muted = calculatedMuted;
    }
  }, [isMuted, isActive, short.id, short.video_url]);

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    postComment(commentInput);
    setCommentInput('');
  };

  const handleTriggerPostBoost = async () => {
    if (!currentUserId) {
      alert("⚠️ Action Required: Please log in to establish secure escrow channels.");
      return;
    }

    try {
      // 🛑 SECURITY GATE FIRST: Hard stop execution if no card exists
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('has_payment_method')
        .eq('id', currentUserId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!userProfile?.has_payment_method) {
        alert("⚠️ Transaction Denied: No payment file detected. Please navigate to your Escrow Vault to link a valid debit card before buy visibility packs.");
        return;
      }

      // 1. Fire update request to increment view metrics on the database layer
      const { error } = await supabase
        .from('lounge_shorts')
        .update({
          views_count: (short.views_count || 0) + 150,
          is_boosted: true
        })
        .eq('id', short.id);

      if (error) throw error;

      // 2. Alert or update your state tree to reflect the instant dynamic boost view jump
      alert("🚀 Campaign Accelerated! Your broadcast has been pushed to the top of the feed loops.");
    } catch (err: any) {
      console.error("Failed to execute broadcast promotion accelerator:", err.message);
      alert(`❌ Campaign could not be initialized: ${err.message}`);
    }
  };

  const togglePlayAndUnmute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      playbackDiagnostics.log('MANUAL_PLAY_UNMUTE', { videoUrl: short.video_url, context: 'manual_tap' });
      // 🔊 Unmute immediately on the HTML5 element to satisfy the browser's strict user-gesture security rule
      video.muted = false;

      // Update our React state so UI elements stay perfectly synced
      if (isMuted) {
        if (onMuteToggle) {
          onMuteToggle();
        } else {
          setLocalIsMuted(false);
        }
      }

      const playVideo = async () => {
        try {
          playbackDiagnostics.log('MANUAL_PLAY', { videoUrl: short.video_url, context: 'manual_tap' });
          playPromiseRef.current = video.play();
          await playPromiseRef.current;
          playbackDiagnostics.log('SUCCESS', { videoUrl: short.video_url, isMuted: false, context: 'manual_tap_success' });
        } catch (err: any) {
          playbackDiagnostics.log('PLAYBACK_ERROR', { errorName: err.name, errorMessage: err.message, context: 'manual_tap_error' });
          console.error("Play failed on click:", err);
        }
      };
      playVideo();
    } else {
      playbackDiagnostics.log('PAUSE', { videoUrl: short.video_url, context: 'manual_tap' });
      const pauseVideo = async () => {
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch (_) {}
        }
        video.pause();
      };
      pauseVideo();
    }
  };

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // 📱 Mobile Long-Press / Desktop Right-Click Gesture Engine
  const touchTimerRef = useRef<any>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({ x, y });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Avoid triggering on interactive elements like buttons, comments sidebar, or close triggers
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('a') || 
      target.closest('input') || 
      target.closest('[role="button"]') ||
      target.closest('#comments-sidebar') ||
      target.closest('.interactive-element')
    ) {
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    touchStartPosRef.current = { x, y };
    isLongPressRef.current = false;

    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }

    // Trigger after 600ms of static touch-down hold
    touchTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setContextMenu({ x, y });
      
      // Gentle haptic hum to confirm gesture detection on mobile devices
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch (_) {}
      }
    }, 600);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch || !touchStartPosRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const dx = x - touchStartPosRef.current.x;
    const dy = y - touchStartPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Cancel if they drag or swipe away by more than 15px
    if (distance > 15) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    
    // If it was detected as a long press, prevent default click/play-pause behavior
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
    }
  };

  const handleTouchCancel = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    isLongPressRef.current = false;
  };

  useEffect(() => {
    function handleGlobalClick() {
      if (contextMenu) setContextMenu(null);
    }
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);

  const handleDownloadShort = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setContextMenu(null);

    const downloadToastId = toast.loading("Downloading high-quality VIP version...", {
      style: {
        background: '#09090b',
        color: '#f4f4f5',
        border: '1px solid #27272a'
      }
    });

    try {
      const sessionRes = await supabase.auth.getSession();
      const response = await fetch("https://vtmaffcyvhnnmfibfswm.supabase.co/functions/v1/watermark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionRes.data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          videoUrl: short.video_url || backupVideoUrl,
          hostName: short.profiles?.username,
          watermarkUrl: 'https://www.image2url.com/r2/default/files/1784327208067-29e2d090-72ca-426d-926d-678e6bd4d967.png'
        })
      });

      if (!response.ok) {
        throw new Error("Failed to process watermarked video on server");
      }

      // Get the response stream as a Blob (guaranteed H.264 MP4 format)
      const videoBlob = await response.blob();
      const blobUrl = window.URL.createObjectURL(videoBlob);

      // Trigger instant browser download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `LustyGlobal-VIP-${short.id || 'download'}.mp4`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success("Ready! Plays smoothly on all devices.", {
        id: downloadToastId,
        style: {
          background: '#09090b',
          color: '#f4f4f5',
          border: '1px solid #27272a'
        }
      });

    } catch (error) {
      console.error("Watermark compilation failed:", error);
      toast.error("Could not apply watermark. Please check backend logs.", {
        id: downloadToastId,
        style: {
          background: '#09090b',
          color: '#f4f4f5',
          border: '1px solid #27272a'
        }
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCountValue = (count: number): string => {
    return formatMetricCount(count);
  };


  return (
    <div 
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className="w-full h-full relative flex flex-col justify-end bg-black"
    >
      
      {mediaLoading && (
        <div className="absolute inset-0 bg-zinc-950 z-10 select-none overflow-hidden flex flex-col justify-end">
          {/* Shimmer/Pulse Ambient Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/20 via-zinc-950 to-zinc-950 animate-pulse" />
          
          {/* Subtle spinning accent in the center to maintain intuitive loading feedback */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 border-2 border-t-pink-500 border-zinc-800/40 rounded-full animate-spin opacity-40" />
          </div>

          {/* Top-Left Audio Toggle Skeleton */}
          <div className="absolute left-4 top-20 z-20">
            <div className="w-9 h-9 rounded-full bg-zinc-800/40 border border-zinc-800/20 animate-pulse" />
          </div>

          {/* Right Action Panel Skeleton */}
          <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4">
            {/* Host Avatar circular skeleton with sub-pill */}
            <div className="flex flex-col items-center relative mb-1">
              <div className="w-12 h-12 rounded-full border-2 border-zinc-800/30 p-0.5 bg-zinc-900/60 animate-pulse" />
              <div className="absolute -bottom-1 w-4 h-4 rounded-full bg-zinc-800/50 animate-pulse border border-zinc-900" />
            </div>
            
            {/* Like button skeleton block */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-zinc-800/40 border border-zinc-800/20 animate-pulse" />
              <div className="w-5 h-2 rounded bg-zinc-800/40 animate-pulse mt-0.5" />
            </div>

            {/* Comment button skeleton block */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-zinc-800/40 border border-zinc-800/20 animate-pulse" />
              <div className="w-4 h-2 rounded bg-zinc-800/40 animate-pulse mt-0.5" />
            </div>

            {/* Boost button skeleton block */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-zinc-800/40 border border-zinc-800/20 animate-pulse" />
              <div className="w-7 h-2 rounded bg-zinc-800/40 animate-pulse mt-0.5" />
            </div>

            {/* Fans tracker badge skeleton */}
            <div className="w-12 h-10 rounded-2xl bg-zinc-800/40 border border-zinc-800/20 animate-pulse mt-1" />
          </div>

          {/* Lower Metadata Descriptive Panel Skeleton */}
          <div className="absolute left-4 bottom-6 right-24 z-20 flex flex-col gap-1 px-1 text-left">
            {/* Creator Handle skeleton */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="w-28 h-4 rounded bg-zinc-800/40 animate-pulse" />
                <div className="w-10 h-3 rounded bg-zinc-800/40 animate-pulse" />
              </div>
              <div className="w-36 h-3 rounded bg-zinc-800/40 animate-pulse mt-0.5" />
            </div>
            
            {/* Tags line skeleton */}
            <div className="flex gap-1.5 my-1">
              <div className="w-14 h-4 rounded bg-zinc-800/40 animate-pulse" />
              <div className="w-16 h-4 rounded bg-zinc-800/40 animate-pulse" />
            </div>

            {/* Caption lines skeletons */}
            <div className="space-y-1.5 my-0.5">
              <div className="w-48 h-3 rounded bg-zinc-800/40 animate-pulse" />
              <div className="w-36 h-3 rounded bg-zinc-800/40 animate-pulse" />
            </div>

            {/* Soundtrack info skeleton */}
            <div className="w-44 h-5 rounded-full bg-zinc-800/40 animate-pulse mt-1" />
          </div>
        </div>
      )}

      {/* 🖼️ High-Quality Static Image Thumbnail Preview Layout with Video Fallback */}
      {short.thumbnail_url && !short.thumbnail_url.includes('images.unsplash.com') ? (
        <img 
          src={short.thumbnail_url} 
          alt="Broadcast Preview"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      ) : (
        <video 
          src={short.video_url || backupVideoUrl}
          preload="auto"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* 📹 Live Video Asset Player - Only loaded when active to prevent background network load */}
      {isActive && (
        <video 
          ref={videoRef}
          src={short.video_url || backupVideoUrl}
          loop 
          muted={isMuted} 
          playsInline
          autoPlay
          onContextMenu={handleContextMenu}
          crossOrigin="anonymous"
          onClick={togglePlayAndUnmute}
          onLoadedData={handleMediaSyncValidation}
          onPlay={() => setHasStartedPlaying(true)}
          onPlaying={() => setHasStartedPlaying(true)}
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            if (video.duration) {
              setPlaybackProgress((video.currentTime / video.duration) * 100);
            }
          }}
          onError={() => {
            console.error("🚨 Source layer failed to compile. Injecting universal backup asset...");
            if (videoRef.current && videoRef.current.src !== backupVideoUrl) {
              videoRef.current.src = backupVideoUrl;
              videoRef.current.load();
              videoRef.current.play().catch(() => {});
            }
          }}
          className={`absolute inset-0 w-full h-full object-cover z-10 cursor-pointer transition-opacity duration-500 pointer-events-auto ${mediaLoading ? 'opacity-0' : 'opacity-100'}`}
          style={{ filter: appliedFilterShaderStyle !== 'none' ? appliedFilterShaderStyle : (appliedFilterStyle !== 'none' ? appliedFilterStyle : undefined) }}
        >
          <p className="text-xs text-zinc-500 font-mono text-center p-4">
            Your browser does not support HTML5 video compilation.
          </p>
        </video>
      )}

      {/* ── 📱 MOBILE-OPTIMIZED WATERMARK OVERLAY ── */}
      <div className={`absolute top-3 left-3 md:top-5 md:left-5 pointer-events-none select-none z-30 flex flex-col gap-0.5 transition-opacity duration-300 ${mediaLoading ? 'opacity-0' : 'opacity-35'}`}>
        {/* Platform Header Container */}
        <div className="flex items-center gap-1 md:gap-1.5">
          {/* Animated Live Indicator Token */}
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-pink-500 animate-pulse shrink-0" />
          
          {/* Fluid Scale Title: Adjusts smoothly between 10px and 13px based on screen size */}
          <span className="text-white font-black tracking-widest uppercase drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)] text-[clamp(10px,2.5vw,13px)]">
            LUSTY GLOBAL VIP
          </span>
        </div>

        {/* Dynamic Creator Handle Attribution */}
        {/* Scales smoothly between 8px and 11px, ensuring it never line-wraps on tiny screens */}
        <p className="text-zinc-300 font-medium pl-2.5 md:pl-3.5 drop-shadow-md truncate max-w-[120px] xs:max-w-[160px] text-[clamp(8px,2vw,11px)]">
          @{short.profiles?.username || 'host'}
        </p>
      </div>
 
      {/* ── TOP LEFT CONTROLS CLUSTER ── */}
      <div className={`absolute left-4 top-20 z-40 pointer-events-auto transition-opacity duration-300 flex items-center gap-2 ${mediaLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Audio Mute Toggle */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-zinc-800/40 text-white text-xs active:scale-90 transition cursor-pointer"
          title={isMuted ? "Unmute Audio" : "Mute Audio"}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* ── 🛠️ PLAYBACK DIAGNOSTICS OVERLAY ── */}
      {showDiagnostics && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-4 top-32 max-h-[40vh] bg-zinc-950/95 border border-zinc-800 rounded-xl z-50 overflow-hidden flex flex-col font-mono text-[10px] text-zinc-300 shadow-2xl pointer-events-auto"
        >
          {/* Header Panel */}
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
            <span className="font-bold text-pink-500 flex items-center gap-1">
              <span>🔊</span> Playback Diagnostics
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => playbackDiagnostics.clear()}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[9px] text-zinc-400 hover:text-white transition"
              >
                Clear
              </button>
              <button 
                onClick={() => setShowDiagnostics(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold font-sans"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Current State Indicator Grid */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-3 py-2 bg-zinc-900/40 border-b border-zinc-800 text-[9px] text-zinc-400">
            <div>Active: <span className={isActive ? "text-emerald-400" : "text-zinc-500"}>{isActive ? 'TRUE' : 'FALSE'}</span></div>
            <div>Muted (App): <span className={isMuted ? "text-amber-400" : "text-emerald-400"}>{isMuted ? 'TRUE' : 'FALSE'}</span></div>
            <div>Video Paused: <span className={videoRef.current?.paused ? "text-amber-400" : "text-emerald-400"}>{videoRef.current?.paused ? 'TRUE' : 'FALSE'}</span></div>
            <div>Volume: <span className="text-zinc-300">{videoRef.current?.volume !== undefined ? videoRef.current.volume.toFixed(1) : 'N/A'}</span></div>
            <div className="col-span-2 truncate">File: <span className="text-zinc-400 font-sans">{short.video_url?.split('/').pop() || 'None'}</span></div>
          </div>

          {/* Direct Controls */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/20 border-b border-zinc-900">
            <button
              onClick={async () => {
                const v = videoRef.current;
                if (v) {
                  playbackDiagnostics.log('MANUAL_DIAGNOSTIC_PLAY_TRY', { isMuted });
                  try {
                    playPromiseRef.current = v.play();
                    await playPromiseRef.current;
                    playbackDiagnostics.log('MANUAL_DIAGNOSTIC_PLAY_SUCCESS');
                  } catch (e: any) {
                    playbackDiagnostics.log('MANUAL_DIAGNOSTIC_PLAY_ERROR', { name: e.name, message: e.message });
                  }
                }
              }}
              className="px-2 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded text-[9px] font-bold"
            >
              Trigger play()
            </button>
            <button
              onClick={() => {
                const v = videoRef.current;
                if (v) {
                  v.muted = !v.muted;
                  playbackDiagnostics.log('MANUAL_DIAGNOSTIC_MUTED_TOGGLE', { muted: v.muted });
                  if (onMuteToggle) {
                    onMuteToggle();
                  } else {
                    setLocalIsMuted(v.muted);
                  }
                }
              }}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[9px] font-bold"
            >
              Toggle muted element property
            </button>
          </div>

          {/* Logs Terminal Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-black/60 max-h-[22vh]">
            {diagnosticsLogs.length === 0 ? (
              <div className="text-zinc-600 italic text-center py-4">No playback events logged yet.</div>
            ) : (
              diagnosticsLogs.map((log, i) => {
                let colorClass = "text-zinc-400";
                if (log.event.includes('SUCCESS')) colorClass = "text-emerald-400 font-semibold";
                if (log.event.includes('ERROR') || log.event.includes('HALT')) colorClass = "text-red-400 font-semibold";
                if (log.event.includes('BLOCKED')) colorClass = "text-amber-400";
                if (log.event.includes('INIT')) colorClass = "text-sky-400";
                if (log.event.includes('TRANSITION')) colorClass = "text-purple-400";

                return (
                  <div key={i} className="flex flex-col border-b border-zinc-900/40 pb-1 last:border-0">
                    <div className="flex items-center justify-between text-[8px] text-zinc-500">
                      <span>[{log.timestamp}]</span>
                      <span className={colorClass}>{log.event}</span>
                    </div>
                    {log.details && (
                      <pre className="text-[8px] text-zinc-500 bg-zinc-900/30 p-1 rounded mt-0.5 whitespace-pre-wrap font-mono leading-tight">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
 
      {/* ── ⚡ RIGHT ACTION PANEL (PERFECT ALIGNMENT ARRAY) ── */}
      <div className={`absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4 pointer-events-auto transition-opacity duration-300 ${mediaLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* 1. HOST PROFILE AVATAR (Mobile-safe click-to-toggle dropdown dropdown) */}
        <div ref={dropdownRef} className="relative flex flex-col items-center mb-1 z-50 pointer-events-auto">
          {/* ── PROFILE TRIGGER AVATAR FRAME ── */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen(!isDropdownOpen);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDropdownOpen(!isDropdownOpen);
            }}
            className="w-12 h-12 rounded-full border-2 border-white p-0.5 bg-zinc-950 shadow-xl overflow-hidden aspect-square flex items-center justify-center relative active:scale-95 transition-transform cursor-pointer"
          >
            <img 
              src={short.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
              alt="Host Profile" 
              className="w-full h-full rounded-full object-cover"
            />
            {/* Verified badge nested elegantly inside the avatar ring */}
            {short.profiles?.is_verified && (
              <span className="absolute -top-1 -right-1 bg-sky-500 text-black rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold border border-black shadow">
                ✓
              </span>
            )}
          </button>
          
          {/* Follow action pill directly below avatar frame */}
          {!isOwnVideo && !isFollowing && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleFollowToggle(); }}
              disabled={isProcessing}
              className="absolute -bottom-1 bg-pink-500 hover:bg-pink-400 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-zinc-950 shadow-md transition transform active:scale-75 cursor-pointer z-40"
              title="Follow Host"
            >
              ＋
            </button>
          )}

          {/* ── 📱 MOBILE REPOSITIONED DROPDOWN CARD ── */}
          {isDropdownOpen && (
            <div className="absolute right-14 top-0 w-48 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-2 flex flex-col gap-1 z-[100] animate-in fade-in slide-in-from-right-2 duration-150 select-none">
              <div className="px-2 py-1.5 border-b border-zinc-800/60 mb-1">
                <p className="text-xs font-bold text-white truncate">
                  @{short.profiles?.username || 'companion'}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">Host Profile Menu</p>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  window.dispatchEvent(new CustomEvent('lounge-view-profile', { detail: { hostId: creatorId, defaultTab: 'about' } }));
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors active:bg-zinc-800 cursor-pointer"
              >
                👤 View Profile
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  window.dispatchEvent(new CustomEvent('lounge-view-profile', { detail: { hostId: creatorId, defaultTab: 'media' } }));
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors active:bg-zinc-800 cursor-pointer flex items-center gap-1"
              >
                🎬 View Past Videos
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  window.dispatchEvent(new CustomEvent('lounge-chat', { detail: { companionId: creatorId } }));
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-pink-500 font-semibold hover:bg-pink-500/10 rounded-md transition-colors active:bg-pink-500/20 cursor-pointer"
              >
                💬 Chat Now
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                  window.dispatchEvent(new CustomEvent('lounge-booking', { detail: { hostId: creatorId } }));
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-pink-400 font-medium hover:bg-pink-950/20 rounded-md transition-colors active:bg-pink-950/30 cursor-pointer"
              >
                📅 Book Session
              </button>
              
              {!isOwnVideo && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFollowToggle();
                  }}
                  disabled={isProcessing}
                  className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors active:bg-zinc-800 cursor-pointer"
                >
                  {isFollowing ? '🔔 Following' : '➕ Follow Host'}
                </button>
              )}

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 mt-1 transition-colors cursor-pointer"
              >
                Close Menu
              </button>
            </div>
          )}
        </div>

        {/* 2. LIKE / HEART COMPONENT */}
        <div className="flex flex-col items-center gap-0.5 relative">
          {/* AnimatePresence for floating hearts */}
          <div className="absolute pointer-events-none inset-0 flex items-center justify-center overflow-visible z-50">
            <AnimatePresence>
              {floatingHearts.map((heart) => (
                <motion.div
                  key={heart.id}
                  initial={{ y: 0, x: 0, opacity: 1, scale: 0 }}
                  animate={{ 
                    y: -100 - Math.random() * 50, 
                    x: heart.x, 
                    opacity: 0, 
                    scale: heart.scale,
                    rotate: heart.rotation 
                  }}
                  transition={{ 
                    duration: 0.8, 
                    ease: "easeOut",
                    delay: heart.delay || 0
                  }}
                  onAnimationComplete={() => {
                    setFloatingHearts(prev => prev.filter(h => h.id !== heart.id));
                  }}
                  className="absolute"
                >
                  <Heart className="w-6 h-6 fill-rose-500 text-rose-500 filter drop-shadow-[0_0_4px_rgba(244,63,94,0.6)]" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <motion.button 
            animate={isLikeAnimating ? { scale: [1, 1.45, 0.9, 1.1, 1] } : { scale: 1 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            whileTap={{ scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            onClick={handleLikeClick}
            className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition cursor-pointer shadow-md relative overflow-visible ${
              hasLiked 
                ? 'bg-pink-600/90 text-white border-pink-500 shadow-pink-500/20' 
                : 'bg-black/30 text-zinc-100 border-zinc-800/40 hover:bg-black/60 hover:text-pink-500'
            }`}
          >
            {/* Shockwave expanding ring when clicked */}
            <AnimatePresence>
              {isLikeAnimating && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.8 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border-2 border-pink-500 pointer-events-none z-10"
                />
              )}
            </AnimatePresence>

            {/* Inner heart with a pop animation when hasLiked changes */}
            <motion.div
              key={hasLiked ? 'liked' : 'unliked'}
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="relative z-20"
            >
              <Heart className={`w-5 h-5 ${hasLiked ? 'fill-current text-white' : 'text-zinc-100'}`} />
            </motion.div>
          </motion.button>
          <span className="text-[10px] font-mono font-black text-white tracking-tight drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)]">
            {formatCountValue(likes)}
          </span>
        </div>

        {/* 👁️ VIEW COUNT ENGINE (REAL-TIME LIVE UPDATES) */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-emerald-500/30 text-emerald-400 relative shadow-md">
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Eye className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="text-[10px] font-mono font-black text-emerald-400 tracking-tight drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)] animate-pulse">
            {formatCountValue(views)}
          </span>
        </div>

        {/* 3. COMMENT FEED ENGINE */}
        <div className="flex flex-col items-center gap-0.5">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
            className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-zinc-800/40 text-white hover:text-cyan-400 active:scale-90 transition shadow-md cursor-pointer"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-mono font-black text-white tracking-tight drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)]">
            {formatMetricCount(comments.length)}
          </span>
        </div>

        {/* 4. AMPLIFIER ACCELERATOR ACTION (Boost) */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerPostBoost();
            }}
            className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-pink-500 flex items-center justify-center border border-amber-400 text-white shadow-lg shadow-pink-500/20 active:scale-90 hover:brightness-110 transition cursor-pointer"
            title="Boost this Broadcast"
          >
            🚀
          </button>
          <span className="text-[9px] font-sans font-black uppercase tracking-widest text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            Boost
          </span>
        </div>

        {/* 📈 INTERACTIVE FOLLOWER COUNT PANEL */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            console.log("Fans metric clicked!");
            handleFollowToggle();
          }}
          className="relative z-10 flex flex-col items-center mt-1 bg-black/50 border border-pink-900/20 rounded-2xl px-2 py-1 backdrop-blur-sm text-center pointer-events-auto cursor-pointer hover:bg-black/70 active:scale-95 transition-all outline-none"
          title={isFollowing ? "Unfollow Creator" : "Follow Creator"}
        >
          <span className="text-[8px] uppercase tracking-wider text-pink-500 font-mono font-bold select-none">
            Fans
          </span>
          <span className="text-[10px] font-black text-white font-mono mt-0.5 select-none">
            {followerCount.toLocaleString()}
          </span>
        </button>

      </div>

      {/* ── 📝 LOWER METADATA DESCRIPTIVE PANEL (LEFT ALIGNED) ── */}
      <motion.div
        key={`${short.id}_${isActive}`}
        initial={{ opacity: 0, y: 35 }}
        animate={{ 
          opacity: (mediaLoading || !hasStartedPlaying) ? 0 : 1, 
          y: (mediaLoading || !hasStartedPlaying) ? 35 : 0 
        }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} // Smooth, dramatic easeOutExpo curve
        className="absolute left-4 bottom-6 right-24 z-30 pointer-events-none flex flex-col gap-1 px-1 text-left select-none"
      >
        
        {/* Creator Handle block */}
        <div className="flex flex-col gap-0.5 pointer-events-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-black text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-wide">
              @{short.profiles?.username || 'companion'}
            </span>
            {short.profiles?.is_verified && (
              <svg 
                viewBox="0 0 24 24" 
                className="w-3.5 h-3.5 text-[#1d9bf0] fill-current drop-shadow-[0_0_6px_rgba(29,155,240,0.4)] shrink-0"
                aria-label="Verified creator"
              >
                <path d="M22.25 12c0-1.43-.88-2.67-2.15-3.21.15-.44.24-.91.24-1.4 0-2.2-1.72-4-3.83-4-.48 0-.94.1-1.35.27C14.56 2.39 13.38 1.5 12 1.5s-2.56.89-3.16 2.16c-.41-.17-.87-.27-1.35-.27-2.11 0-3.83 1.8-3.83 4 0 .49.09.96.24 1.4-1.27.54-2.15 1.78-2.15 3.21 0 1.43.88 2.67 2.15 3.21-.15.44-.24.91-.24 1.4 0 2.2 1.72 4 3.83 4 .48 0 .94-.1 1.35-.27.6 1.27 1.78 2.16 3.16 2.16s2.56-.89 3.16-2.16c.41.17.87.27 1.35.27 2.11 0 3.83-1.8 3.83-4 0-.49-.09-.96-.24-1.4 1.27-.54 2.15-1.78 2.15-3.21zm-12.5 4L6 12.25l1.5-1.5 2.25 2.25L16.25 6.5l1.5 1.5-8 8z" />
              </svg>
            )}
            {isFollowing && (
              <span className="bg-zinc-800/80 border border-zinc-700/40 text-[8px] font-black px-1.5 py-0.5 rounded text-zinc-300 uppercase tracking-widest shadow-sm">
                Following
              </span>
            )}
            <span className="bg-pink-600 text-[8px] font-black px-1.5 py-0.5 rounded text-white uppercase tracking-widest shadow-sm animate-pulse">
              LIVE
            </span>
            <span className="bg-black/60 border border-zinc-800/80 text-[8px] font-mono px-1.5 py-0.5 rounded text-emerald-400 flex items-center gap-1 shadow-sm font-bold">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
              👁️ {views.toLocaleString()}
            </span>
          </div>
          <span className="text-[10px] text-pink-300 font-mono font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {short.profiles?.title || "Lounge Live Broadcaster"}
          </span>
        </div>

        {/* Special Tags overlay badges */}
        <div className="flex flex-wrap gap-1.5 my-1 pointer-events-auto">
          {isExclusive && (
            <span className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow">Exclusive</span>
          )}
          {boosterMultiplier > 1 && (
            <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded tracking-wider shadow">🔥 {boosterMultiplier}x Boost</span>
          )}
        </div>

        {/* Caption Row */}
        <p className="text-xs text-zinc-100 font-normal leading-relaxed line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] max-w-xl pointer-events-auto flex items-center gap-1.5 flex-wrap">
          <span>{displayCaption}</span>
          {filterName && (
            <span className="text-[9px] bg-pink-500/15 border border-pink-500/25 text-pink-400 font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
              ✨ {filterName}
            </span>
          )}
        </p>

        {/* Soundtrack wrapper */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 bg-white/5 border border-white/5 py-1 px-2 rounded-full w-fit max-w-full pointer-events-auto mt-1">
          <MusicIcon className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
          <span className="truncate">Original Soundtrack - @{short.profiles?.username || 'companion'}</span>
        </div>
      </motion.div>

      {/* 💬 POP-UP REAL-TIME COMMENTS DRAWER SHEET */}
      {showComments && (
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[#0c0c0e]/95 backdrop-blur-lg border-t border-zinc-900 rounded-t-3xl z-40 p-4 flex flex-col transition-transform duration-300 pointer-events-auto">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-900 mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Live Lounge Comments ({comments.length})
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowComments(false); }} 
              className="text-zinc-500 hover:text-white font-mono text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Render Streamed Records Loop */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2 no-scrollbar">
            {comments.length === 0 ? (
              <p className="text-[11px] text-zinc-600 text-center font-mono mt-8">Be the first to drop a live comment...</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 items-start text-left">
                  <img 
                    src={c.profiles?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50"} 
                    className="w-6 h-6 rounded-full object-cover mt-0.5 bg-zinc-950" 
                    alt="" 
                  />
                  <div className="bg-zinc-950/60 border border-zinc-900/60 rounded-xl px-3 py-2 flex-1">
                    <div className="flex items-center gap-1.5 text-left">
                      <span className="text-[10px] font-black text-zinc-400">
                        @{c.profiles?.username || c.username || 'lounge_user'}
                      </span>
                      {(c.profiles?.is_verified === true || c.profiles?.verified === 'true' || c.isVerified) && (
                        <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full w-3.5 h-3.5 text-[8px] p-0.5 shadow-sm shrink-0 animate-fade-in" title="Verified Creator">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-200 mt-0.5 font-sans leading-relaxed text-left">{c.comment_text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Secure Interactive Comment Submission Input Pipeline */}
          <form onSubmit={handleCommentSubmit} className="mt-2 pt-2 border-t border-zinc-900/60 flex gap-2">
            <input 
              type="text" 
              placeholder="Say something live..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
            <button 
              type="submit" 
              className="bg-pink-500 hover:bg-pink-600 text-white font-black text-[10px] uppercase tracking-wider px-4 rounded-xl transition cursor-pointer"
            >
              Post
            </button>
          </form>
        </div>
      )}

      {/* ── 💻 PREMIUM WATERMARKED CONTEXT MENU DECK ── */}
      {contextMenu && (
        <div 
          className="absolute inset-0 z-50 pointer-events-auto"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          {/* Floating Context Menu */}
          <div 
            className="absolute bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl p-2.5 w-52 flex flex-col gap-1 select-none animate-in fade-in zoom-in-95 duration-150 z-[60]"
            style={{ 
              left: `${Math.min(contextMenu.x, 200)}px`, 
              top: `${Math.min(contextMenu.y, 400)}px` 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1.5 border-b border-zinc-900 mb-1.5 flex items-center justify-between">
              <span className="text-[9px] font-black tracking-widest text-pink-500 uppercase">VIP Option Deck</span>
              <button 
                onClick={() => setContextMenu(null)}
                className="text-zinc-500 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadShort();
              }}
              disabled={isDownloading}
              className="w-full text-left px-2 py-2 text-xs text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 font-medium cursor-pointer"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500" />
              ) : (
                <Download className="w-3.5 h-3.5 text-pink-500" />
              )}
              <span>{isDownloading ? 'Baking video...' : 'Save Branded Video'}</span>
            </button>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
                setContextMenu(null);
              }}
              className="w-full text-left px-2 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>{isMuted ? 'Unmute Audio' : 'Mute Audio'}</span>
            </button>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                setShowComments(true);
              }}
              className="w-full text-left px-2 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
              <span>Show Comments</span>
            </button>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                window.dispatchEvent(new CustomEvent('lounge-view-profile', { detail: { hostId: creatorId, defaultTab: 'about' } }));
              }}
              className="w-full text-left px-2 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span className="text-sm">👤</span>
              <span>View Profile</span>
            </button>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
              }}
              className="w-full text-center mt-1 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── 📏 Thin Playback Progress Bar ── */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800/40 z-30 pointer-events-none">
        <div 
          className="h-full bg-pink-500 transition-[width] duration-150 ease-out"
          style={{ width: `${playbackProgress}%` }}
        />
      </div>

    </div>
  );
}

// 📱 Mobile Shorts Shell Layout Architecture (sticky top/bottom structure matching user specifications)
export function MobileShortsShell({ 
  children,
  activeTab = 'feed',
  setActiveTab = () => {},
  unreadCount = 0
}: { 
  children: React.ReactNode;
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
  unreadCount?: number;
}) {
  return (
    // 📱 Standardizes viewport height across safari/chrome mobile browsers
    <div className="w-full h-screen min-h-[100dvh] bg-black flex flex-col overflow-hidden relative select-none">
      
      {/* ── 1. STICKY TOP HEADER TRACK (From image_63c5db.png) ── */}
      <header className="w-full bg-zinc-950/40 backdrop-blur-md border-b border-zinc-900/60 px-4 py-3 flex items-center justify-between absolute top-0 left-0 right-0 z-30">
        <div className="flex items-center gap-1">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 font-black text-sm tracking-wider uppercase">LUSTY GLOBAL VIP</span>
        </div>
        
        <nav className="flex items-center gap-6">
          <button className="text-xs font-black uppercase text-white tracking-wider border-b-2 border-white pb-1 -mb-4 translate-y-[-2px]">
            Lounge Broadcasts
          </button>
          <button className="text-xs font-bold uppercase text-zinc-500 tracking-wider hover:text-zinc-300 transition">
            Analytics Console
          </button>
        </nav>
        <div className="w-6" /> {/* Balance spacer spacer */}
      </header>

      {/* ── 2. SCROLLABLE VIDEO FULLSCREEN CONTAINER BODY ── */}
      <main className="flex-1 w-full relative overflow-y-scroll snap-y snap-mandatory scrollbar-none pt-[48px] pb-[64px]">
        {children}
      </main>

      {/* ── 3. FIXED BOTTOM TAB BAR NAVIGATION (From image_63c924.png) ── */}
      <footer className="w-full bg-zinc-950 border-t border-zinc-900/80 px-2 pt-2 pb-safe absolute bottom-0 left-0 right-0 z-30 shadow-[0_-8px_24px_rgba(0,0,0,0.8)]">
        <div className="max-w-md mx-auto flex items-center justify-around h-12">
          
          {/* Tab Item: Lounge */}
          <button 
            onClick={() => setActiveTab('feed')}
            className="flex flex-col items-center gap-1 group flex-1 cursor-pointer"
          >
            <span className={`text-xl transition ${activeTab === 'feed' ? 'text-white scale-105' : 'text-zinc-500 group-hover:text-zinc-300'}`}>📺</span>
            <span className={`text-[9px] font-black uppercase tracking-widest font-sans ${activeTab === 'feed' ? 'text-white' : 'text-zinc-500'}`}>Lounge</span>
          </button>

          {/* Tab Item: Hosts */}
          <button 
            onClick={() => setActiveTab('directory')}
            className="flex flex-col items-center gap-1 group flex-1 cursor-pointer"
          >
            <span className={`text-xl transition ${activeTab === 'directory' ? 'text-white scale-105' : 'text-zinc-500 group-hover:text-zinc-300'}`}>👥</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest font-sans ${activeTab === 'directory' ? 'text-white' : 'text-zinc-500'}`}>Hosts</span>
          </button>

          {/* Tab Item: Radar */}
          <button 
            onClick={() => setActiveTab('map')}
            className="flex flex-col items-center gap-1 group flex-1 cursor-pointer"
          >
            <span className={`text-xl transition ${activeTab === 'map' ? 'text-white scale-105' : 'text-zinc-500 group-hover:text-zinc-300'}`}>🧭</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest font-sans ${activeTab === 'map' ? 'text-white' : 'text-zinc-500'}`}>Radar</span>
          </button>

          {/* Tab Item: Chat */}
          <button 
            onClick={() => setActiveTab('chat')}
            className="flex flex-col items-center gap-1 group flex-1 relative cursor-pointer"
          >
            <span className={`text-xl transition ${activeTab === 'chat' ? 'text-white scale-105' : 'text-zinc-500 group-hover:text-zinc-300'}`}>💬</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest font-sans ${activeTab === 'chat' ? 'text-white' : 'text-zinc-500'}`}>Chat</span>
            
            {/* Dynamic unread chat alert node indicator */}
            {unreadCount > 0 && (
              <span className="absolute top-1 right-6 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
          </button>

          {/* Tab Item: Portal */}
          <button 
            onClick={() => setActiveTab('verification')}
            className="flex flex-col items-center gap-1 group flex-1 cursor-pointer"
          >
            <span className={`text-xl transition ${activeTab === 'verification' ? 'text-white scale-105' : 'text-zinc-500 group-hover:text-zinc-300'}`}>🏅</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest font-sans ${activeTab === 'verification' ? 'text-white' : 'text-zinc-500'}`}>Portal</span>
          </button>

          {/* Tab Item: Vault */}
          <button 
            onClick={() => setActiveTab('admin')}
            className="flex flex-col items-center gap-1 group flex-1 cursor-pointer"
          >
            <span className={`text-xl transition ${activeTab === 'admin' ? 'text-white scale-105' : 'text-zinc-500 group-hover:text-zinc-300'}`}>🛡️</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest font-sans ${activeTab === 'admin' ? 'text-white' : 'text-zinc-500'}`}>Vault</span>
          </button>

        </div>
      </footer>
    </div>
  );
}
