import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveShortInteractions } from '../hooks/useLiveShortInteractions';
import { Heart, MessageSquare, Music as MusicIcon, Eye, Download, VolumeX, Volume2, Loader2, MapPin } from 'lucide-react';
import { SNAP_FILTERS } from '../utils/filterEffects';
import { supabase } from '../lib/supabase';
import { useMonetagRevenue } from '../hooks/useMonetagRevenue';
import { motion, AnimatePresence } from 'motion/react';
import { formatMetricCount } from '../utils/formatMetrics';
import toast from 'react-hot-toast';
import { ShortsWatermark, drawWatermarkOnCanvas } from './ShortsWatermark';
import { executeCardPayment } from '../utils/processPayment';
import { getSafeVideoUrl, RELIABLE_FALLBACK_VIDEO } from '../utils/videoUtils';

interface MogReaction {
  id: number;
  emoji: string;
  x: number;
  rotation: number;
}

const MOG_REACTIONS = ['💋', '👑', '💎', '🔱', '🥂', '👁️‍🗨️', '🖤'];

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
  isNext?: boolean; // Preload option for next video in line
  onProgress?: (percent: number) => void;
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

function LoungeShortsPlayerComponent({ 
  short, 
  currentUserId, 
  isActive = true,
  isMuted: isMutedProp,
  onMuteToggle,
  isNext = false,
  onProgress
}: ShortVideoPlayerProps) {
  const { triggerMonetagEarning } = useMonetagRevenue(3);
  const [commentInput, setCommentInput] = useState('');
  const [commentMogList, setCommentMogList] = useState<MogReaction[]>([]);

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Trigger on valid character keystrokes (alphanumeric, punctuation, spaces, emojis, etc.)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const randomMog = MOG_REACTIONS[Math.floor(Math.random() * MOG_REACTIONS.length)];
      
      const newMog: MogReaction = {
        id: Date.now() + Math.random(),
        emoji: randomMog,
        x: (Math.random() - 0.5) * 60, // Random left/right drift (-30px to 30px)
        rotation: (Math.random() - 0.5) * 40, // Tilt angle (-20deg to 20deg)
      };

      // Keep max 8 active floating Mogs on screen to keep it smooth
      setCommentMogList((prev) => [...prev.slice(-7), newMog]);
    }
  };

  const removeCommentMog = (id: number) => {
    setCommentMogList((prev) => prev.filter((item) => item.id !== id));
  };
  const [showComments, setShowComments] = useState(false);
  const [showBoostConfirmModal, setShowBoostConfirmModal] = useState(false);
  const [isBoostingPost, setIsBoostingPost] = useState(false);
  const [localIsMuted, setLocalIsMuted] = useState(true);
  const isMuted = isMutedProp !== undefined ? isMutedProp : localIsMuted;

  const [copied, setCopied] = useState(false);

  const handleCopyShareLink = async () => {
    try {
      const hostName = short.profiles?.username || 'VIP';
      const profileHandle = hostName ? `@${hostName.replace('@', '')}` : 'VIP';
      const shareUrl = `${window.location.origin}/${profileHandle}?video=${short.id}`;

      await navigator.clipboard.writeText(shareUrl);
      
      setCopied(true);
      toast.success("Share link copied to clipboard!", {
        style: {
          background: '#09090b',
          color: '#f4f4f5',
          border: '1px solid #27272a'
        }
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
      toast.error("Could not copy share link.");
    }
  };

  const toggleMute = () => {
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setLocalIsMuted(prev => !prev);
    }
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const retryCountRef = useRef(0);
  const [, setMetadataLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressContainerRef = useRef<HTMLDivElement>(null);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Intersection Observer for active viewport detection & auto-play / auto-pause on scroll
  useEffect(() => {
    const el = playerContainerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.7;
        setIsIntersecting(visible);
      },
      {
        threshold: [0.7]
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  // ── ✨ QUICK REACTIONS ENGINE DEFINITIONS ──
  interface QuickReaction {
    id: number;
    emoji: string;
    left: number;
    size: number;
    spin: number;
    speed: number;
    drift: number;
  }

  const [quickReactions, setQuickReactions] = useState<QuickReaction[]>([]);
  const [showReactionDock, setShowReactionDock] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const addQuickReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    // Position reactions around the right side near the controls
    const left = 75 + (Math.random() - 0.5) * 15;
    const size = 24 + Math.random() * 16;
    const spin = (Math.random() - 0.5) * 120;
    const speed = 1.6 + Math.random() * 1.2;
    const drift = (Math.random() - 0.5) * 140;

    setQuickReactions(prev => [...prev, { id, emoji, left, size, spin, speed, drift }].slice(-30));
  };

  // Reset retry count when short video_url or active state changes
  useEffect(() => {
    retryCountRef.current = 0;
    setMetadataLoaded(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackProgress(0);
    setShowReactionDock(false);
    setIsExpanded(false);
  }, [short.id, short.video_url, isActive]);

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

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const calculateScrubPercentage = (clientX: number) => {
    if (!progressContainerRef.current) return 0;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const width = rect.width;
    const x = Math.max(0, Math.min(clientX - rect.left, width));
    return (x / width) * 100;
  };

  const handleScrubStart = (clientX: number) => {
    if (!videoRef.current || !videoRef.current.duration) return;
    setIsScrubbing(true);
    const pct = calculateScrubPercentage(clientX);
    setPlaybackProgress(pct);
    const newTime = (pct / 100) * videoRef.current.duration;
    setCurrentTime(newTime);
    videoRef.current.currentTime = newTime;
  };

  const handleScrubMove = (clientX: number) => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const pct = calculateScrubPercentage(clientX);
    setPlaybackProgress(pct);
    const newTime = (pct / 100) * videoRef.current.duration;
    setCurrentTime(newTime);
    videoRef.current.currentTime = newTime;
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        handleScrubMove(e.clientX);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isScrubbing && e.touches[0]) {
        handleScrubMove(e.touches[0].clientX);
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchmove', handleGlobalTouchMove);
      window.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isScrubbing]);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'profile' | 'fans' | 'following' | 'friends'>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [fansList, setFansList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setActiveModalTab('profile');
        setSearchQuery('');
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
  const [isSocialLoading, setIsSocialLoading] = useState<boolean>(false);

  // Fetch real-time Fans, Following, and Friends from Supabase for current target profile
  useEffect(() => {
    if (!isDropdownOpen) return;
    const targetUserId = creatorId || currentUserId;
    if (!targetUserId) return;

    let isMounted = true;

    async function fetchRealtimeSocialLists() {
      setIsSocialLoading(true);
      try {
        // 1. Fetch Fans (followers of targetUserId)
        const { data: fansData } = await supabase
          .from('user_followers')
          .select('follower_id')
          .eq('following_id', targetUserId);

        let liveFans: any[] = [];
        if (fansData && fansData.length > 0) {
          const followerIds = fansData.map((f: any) => f.follower_id).filter(Boolean);
          if (followerIds.length > 0) {
            const { data: fanProfiles } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .in('id', followerIds);

            let myFollowingSet = new Set<string>();
            if (currentUserId) {
              const { data: myFollowingData } = await supabase
                .from('user_followers')
                .select('following_id')
                .eq('follower_id', currentUserId);
              if (myFollowingData) {
                myFollowingData.forEach((row: any) => myFollowingSet.add(row.following_id));
              }
            }

            if (fanProfiles && fanProfiles.length > 0) {
              liveFans = fanProfiles.map((p: any) => ({
                id: p.id,
                name: p.full_name || p.username || 'Fan',
                handle: `@${p.username || 'user'}`,
                avatar: p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                isFollowingBack: myFollowingSet.has(p.id)
              }));
            }
          }
        }

        // 2. Fetch Following (users targetUserId follows)
        const { data: followingData } = await supabase
          .from('user_followers')
          .select('following_id')
          .eq('follower_id', targetUserId);

        let liveFollowing: any[] = [];
        if (followingData && followingData.length > 0) {
          const followingIds = followingData.map((f: any) => f.following_id).filter(Boolean);
          if (followingIds.length > 0) {
            const { data: followingProfiles } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .in('id', followingIds);

            if (followingProfiles && followingProfiles.length > 0) {
              liveFollowing = followingProfiles.map((p: any) => ({
                id: p.id,
                name: p.full_name || p.username || 'User',
                handle: `@${p.username || 'user'}`,
                avatar: p.avatar_url || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
                isFollowing: true
              }));
            }
          }
        }

        // 3. Fetch Friends (Accepted connections)
        const { data: connectionsData } = await supabase
          .from('connections')
          .select('requester_id, addressee_id, status')
          .or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`)
          .eq('status', 'accepted');

        let liveFriends: any[] = [];
        if (connectionsData && connectionsData.length > 0) {
          const friendIds = connectionsData
            .map((c: any) => (c.requester_id === targetUserId ? c.addressee_id : c.requester_id))
            .filter(Boolean);

          if (friendIds.length > 0) {
            const { data: friendProfiles } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .in('id', friendIds);

            if (friendProfiles && friendProfiles.length > 0) {
              liveFriends = friendProfiles.map((p: any) => ({
                id: p.id,
                name: p.full_name || p.username || 'Friend',
                handle: `@${p.username || 'user'}`,
                avatar: p.avatar_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
                isOnline: true,
                connectedSince: 'Connected'
              }));
            }
          }
        } else {
          // Fallback: Mutual followers
          const fanIds = new Set(liveFans.map(f => f.id));
          const mutuals = liveFollowing.filter(f => fanIds.has(f.id));
          if (mutuals.length > 0) {
            liveFriends = mutuals.map(p => ({
              id: p.id,
              name: p.name,
              handle: p.handle,
              avatar: p.avatar,
              isOnline: true,
              connectedSince: 'Connected'
            }));
          }
        }

        if (isMounted) {
          setFansList(liveFans);
          setFollowingList(liveFollowing);
          setFriendsList(liveFriends);
        }
      } catch (err) {
        console.warn("Could not fetch realtime social lists from Supabase:", err);
      } finally {
        if (isMounted) setIsSocialLoading(false);
      }
    }

    fetchRealtimeSocialLists();

    return () => {
      isMounted = false;
    };
  }, [isDropdownOpen, creatorId, currentUserId]);

  // Fetch current follower totals when the short mounts & subscribe to live changes
  useEffect(() => {
    let isMounted = true;
    if (!isActive) return;

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
  }, [creatorId, isActive]);

  // Check if current user is already following this creator on load
  useEffect(() => {
    let isMounted = true;
    if (!isActive) return;

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
  }, [currentUserId, creatorId, isActive]);

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
  const backupVideoUrl = RELIABLE_FALLBACK_VIDEO;
  const safeShortVideoUrl = getSafeVideoUrl(short.video_url, typeof short.id === 'number' ? short.id : 0);
  
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

  const [isLiked, setIsLiked] = useState(false);

  // Check initial state of 'isLiked' by querying Supabase 'likes' table on component mount
  useEffect(() => {
    let isMounted = true;
    if (!isActive) return;

    async function checkInitialLikeState() {
      if (!currentUserId || currentUserId === 'anonymous_lounge_guest' || !short?.id) return;
      try {
        const { data, error } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('video_id', short.id)
          .maybeSingle();

        if (isMounted && !error && data) {
          setIsLiked(true);
        }
      } catch (err) {
        console.warn("Error querying initial state from 'likes' table:", err);
      }
    }
    checkInitialLikeState();
    return () => {
      isMounted = false;
    };
  }, [currentUserId, short?.id, isActive]);

  const [doubleTapHearts, setDoubleTapHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const lastTapTime = useRef<number>(0);
  const tapTimeoutRef = useRef<any>(null);

  // Clean up gesture timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms
    if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      // Cancel any queued single tap play/pause action
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      // 1. Force play the video to ensure it remains playing if single-tap delay didn't toggle it yet
      const video = videoRef.current;
      if (video && video.paused) {
        video.play().catch(() => {});
      }

      // 2. Trigger like if not already liked
      if (!hasLiked) {
        toggleLike();
        // Trigger button burst animation as well
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
        setFloatingHearts(prev => [...prev, ...newHearts].slice(-20));
      }

      // Update 'isLiked' local state and invoke Supabase call to update 'likes' table for the current video id
      if (!isLiked) {
        setIsLiked(true);
        const fallbackUserId = currentUserId && currentUserId !== 'anonymous_lounge_guest' ? currentUserId : 'anonymous_lounge_guest';
        
        (async () => {
          try {
            const { error } = await supabase
              .from('likes')
              .upsert([
                {
                  user_id: fallbackUserId,
                  video_id: short.id,
                  created_at: new Date().toISOString()
                }
              ], { onConflict: 'user_id,video_id' });
              
            if (error) {
              console.warn("Failed to update 'likes' table via double tap:", error);
            } else {
              console.log("Successfully updated 'likes' table for video:", short.id);
            }
          } catch (err: any) {
            console.warn("Failed to update 'likes' table:", err?.message || err);
          }
        })();
      }

      // 3. Spawn a heart exactly at the clicked position!
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newHeart = {
        id: Date.now() + Math.random(),
        x,
        y
      };

      setDoubleTapHearts(prev => [...prev, newHeart]);

      // Gentle haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([10, 30, 10]);
        } catch (_) {}
      }

      // Clear after animation completes
      setTimeout(() => {
        setDoubleTapHearts(prev => prev.filter(h => h.id !== newHeart.id));
      }, 800);
    } else {
      // Single tap - queue action to avoid interfering with double-tap
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      tapTimeoutRef.current = setTimeout(() => {
        togglePlayAndUnmute();
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
    lastTapTime.current = now;
  };

  // Auto-play/pause control based on visible active status or IntersectionObserver threshold
  const shouldPlay = isActive || isIntersecting;

  useEffect(() => {
    let isCurrent = true; // Prevents race conditions on unmounted/inactive components
    const video = videoRef.current;
    if (!video) return;

    setPlaybackProgress(0);
    setHasStartedPlaying(false);

    const playVideo = async () => {
      try {
        if (!shouldPlay) {
          playbackDiagnostics.log('PAUSE', { videoUrl: safeShortVideoUrl, shortId: short.id, context: 'auto_pause_hook' });
          if (playPromiseRef.current) {
            try {
              await playPromiseRef.current;
            } catch (_) {}
          }
          video.pause();
          try {
            video.currentTime = 0; // Reset playback position when swiped away
          } catch (_) {}
          return;
        }

        setMediaLoading(true);

        // 1. Ensure muted and playsInline for browser autoplay compliance
        video.muted = !isActive || isMuted;
        video.playsInline = true;

        // 2. Initiate playback directly using preloaded buffer without resetting source
        playbackDiagnostics.log('SYNC_INIT', { videoUrl: safeShortVideoUrl, isMuted: video.muted, shortId: short.id, context: 'auto_play_hook' });
        
        const playPromise = video.play();
        playPromiseRef.current = playPromise;

        if (playPromise !== undefined) {
          await playPromise;
          
          if (isCurrent) {
            playbackDiagnostics.log('SUCCESS', { videoUrl: safeShortVideoUrl, isMuted: video.muted, shortId: short.id, context: 'auto_play_hook' });
            console.log("🎥 Video playing successfully.");
          }
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          // Safe to ignore on quick renders
          playbackDiagnostics.log('BLOCKED_AUTOPLAY', { errorName: error.name, errorMessage: error.message, videoUrl: safeShortVideoUrl, context: 'abort_error_handled' });
          console.warn("Playback interrupted safely during render sync.");
        } else {
          playbackDiagnostics.log('PLAYBACK_ERROR', { errorName: error.name, errorMessage: error.message, context: 'auto_play_hook' });
          console.error("Playback engine error:", error);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        }
      }
    };

    playVideo();

    // 🧹 CLEANUP: Runs when React re-renders or unmounts the video
    return () => {
      isCurrent = false;
      if (video) {
        const handleUnmountPause = async () => {
          playbackDiagnostics.log('UNMOUNT', { videoUrl: safeShortVideoUrl, shortId: short.id, context: 'unmount_cleanup' });
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
  }, [short.id, safeShortVideoUrl, shouldPlay]);

  // Dynamically control muting without reloading the video
  useEffect(() => {
    if (videoRef.current) {
      const calculatedMuted = !isActive || isMuted;
      playbackDiagnostics.log('STATE_TRANSITION', { 
        isActive, 
        isMuted, 
        calculatedMuted, 
        videoId: short.id, 
        videoUrl: safeShortVideoUrl 
      });
      videoRef.current.muted = calculatedMuted;
    }
  }, [isMuted, isActive, short.id, safeShortVideoUrl]);

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    postComment(commentInput);
    setCommentInput('');
  };

  const handleTriggerPostBoost = () => {
    if (!currentUserId) {
      toast.error("⚠️ Please log in to establish secure escrow channels.");
      return;
    }
    setShowBoostConfirmModal(true);
  };

  const handleConfirmAndPayBoost = async () => {
    if (!currentUserId || !short?.id) return;
    setIsBoostingPost(true);

    const boostPriceCents = 5000; // $50.00 in cents
    const videoTitle = short.title || short.caption || 'Broadcast Loop';

    // Calculate expiration date (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      await executeCardPayment({
        userId: currentUserId,
        amountInCents: boostPriceCents,
        description: `7-Day Top Feed Boost: ${videoTitle}`,
        metadata: { 
          videoId: short.id, 
          boostType: 'WeeklyTopFeedAccelerator',
          durationDays: 7
        },
        onSuccess: async () => {
          const { error } = await supabase
            .from('lounge_shorts')
            .update({
              views_count: (short.views_count || 0) + 500,
              is_boosted: true,
              boost_expires_at: expiresAt
            })
            .eq('id', short.id);

          if (error) throw error;

          toast.success(`🎉 $50.00 Debited! "${videoTitle}" is boosted to the top of the feed for 7 days!`, { duration: 6000 });
          setShowBoostConfirmModal(false);
        }
      });
    } catch (err: any) {
      console.error("Failed to execute broadcast promotion accelerator:", err);
      toast.error(`❌ Campaign failed: ${err.message || 'Payment not debited.'}`);
    } finally {
      setIsBoostingPost(false);
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

    const downloadToastId = toast.loading("Downloading video...", {
      style: {
        background: '#09090b',
        color: '#f4f4f5',
        border: '1px solid #27272a'
      }
    });

    // Hidden elements we need to clean up at the end
    let videoEl: HTMLVideoElement | null = null;
    let localBlobUrl: string | null = null;
    let logoBlobUrl: string | null = null;
    let audioContext: AudioContext | null = null;

    try {
      const videoUrl = short.video_url || backupVideoUrl;
      const hostName = short.profiles?.username || 'VIP';

      toast.loading("Buffering video stream...", {
        id: downloadToastId,
        style: {
          background: '#09090b',
          color: '#f4f4f5',
          border: '1px solid #27272a'
        }
      });

      // 1. Fetch the video as a Blob first to solve CORS for Canvas and WebAudio
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch video file.");
      }
      const videoBlob = await response.blob();
      localBlobUrl = window.URL.createObjectURL(videoBlob);

      // 2. Create off-screen video element and configure CORS BEFORE setting src
      videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous'; // CRUCIAL: Must be set before the src is assigned
      videoEl.src = localBlobUrl;
      videoEl.preload = 'auto';
      videoEl.muted = false; // Must remain false so audio context can capture the stream data
      videoEl.volume = 1.0; // Keep full 100% volume for recording capture
      videoEl.playsInline = true;
      
      // Hidden hack: absolute position, out of sight but present in DOM so mobile Safari renders frames
      videoEl.style.position = 'fixed';
      videoEl.style.top = '-9999px';
      videoEl.style.left = '-9999px';
      videoEl.style.width = '1px';
      videoEl.style.height = '1px';
      videoEl.style.opacity = '0';
      videoEl.style.pointerEvents = 'none';
      document.body.appendChild(videoEl);

      // Load metadata with detailed error messaging for CORS and network issues
      await new Promise((resolve, reject) => {
        if (!videoEl) return reject(new Error("Video element is null."));
        videoEl.onloadedmetadata = () => {
          console.log("✅ Source video metadata loaded successfully with CORS access.");
          resolve(true);
        };
        videoEl.onerror = () => {
          console.error("🚨 Source layer failed to compile. The server hosting this video is blocking cross-origin streaming requests.");
          if (videoEl?.error) {
            console.error(`Error Code ${videoEl.error.code}: ${videoEl.error.message}`);
          }
          reject(new Error("Media asset stream blocked by host provider security policies."));
        };
      });

      const duration = videoEl.duration || 10;
      const originalWidth = videoEl.videoWidth || 720;
      const originalHeight = videoEl.videoHeight || 1280;

      // 3. Set to full crisp HD dimensions
      const targetWidth = 1080;
      const scaleFactor = targetWidth / originalWidth;
      const width = targetWidth;
      const height = originalHeight * scaleFactor;

      // Set up the canvas with optimized rendering contexts
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error("Could not initialize canvas 2D context");
      
      // Re-enable smooth rendering since we have higher pixel density
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 4. Load watermark logo
      const logo = new Image();
      let logoLoaded = false;
      
      try {
        logo.crossOrigin = 'anonymous';
        logo.src = "/logo.png";
        await new Promise((resolve, reject) => {
          logo.onload = () => {
            logoLoaded = true;
            resolve(true);
          };
          logo.onerror = reject;
        });
      } catch (err) {
        console.warn("New crown logo failed to compile on canvas download from local path, trying Supabase fallback.", err);
      }

      // Fallback: If initial local load failed, try loading without crossOrigin
      if (!logoLoaded) {
        try {
          logo.src = '/logo.png';
          await new Promise((resolve, reject) => {
            logo.onload = () => {
              logoLoaded = true;
              resolve(true);
            };
            logo.onerror = reject;
          });
        } catch (err) {
          console.error("Local fallback logo failed to load. Proceeding with text-only watermark.", err);
        }
      }

      // 5. Try capturing audio using WebAudio API + direct video element stream fallback
      let audioTrack: MediaStreamTrack | null = null;
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaElementSource(videoEl);
        const destination = audioContext.createMediaStreamDestination();
        
        // Connect source directly to recording destination at 100% full volume
        source.connect(destination);
        
        // Attenuate speaker playback so the user isn't blasted with sound during background export
        const localGain = audioContext.createGain();
        localGain.gain.value = 0.01;
        source.connect(localGain);
        localGain.connect(audioContext.destination);

        audioTrack = destination.stream.getAudioTracks()[0] || null;
      } catch (err) {
        console.warn("Could not capture audio stream via WebAudio.", err);
      }

      // Direct fallback audio track from video element if captureStream is available
      let directAudioTrack: MediaStreamTrack | null = null;
      try {
        if (!audioTrack && (videoEl as any).captureStream) {
          const elemStream = (videoEl as any).captureStream();
          directAudioTrack = elemStream.getAudioTracks()[0] || null;
        }
      } catch (e) {
        console.warn("Direct captureStream audio fallback failed:", e);
      }

      const finalAudioTrack = audioTrack || directAudioTrack;

      // 6. Set up MediaRecorder with compatible MIME types
      const videoStream = canvas.captureStream(30);
      const combinedStream = new MediaStream();
      videoStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      if (finalAudioTrack) {
        combinedStream.addTrack(finalAudioTrack);
      }

      const mimeTypes = [
        'video/mp4;codecs=h264',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/ogg'
      ];

      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const recorderOptions: any = {
        videoBitsPerSecond: 2500000 // 2.5 Mbps locks encoding performance to prevent stutter and frame drops
      };
      if (selectedMimeType) {
        recorderOptions.mimeType = selectedMimeType;
      }
      const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const downloadPromise = new Promise<void>((resolve, reject) => {
        mediaRecorder.onstop = () => {
          try {
            // Determine the file extension based on what was recorded
            const isWebm = selectedMimeType.includes('webm');
            const fileExt = isWebm ? 'webm' : 'mp4';
            const recordedBlob = new Blob(chunks, { type: isWebm ? 'video/webm' : 'video/mp4' });
            const compiledUrl = window.URL.createObjectURL(recordedBlob);

            const link = document.createElement('a');
            link.href = compiledUrl;
            link.download = `LUSTY-GLOBAL-${hostName.toUpperCase()}-${Date.now()}.${fileExt}`;
            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            window.URL.revokeObjectURL(compiledUrl);
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        mediaRecorder.onerror = (e) => reject(e);
      });

      // Reset playback state before start to prevent frame skip / audio drift
      videoEl.currentTime = 0;
      videoEl.playbackRate = 1.0;

      // Start recording and start playback
      mediaRecorder.start();
      await videoEl.play();

      let lastPercent = -1;
      let isRecording = true;

      // 7. Render frame-by-frame draw loop with high-performance real-time timing
      const drawFrame = () => {
        if (!videoEl || !ctx || !isRecording) return;

        // Check if finished
        if (videoEl.paused || videoEl.ended || videoEl.currentTime >= duration - 0.05) {
          if (isRecording) {
            isRecording = false;
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }
          return;
        }

        // Draw current video frame to fill canvas
        ctx.drawImage(videoEl, 0, 0, width, height);

        // Scale and overlay the circular crown logo (Aspect ratio is 1:1) - 18% looks balanced at 1080p
        const logoSize = width * 0.16;

        if (logo.complete && logo.naturalWidth) {
          ctx.save();
          ctx.globalAlpha = 1.0; 
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 4;
          ctx.shadowOffsetY = 4;
          ctx.drawImage(logo, width - logoSize - 40, 40, logoSize, logoSize);
          ctx.restore();
        }

        // 👑 BAKE "LUSTY GLOBAL VIP" BRANDING + @USERNAME DIRECTLY INTO VIDEO FRAMES
        drawWatermarkOnCanvas(ctx, width, hostName);

        // Update progress toast (throttled)
        const percent = Math.min(99, Math.round((videoEl.currentTime / duration) * 100));
        if (percent !== lastPercent) {
          lastPercent = percent;
          toast.loading(`Applying VIP watermark: ${percent}%...`, {
            id: downloadToastId,
            style: {
              background: '#09090b',
              color: '#f4f4f5',
              border: '1px solid #27272a'
            }
          });
        }
      };

      // Use requestVideoFrameCallback if available (Chrome/Safari/Edge optimization)
      // Fallback directly to a hardcoded frame ticker to force real-time output timing
      if ('requestVideoFrameCallback' in videoEl) {
        const updateLoop = () => {
          drawFrame();
          if (isRecording && videoEl && !videoEl.ended) {
            (videoEl as any).requestVideoFrameCallback(updateLoop);
          }
        };
        (videoEl as any).requestVideoFrameCallback(updateLoop);
      } else {
        // Hard bulletproof fallback matching 30fps track timing constraints precisely
        const intervalId = setInterval(() => {
          if (!isRecording || !videoEl || videoEl.ended) {
            clearInterval(intervalId);
          } else {
            drawFrame();
          }
        }, 1000 / 30);
      }

      videoEl.addEventListener('ended', () => {
        if (isRecording) {
          isRecording = false;
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        }
      });

      // Wait for MediaRecorder to finish writing the file
      await downloadPromise;

      toast.success("Ready! Plays smoothly on all devices.", {
        id: downloadToastId,
        style: {
          background: '#09090b',
          color: '#f4f4f5',
          border: '1px solid #27272a'
        }
      });

    } catch (error) {
      console.error("Download and watermark failed:", error);
      toast.error("Could not download the video. Please try again.", {
        id: downloadToastId,
        style: {
          background: '#09090b',
          color: '#f4f4f5',
          border: '1px solid #27272a'
        }
      });
    } finally {
      setIsDownloading(false);
      // Clean up resources
      if (videoEl) {
        try {
          videoEl.pause();
          document.body.removeChild(videoEl);
        } catch (_) {}
      }
      if (localBlobUrl) {
        window.URL.revokeObjectURL(localBlobUrl);
      }
      if (logoBlobUrl) {
        window.URL.revokeObjectURL(logoBlobUrl);
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    }
  };

  const formatCountValue = (count: number): string => {
    return formatMetricCount(count);
  };


  return (
    <div 
      ref={playerContainerRef}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className="w-full h-full relative flex flex-col justify-end bg-black"
    >
      
      {/* ── 🎈 FLOATING QUICK REACTIONS CANVAS OVERLAY ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
        <AnimatePresence>
          {quickReactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ y: '100%', x: 0, opacity: 0, scale: 0.3 }}
              animate={{
                y: ['100%', '80%', '40%', '0%'],
                x: [0, reaction.drift * 0.3, reaction.drift * -0.6, reaction.drift],
                opacity: [0, 1, 1, 0],
                scale: [0.3, 1.25, 1.1, 0.4],
                rotate: [0, reaction.spin * 0.3, reaction.spin * 0.7, reaction.spin]
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reaction.speed,
                ease: "easeOut"
              }}
              onAnimationComplete={() => {
                setQuickReactions(prev => prev.filter(r => r.id !== reaction.id));
              }}
              className="absolute select-none pointer-events-none font-bold filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
              style={{ 
                left: `${reaction.left}%`,
                fontSize: `${reaction.size}px`,
                bottom: '10%'
              }}
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── ❤️ DOUBLE TAP LIKE HEART GESTURE OVERLAY ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-35">
        {doubleTapHearts.map((heart) => (
          <div
            key={heart.id}
            style={{
              position: 'absolute',
              left: heart.x - 40,
              top: heart.y - 40,
              width: '80px',
              height: '80px',
            }}
            className="flex items-center justify-center select-none animate-heart-spring"
          >
            <Heart className="w-20 h-20 fill-pink-500 text-pink-500 filter drop-shadow-[0_0_15px_rgba(236,72,153,0.9)]" />
          </div>
        ))}
      </div>

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
        /* If no custom thumbnail, show a static dark abstract gradient background as preview image, OR if intersecting, a muted background loop */
        isIntersecting ? (
          <video 
            src={safeShortVideoUrl}
            preload="none"
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-cover z-0"
            style={{
              transform: 'translate3d(0, 0, 0)',
              willChange: 'transform'
            }}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#120d1a] to-black z-0 flex items-center justify-center">
            <span className="text-[10px] text-zinc-700 font-mono tracking-widest uppercase">Lounge Feed Preview</span>
          </div>
        )
      )}

      {/* 📹 Live Video Asset Player - Preloaded when next in feed to optimize buffer states */}
      {(isActive || isNext) && (
        <video 
          ref={videoRef}
          src={isActive || isNext || isIntersecting ? safeShortVideoUrl : undefined}
          preload={isActive ? "auto" : "metadata"}
          loop 
          muted={!isActive || isMuted} 
          playsInline
          autoPlay={isActive}
          controls={false}
          onContextMenu={handleContextMenu}
          crossOrigin="anonymous"
          onClick={handleVideoClick}
          onLoadedMetadata={() => {
            console.log("🎥 Main video metadata loaded successfully.");
            setMetadataLoaded(true);
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onLoadedData={handleMediaSyncValidation}
          onCanPlay={() => setMediaLoading(false)}
          onCanPlayThrough={() => setMediaLoading(false)}
          onPlay={() => { setHasStartedPlaying(true); setMediaLoading(false); }}
          onPlaying={() => { setHasStartedPlaying(true); setMediaLoading(false); }}
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            if (video.duration && !isScrubbing) {
              const pct = (video.currentTime / video.duration) * 100;
              setPlaybackProgress(pct);
              setCurrentTime(video.currentTime);
              setDuration(video.duration);
              if (onProgress) {
                onProgress(pct);
              }
            }
          }}
          onError={() => {
            const video = videoRef.current;
            if (!video) return;

            if (video.error) {
              console.error(`🚨 Source layer failed to load (Error Code ${video.error.code}): ${video.error.message}`);
            }

            const currentSrc = video.src;
            // If we are already playing the backup video and it fails, unblock loading spinner
            if (currentSrc.includes('gtv-videos-bucket') || currentSrc === backupVideoUrl) {
              console.error("🚨 Backup video asset also failed to load.");
              playbackDiagnostics.log('BACKUP_FAILED', { backupVideoUrl });
              setMediaLoading(false);
              return;
            }

            // Immediately switch to backup asset on source error to prevent stuck loading
            console.warn("⚠️ Video loading failed. Fallback to reliable stream asset...");
            playbackDiagnostics.log('FALLBACK_TRIGGERED', { context: 'source_load_error', backupVideoUrl });
            
            video.src = backupVideoUrl;
            video.load();
            video.play().then(() => {
              setMediaLoading(false);
            }).catch(() => {
              setMediaLoading(false);
            });
          }}
          className={`absolute inset-0 w-full h-full object-cover z-10 cursor-pointer transition-opacity duration-500 ${mediaLoading || !isActive ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
          style={{ 
            filter: appliedFilterShaderStyle !== 'none' ? appliedFilterShaderStyle : (appliedFilterStyle !== 'none' ? appliedFilterStyle : undefined),
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform'
          }}
        >
          <p className="text-xs text-zinc-500 font-mono text-center p-4">
            Your browser does not support HTML5 video compilation.
          </p>
        </video>
      )}

      {/* ── 📱 MOBILE & DESKTOP WATERMARK OVERLAY ── */}
      {!mediaLoading && (
        <ShortsWatermark username={short.profiles?.username || 'VIP'} />
      )}
 
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

          {/* ── 📱 PROFILE MODAL / VIEW (TRIGGERED ON AVATAR CLICK) ── */}
          {isDropdownOpen && (
            <div className="absolute right-14 top-0 w-64 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl flex flex-col z-[100] animate-in fade-in slide-in-from-right-2 duration-150 select-none overflow-hidden text-center min-h-[380px]">
              
              {/* Top Navigation Header */}
              <div className="flex items-center justify-between p-3 border-b border-zinc-800/80 bg-zinc-950/60">
                {activeModalTab !== 'profile' ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveModalTab('profile');
                    }}
                    className="text-zinc-400 hover:text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    ← Back
                  </button>
                ) : (
                  <span className="text-xs font-bold text-zinc-400">User Profile</span>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(false);
                    setActiveModalTab('profile');
                  }}
                  className="w-5 h-5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs flex items-center justify-center transition cursor-pointer"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {/* 1. PROFILE SUMMARY VIEW */}
              {activeModalTab === 'profile' && (
                <div className="p-3.5 flex flex-col items-center flex-1 justify-between">
                  {/* Avatar & Title */}
                  <div className="flex flex-col items-center">
                    <div className="relative mb-2 mt-1">
                      <img 
                        src={short.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                        alt={short.profiles?.username || 'Host'} 
                        className="w-16 h-16 rounded-full object-cover border-2 border-pink-500 shadow-lg" 
                      />
                      {short.profiles?.is_verified && (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-sky-500 text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold border border-zinc-950 shadow">
                          ✓
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-white truncate max-w-full">
                      @{short.profiles?.username || 'companion'}
                    </h3>
                    {short.profiles?.title && (
                      <p className="text-[10px] text-zinc-400 truncate max-w-full mt-0.5">
                        {short.profiles.title}
                      </p>
                    )}
                  </div>

                  {/* 📊 CLICKABLE COUNTERS GRID (FANS vs FOLLOWING vs FRIENDS) */}
                  <div className="grid grid-cols-3 gap-1.5 w-full my-2.5">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalTab('fans');
                      }}
                      className="bg-zinc-800/80 hover:bg-zinc-800/100 border border-zinc-700/60 hover:border-pink-500/50 p-2 rounded-xl flex flex-col items-center transition active:scale-95 cursor-pointer shadow-inner"
                    >
                      <span className="text-pink-500 font-extrabold text-[9px] uppercase tracking-wider">
                        FANS
                      </span>
                      <span className="text-white text-xs font-black font-mono mt-0.5">
                        {formatCountValue(followerCount)}
                      </span>
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalTab('following');
                      }}
                      className="bg-zinc-800/80 hover:bg-zinc-800/100 border border-zinc-700/60 hover:border-sky-500/50 p-2 rounded-xl flex flex-col items-center transition active:scale-95 cursor-pointer shadow-inner"
                    >
                      <span className="text-sky-400 font-extrabold text-[9px] uppercase tracking-wider">
                        FOLLOWING
                      </span>
                      <span className="text-white text-xs font-black font-mono mt-0.5">
                        {followingList.length}
                      </span>
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalTab('friends');
                      }}
                      className="bg-zinc-800/80 hover:bg-zinc-800/100 border border-zinc-700/60 hover:border-emerald-500/50 p-2 rounded-xl flex flex-col items-center transition active:scale-95 cursor-pointer shadow-inner"
                    >
                      <span className="text-emerald-400 font-extrabold text-[9px] uppercase tracking-wider">
                        FRIENDS
                      </span>
                      <span className="text-white text-xs font-black font-mono mt-0.5">
                        {friendsList.length}
                      </span>
                    </button>
                  </div>

                  {/* Follow / Unfollow Action Button */}
                  {!isOwnVideo && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollowToggle();
                      }}
                      disabled={isProcessing}
                      className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mb-2 cursor-pointer ${
                        isFollowing
                          ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                          : 'bg-pink-500 text-white hover:bg-pink-600 shadow-md shadow-pink-500/20'
                      }`}
                    >
                      {isFollowing ? '✓ Following' : '＋ Follow Host'}
                    </button>
                  )}

                  {/* Action Links */}
                  <div className="w-full flex flex-col gap-1 border-t border-zinc-800/80 pt-2 text-left">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDropdownOpen(false);
                        window.dispatchEvent(new CustomEvent('lounge-view-profile', { detail: { hostId: creatorId, defaultTab: 'about' } }));
                      }}
                      className="w-full text-left px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>👤 View Profile</span>
                      <span className="text-zinc-500 text-[10px]">→</span>
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDropdownOpen(false);
                        window.dispatchEvent(new CustomEvent('lounge-view-profile', { detail: { hostId: creatorId, defaultTab: 'media' } }));
                      }}
                      className="w-full text-left px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>🎬 View Videos</span>
                      <span className="text-zinc-500 text-[10px]">→</span>
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDropdownOpen(false);
                        window.dispatchEvent(new CustomEvent('lounge-chat', { detail: { companionId: creatorId } }));
                      }}
                      className="w-full text-left px-2.5 py-1 text-xs text-pink-400 font-semibold hover:bg-pink-500/10 rounded-lg transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>💬 Chat Now</span>
                      <span className="text-pink-500 text-[10px]">→</span>
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDropdownOpen(false);
                        window.dispatchEvent(new CustomEvent('lounge-booking', { detail: { hostId: creatorId } }));
                      }}
                      className="w-full text-left px-2.5 py-1 text-xs text-amber-400 font-medium hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span>📅 Book Session</span>
                      <span className="text-amber-500 text-[10px]">→</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. FANS, FOLLOWING & FRIENDS LIST VIEW */}
              {activeModalTab !== 'profile' && (
                <div className="flex flex-col flex-1 text-left">
                  {/* Tab Navigation */}
                  <div className="flex border-b border-zinc-800/80 bg-zinc-950/80">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalTab('fans');
                      }}
                      className={`flex-1 py-2 text-[10px] font-bold border-b-2 transition cursor-pointer text-center ${
                        activeModalTab === 'fans' 
                          ? 'border-pink-500 text-pink-500' 
                          : 'border-transparent text-zinc-400 hover:text-white'
                      }`}
                    >
                      Fans ({fansList.length})
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalTab('following');
                      }}
                      className={`flex-1 py-2 text-[10px] font-bold border-b-2 transition cursor-pointer text-center ${
                        activeModalTab === 'following' 
                          ? 'border-sky-400 text-sky-400' 
                          : 'border-transparent text-zinc-400 hover:text-white'
                      }`}
                    >
                      Following ({followingList.length})
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalTab('friends');
                      }}
                      className={`flex-1 py-2 text-[10px] font-bold border-b-2 transition cursor-pointer text-center ${
                        activeModalTab === 'friends' 
                          ? 'border-emerald-400 text-emerald-400' 
                          : 'border-transparent text-zinc-400 hover:text-white'
                      }`}
                    >
                      Friends ({friendsList.length})
                    </button>
                  </div>

                  {/* Search Input Filter */}
                  <div className="p-2 border-b border-zinc-800/80 bg-zinc-950/40">
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      onClick={(e) => e.stopPropagation()} 
                      className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition"
                    />
                  </div>

                  {/* Scrollable Users List */}
                  <div className="p-2 flex-1 overflow-y-auto max-h-60 divide-y divide-zinc-800/50">
                    {isSocialLoading ? (
                      <div className="py-8 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                        <span className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></span>
                        <span>Loading real-time data...</span>
                      </div>
                    ) : (
                      <>
                        {activeModalTab === 'fans' && (
                          fansList.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.handle.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                            fansList.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.handle.toLowerCase().includes(searchQuery.toLowerCase())).map((user) => (
                              <div key={user.id} className="flex items-center justify-between py-2 px-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold leading-tight text-white truncate">{user.name}</p>
                                    <p className="text-[10px] text-zinc-400 truncate">{user.handle}</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const willFollow = !user.isFollowingBack;
                                    setFansList(prev => prev.map(item => item.id === user.id ? { ...item, isFollowingBack: willFollow } : item));
                                    if (currentUserId) {
                                      try {
                                        if (willFollow) {
                                          await supabase.from('user_followers').insert([{ follower_id: currentUserId, following_id: user.id }]);
                                        } else {
                                          await supabase.from('user_followers').delete().eq('follower_id', currentUserId).eq('following_id', user.id);
                                        }
                                      } catch (err) {
                                        console.warn("Error toggling follow back:", err);
                                      }
                                    }
                                  }}
                                  className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition shrink-0 cursor-pointer ${
                                    user.isFollowingBack
                                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                      : 'bg-pink-600 hover:bg-pink-500 text-white shadow'
                                  }`}
                                >
                                  {user.isFollowingBack ? 'Following' : 'Follow Back'}
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="py-6 text-center text-xs text-zinc-500 font-mono">No fans found</div>
                          )
                        )}

                        {activeModalTab === 'following' && (
                          followingList.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.handle.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                            followingList.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.handle.toLowerCase().includes(searchQuery.toLowerCase())).map((user) => (
                              <div key={user.id} className="flex items-center justify-between py-2 px-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold leading-tight text-white truncate">{user.name}</p>
                                    <p className="text-[10px] text-zinc-400 truncate">{user.handle}</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const willFollow = !user.isFollowing;
                                    setFollowingList(prev => prev.map(item => item.id === user.id ? { ...item, isFollowing: willFollow } : item));
                                    if (currentUserId) {
                                      try {
                                        if (willFollow) {
                                          await supabase.from('user_followers').insert([{ follower_id: currentUserId, following_id: user.id }]);
                                        } else {
                                          await supabase.from('user_followers').delete().eq('follower_id', currentUserId).eq('following_id', user.id);
                                        }
                                      } catch (err) {
                                        console.warn("Error toggling follow:", err);
                                      }
                                    }
                                  }}
                                  className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition shrink-0 cursor-pointer ${
                                    user.isFollowing
                                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow'
                                  }`}
                                >
                                  {user.isFollowing ? 'Unfollow' : 'Follow'}
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="py-6 text-center text-xs text-zinc-500 font-mono">No users followed</div>
                          )
                        )}

                        {activeModalTab === 'friends' && (
                          friendsList.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.handle.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                            friendsList.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.handle.toLowerCase().includes(searchQuery.toLowerCase())).map((friend) => (
                              <div key={friend.id} className="flex items-center justify-between py-2 px-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="relative shrink-0">
                                    <img src={friend.avatar} alt={friend.name} className="w-8 h-8 rounded-full object-cover" />
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-zinc-950 ${friend.isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold leading-tight text-white truncate">{friend.name}</p>
                                    <p className="text-[10px] text-zinc-400 truncate">{friend.handle}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsDropdownOpen(false);
                                      window.dispatchEvent(new CustomEvent('lounge-chat', { detail: { companionId: friend.id } }));
                                    }}
                                    className="bg-pink-600 hover:bg-pink-500 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold transition shadow cursor-pointer"
                                  >
                                    Message
                                  </button>
                                  <button 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setFriendsList(prev => prev.filter(item => item.id !== friend.id));
                                      if (currentUserId) {
                                        try {
                                          await supabase
                                            .from('connections')
                                            .delete()
                                            .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${friend.id}),and(requester_id.eq.${friend.id},addressee_id.eq.${currentUserId})`);
                                        } catch (err) {
                                          console.warn("Error removing friend connection:", err);
                                        }
                                      }
                                    }}
                                    title="Remove Connection"
                                    className="bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 text-[10px] px-1.5 py-1 rounded-lg border border-zinc-700 transition cursor-pointer"
                                  >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-6 text-center text-xs text-zinc-500 font-mono">No connections found</div>
                      )
                    )}
                      </>
                    )}
                  </div>
                </div>
              )}

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

        {/* 🔗 COPY SHARE LINK ACTION */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyShareLink();
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center border backdrop-blur-md active:scale-90 transition cursor-pointer shadow-md ${
              copied 
                ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-500/20' 
                : 'bg-black/30 text-white border-zinc-800/40 hover:text-pink-400 hover:bg-black/60'
            }`}
            title="Copy Share Link"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {copied ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
              )}
            </svg>
          </button>
          <span className="text-[9px] font-sans font-black uppercase tracking-widest text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {copied ? 'Copied' : 'Share'}
          </span>
        </div>

        {/* ✨ QUICK REACTION FLOATING ACTION BUTTON (FAB) */}
        <div className="flex flex-col items-center gap-0.5 relative z-40">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowReactionDock(!showReactionDock);
              // Trigger a default cute heart on click of the parent button too!
              addQuickReaction('❤️');
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center border backdrop-blur-md active:scale-90 transition cursor-pointer shadow-md ${
              showReactionDock 
                ? 'bg-pink-600 border-pink-400 text-white shadow-pink-500/20' 
                : 'bg-black/30 text-white border-zinc-800/40 hover:text-pink-400 hover:bg-black/60'
            }`}
            title="Send live reactions"
          >
            <span className="text-lg select-none animate-bounce" style={{ animationDuration: '2.5s' }}>💖</span>
          </button>
          <span className="text-[9px] font-sans font-black uppercase tracking-widest text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            React
          </span>

          {/* Elegant Horizontal Slider Dock for Quick reactions */}
          <AnimatePresence>
            {showReactionDock && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: -12, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 350, damping: 24 }}
                className="absolute right-14 top-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-md border border-zinc-800/80 rounded-full py-1.5 px-3 flex items-center gap-3 shadow-2xl z-50 whitespace-nowrap pointer-events-auto"
              >
                {['❤️', '🔥', '😂', '😮', '👏', '🎉'].map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.35, y: -2 }}
                    whileTap={{ scale: 0.8 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      addQuickReaction(emoji);
                    }}
                    className="text-xl p-1 filter hover:drop-shadow-[0_0_8px_rgba(236,72,153,0.8)] active:scale-95 transition-all duration-150 cursor-pointer select-none"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>



      </div>

      {/* ── 📝 LOWER METADATA DESCRIPTIVE PANEL (LEFT ALIGNED) ── */}
      <motion.div
        key={`${short.id}_${isActive}`}
        initial={{ opacity: 0, y: 35 }}
        animate={{ 
          opacity: (mediaLoading || !hasStartedPlaying) ? 0 : 1, 
          y: (mediaLoading || !hasStartedPlaying) ? 35 : 0 
        }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-4 bottom-6 right-24 z-30 pointer-events-auto flex flex-col gap-2 px-1 text-left select-none text-white"
      >
        {/* ── 1. HIDDEN METADATA (Revealed only when `isExpanded` is TRUE) ── */}
        {isExpanded && (
          <div className="flex flex-col gap-2 bg-zinc-950/85 backdrop-blur-md p-3 rounded-xl border border-yellow-500/20 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* LIVE & Viewer Count Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded tracking-wider uppercase animate-pulse">
                LIVE
              </span>
              <div className="flex items-center gap-1.5 bg-black/60 border border-zinc-800/80 px-2 py-0.5 rounded-full text-xs font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>👁️ {formatCountValue(views)}</span>
              </div>
              {isFollowing && (
                <span className="bg-zinc-800/80 border border-zinc-700/40 text-[9px] font-black px-2 py-0.5 rounded text-zinc-300 uppercase tracking-widest">
                  Following
                </span>
              )}
              {isExclusive && (
                <span className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                  Exclusive
                </span>
              )}
              {boosterMultiplier > 1 && (
                <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black text-[9px] px-2 py-0.5 rounded tracking-wider">
                  🔥 {boosterMultiplier}x Boost
                </span>
              )}
              {filterName && (
                <span className="bg-pink-500/15 border border-pink-500/25 text-pink-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase shrink-0">
                  ✨ {filterName}
                </span>
              )}
            </div>

            {/* Subtitle / Description */}
            <p className="text-pink-300 text-xs font-medium leading-relaxed">
              {displayCaption || short.profiles?.title || "Lounge Live Broadcaster"}
            </p>

            {/* Host Handle */}
            <p className="text-yellow-400 text-[11px] font-mono font-bold flex items-center gap-1">
              @{short.profiles?.username || 'companion'}
              {short.profiles?.is_verified && (
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-3.5 h-3.5 text-[#1d9bf0] fill-current shrink-0"
                  aria-label="Verified creator"
                >
                  <path d="M22.25 12c0-1.43-.88-2.67-2.15-3.21.15-.44.24-.91.24-1.4 0-2.2-1.72-4-3.83-4-.48 0-.94.1-1.35.27C14.56 2.39 13.38 1.5 12 1.5s-2.56.89-3.16 2.16c-.41-.17-.87-.27-1.35-.27-2.11 0-3.83 1.8-3.83 4 0 .49.09.96.24 1.4-1.27.54-2.15 1.78-2.15 3.21 0 1.43.88 2.67 2.15 3.21-.15.44-.24.91-.24 1.4 0 2.2 1.72 4 3.83 4 .48 0 .94-.1 1.35-.27.6 1.27 1.78 2.16 3.16 2.16s2.56-.89 3.16-2.16c.41.17.87.27 1.35.27 2.11 0 3.83-1.8 3.83-4 0-.49-.09-.96-.24-1.4 1.27-.54 2.15-1.78 2.15-3.21zm-12.5 4L6 12.25l1.5-1.5 2.25 2.25L16.25 6.5l1.5 1.5-8 8z" />
                </svg>
              )}
            </p>

            {/* Hashtags, Pinned Location & Soundtrack */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
              {(short.location || short.city || (short.caption && short.caption.includes('[location:'))) && (
                <span className="bg-pink-950/60 text-pink-300 font-medium px-2 py-0.5 rounded-full border border-pink-500/30 flex items-center gap-1 shadow-sm">
                  <MapPin className="w-2.5 h-2.5 text-pink-400 shrink-0" />
                  <span>
                    {short.location || short.city || (short.caption?.match(/\[location:(.*?)\]/)?.[1])}
                  </span>
                </span>
              )}
              <span className="bg-zinc-900/60 px-2 py-0.5 rounded-full border border-zinc-800/40">#lustyglobal</span>
              <span className="bg-zinc-900/60 px-2 py-0.5 rounded-full border border-zinc-800/40">#vip</span>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">
                <MusicIcon className="w-3 h-3 animate-spin" style={{ animationDuration: '6s' }} />
                <span className="truncate">Original Soundtrack</span>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. DEFAULT MINIMAL ROW (Main title + "more" / "less" button) ── */}
        <div className="flex items-center justify-between gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          <p className="text-sm md:text-base font-bold text-zinc-100 truncate max-w-[80%]">
            {displayCaption || short.title || "Wanna hangout with me!"}
          </p>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className="text-xs font-black tracking-wider text-white hover:text-yellow-400 underline underline-offset-2 transition-colors shrink-0 px-1 py-0.5 cursor-pointer"
          >
            {isExpanded ? 'less' : 'more'}
          </button>
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
            <div className="relative flex-1 flex items-center">
              {/* Floating Mog Reaction Container */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none h-20 w-full flex justify-center items-end overflow-visible z-50">
                <AnimatePresence>
                  {commentMogList.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 1, y: 0, x: item.x, scale: 0.6, rotate: 0 }}
                      animate={{
                        opacity: 0,
                        y: -60,
                        scale: 1.5,
                        rotate: item.rotation,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      onAnimationComplete={() => removeCommentMog(item.id)}
                      className="absolute text-2xl select-none filter drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                    >
                      {item.emoji}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <input 
                type="text" 
                placeholder="Say something live..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <button 
              type="submit" 
              className="bg-pink-500 hover:bg-pink-600 text-white font-black text-[10px] uppercase tracking-wider px-4 rounded-xl transition cursor-pointer"
            >
              Post
            </button>
          </form>
        </div>
      )}

      {/* 🚀 PRE-DEBIT CONFIRMATION MODAL POPUP FOR BOOST */}
      {showBoostConfirmModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              disabled={isBoostingPost}
              onClick={() => setShowBoostConfirmModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-zinc-900 border border-zinc-800 cursor-pointer"
            >
              ✕
            </button>

            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 text-lg">
              🚀
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-100 uppercase tracking-wider font-mono">
                Confirm 7-Day Campaign Boost
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Push your video to the top of top feed loops for 7 days.
              </p>
            </div>

            <div className="bg-zinc-900/90 rounded-2xl p-4 border border-zinc-800 text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Target Broadcast:</span>
                <span className="text-zinc-200 font-bold truncate max-w-[150px]">
                  {short.title || short.caption || "Current Loop"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Boost Duration:</span>
                <span className="text-amber-400 font-bold">7 Days Priority Placement</span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Payment Method:</span>
                <span className="text-zinc-300 font-mono">Card on File</span>
              </div>
              <div className="border-t border-zinc-800 pt-2.5 flex justify-between items-center text-sm font-black text-white">
                <span>Total Debit Amount:</span>
                <span className="text-emerald-400 font-mono text-base">$50.00 USD</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-tight">
              Clicking confirm will charge your linked card <strong className="text-zinc-300">$50.00</strong> to feature this video at the top of feed loops for 7 days.
            </p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={isBoostingPost}
                onClick={() => setShowBoostConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBoostingPost}
                onClick={handleConfirmAndPayBoost}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {isBoostingPost ? 'Debiting Card...' : 'Confirm & Pay $50.00'}
              </button>
            </div>
          </div>
        </div>,
        document.body
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
                handleCopyShareLink();
              }}
              className="w-full text-left px-2 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
              </svg>
              <span>Copy Share Link</span>
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

      {/* ── 📏 Interactive Playback Progress Bar with Hover Scrubbing ── */}
      <div 
        ref={progressContainerRef}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleScrubStart(e.clientX);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (e.touches[0]) {
            handleScrubStart(e.touches[0].clientX);
          }
        }}
        className="absolute bottom-0 left-0 right-0 h-4 bg-transparent hover:h-6 flex items-end pb-1 cursor-pointer z-30 group/scrub select-none transition-all duration-200"
      >
        <div className="w-full h-1 bg-zinc-800/50 relative group-hover/scrub:h-2 transition-all duration-200">
          {/* Progress Bar Active Fill */}
          <div 
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-pink-500 to-rose-400 rounded-r shadow-sm transition-[width] duration-75 ease-out"
            style={{ width: `${playbackProgress}%` }}
          />

          {/* Glowing Scrubbing Knob/Handle */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] opacity-0 group-hover/scrub:opacity-100 transition-opacity duration-150 pointer-events-none"
            style={{ left: `calc(${playbackProgress}% - 7px)` }}
          />

          {/* Time Display Hovering Tooltip Badge */}
          <div 
            className="absolute bottom-4 bg-black/95 border border-zinc-800/80 text-[10px] text-zinc-100 font-mono font-black tracking-tight px-2 py-0.5 rounded-md shadow-2xl backdrop-blur-md opacity-0 group-hover/scrub:opacity-100 transition-opacity duration-200 pointer-events-none flex items-center gap-1.5 whitespace-nowrap"
            style={{ 
              left: `${Math.max(10, Math.min(playbackProgress, 90))}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <span className="text-pink-400 font-bold">{formatTime(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{formatTime(duration)}</span>
          </div>
        </div>
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

export const LoungeShortsPlayer = React.memo(
  LoungeShortsPlayerComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.short?.id === nextProps.short?.id &&
      prevProps.short?.video_url === nextProps.short?.video_url &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.isNext === nextProps.isNext &&
      prevProps.isMuted === nextProps.isMuted &&
      prevProps.currentUserId === nextProps.currentUserId
    );
  }
);
