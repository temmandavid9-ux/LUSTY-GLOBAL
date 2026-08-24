import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { LoungeShortsPlayer } from './LoungeShortsPlayer';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Eye, Heart, Sparkles, ArrowLeft, MoveDown, MapPin, Search, ChevronDown, Globe, X } from 'lucide-react';
import { VIDEOS, COMPANIONS } from '../data';
import { formatMetricCount } from '../utils/formatMetrics';
import { getSafeVideoUrl } from '../utils/videoUtils';

// 🧠 THE INTERLEAVE MIX ENGINE: Group by Host to alternate creators sequentially
function interleaveVideos(videos: any[]): any[] {
  if (!videos || videos.length === 0) return [];
  
  const groups: { [key: string]: any[] } = {};
  videos.forEach(video => {
    const hostKey = video.host_id || 'unknown_host';
    if (!groups[hostKey]) {
      groups[hostKey] = [];
    }
    groups[hostKey].push(video);
  });

  const mixedFeed: any[] = [];
  let hasMore = true;
  let pass = 0;

  while (hasMore) {
    hasMore = false;
    for (const hostId in groups) {
      if (groups[hostId][pass]) {
        mixedFeed.push(groups[hostId][pass]);
        hasMore = true;
      }
    }
    pass++;
  }

  return mixedFeed;
}

interface ShortsFeedProps {
  currentUserId?: string;
  onActiveVideoChange?: (video: any) => void;
  onShortsLoaded?: (shorts: any[]) => void;
  preloadedVideoIds?: Record<string | number, boolean>;
  onActiveVideoProgress?: (currentIndex: number, currentVideoId: string | number, progressPercent: number, nextVideoId: string | number | null) => void;
}

// 👁️ DYNAMIC REAL-TIME VIEWS BADGE WITH SCALE FLICKER & INCREMENT FLASH
function RealtimeViewBadge({ views }: { views: number }) {
  const [prevViews, setPrevViews] = useState(views);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    let timer: any = null;
    if (views > prevViews) {
      setAnimate(true);
      timer = setTimeout(() => setAnimate(false), 800);
      setPrevViews(views);
    } else if (views < prevViews) {
      setPrevViews(views);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [views, prevViews]);

  return (
    <motion.span 
      animate={animate ? { 
        scale: [1, 1.25, 1], 
        backgroundColor: ['rgba(0,0,0,0.7)', 'rgba(16,185,129,0.35)', 'rgba(0,0,0,0.7)'],
        borderColor: ['rgba(39,39,42,0.4)', 'rgba(16,185,129,0.6)', 'rgba(39,39,42,0.4)']
      } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-black/70 backdrop-blur-md border border-zinc-800/40 text-[9px] font-mono px-2 py-0.5 rounded-full text-emerald-400 flex items-center gap-1 shadow-md font-bold relative"
    >
      <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ${animate ? 'animate-ping' : 'animate-pulse'}`} />
      <span>{formatMetricCount(views)}</span>
      
      {/* Dynamic floating increment bubble */}
      <AnimatePresence>
        {animate && (
          <motion.span
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -16, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute -top-3.5 right-1.5 text-[9px] text-emerald-400 font-black pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          >
            +{views - prevViews}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
}

export function LoungeShortsFeed({ 
  currentUserId, 
  onActiveVideoChange, 
  onShortsLoaded,
  preloadedVideoIds,
  onActiveVideoProgress
}: ShortsFeedProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'player'>('grid');
  const [activeVideoId, setActiveVideoId] = useState<string | number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFeedMuted, setIsFeedMuted] = useState(true);

  // 📍 Location Filtering & Pinned Cities State
  const [feedFilter, setFeedFilter] = useState<'all' | 'local' | 'boosted'>('all');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [citySearchTerm, setCitySearchTerm] = useState<string>('');
  const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false);

  const handleMuteToggle = useCallback(() => {
    setIsFeedMuted(prev => !prev);
  }, []);

  useEffect(() => {
    const fetchAllFeedData = async () => {
      // Helper function to dynamically construct high-quality, highly compatible local fallback assets
      const getStaticFallbackFeed = () => {
        return VIDEOS.map((video: any) => {
          const companion = COMPANIONS.find(c => c.id === video.creatorId) || COMPANIONS[0];
          return {
            id: video.id,
            video_url: video.videoUrl,
            thumbnail_url: companion.avatar,
            caption: video.caption,
            content_type: 'video/mp4',
            created_at: new Date().toISOString(),
            host_id: video.creatorId,
            views_count: video.views,
            likes_count: video.likes,
            hasUserLiked: video.isLiked,
            location: video.location || companion.location || 'London, Mayfair',
            city: video.city || companion.location?.split(',')[0] || 'London',
            stableUsername: companion.username,
            stableAvatarUrl: companion.avatar,
            stableIsVerified: companion.isVIP,
            profiles: {
              username: companion.username,
              avatar_url: companion.avatar,
              is_verified: companion.isVIP,
              title: companion.bio || 'Lounge Live Broadcaster',
              location: companion.location
            }
          };
        });
      };

      try {
        const { data: authData } = await supabase.auth.getUser();
        const currentUid = authData?.user?.id || currentUserId || '00000000-0000-0000-0000-000000000000';

        // 🚀 Fetch active boosted campaigns directly from lounge_shorts
        let boostedShortIds: string[] = [];
        try {
          const { data: boostedShorts } = await supabase
            .from('lounge_shorts')
            .select('id, is_boosted, boost_expires_at')
            .eq('is_boosted', true);
          if (boostedShorts) {
            const now = Date.now();
            boostedShortIds = boostedShorts
              .filter((s: any) => {
                if (!s.is_boosted) return false;
                if (!s.boost_expires_at) return true; // Legacy fallback
                return new Date(s.boost_expires_at).getTime() > now;
              })
              .map((s: any) => s.id)
              .filter(Boolean);
          }
        } catch (err) {
          console.warn("Could not query lounge_shorts for boosted status directly:", err);
        }

        const { data, error } = await supabase
          .from('lounge_shorts')
          .select(`
            id,
            video_url,
            thumbnail_url,
            caption,
            content_type,
            created_at,
            host_id,
            views_count,
            likes_count,
            is_boosted,
            boost_expires_at,
            location,
            city,
            profiles:host_id ( username, avatar_url, is_verified, title, location ),
            lounge_short_likes ( id, user_id ),
            short_likes ( id, user_id )
          `)
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          const mapped = data.map((post: any) => {
            const rawProfile = post.profiles;
            const profileObj = Array.isArray(rawProfile) ? (rawProfile[0] || {}) : (rawProfile || {});

            const loungeLikes = post.lounge_short_likes || [];
            const shortLikes = post.short_likes || [];
            const hasUserLiked = loungeLikes.some((l: any) => l.user_id === currentUid) || shortLikes.some((l: any) => l.user_id === currentUid);

            const views = post.views_count !== undefined && post.views_count !== null 
              ? post.views_count 
              : (post.views || 0);

            // Dynamically count likes from the like tables if rows are present, fallback to database likes_count
            const dbLikesCount = Math.max(loungeLikes.length, shortLikes.length);
            const likes = dbLikesCount > 0 
              ? dbLikesCount 
              : (post.likes_count !== undefined && post.likes_count !== null 
                  ? post.likes_count 
                  : (post.likes || 0));

            // Extract location metadata
            let postLoc = post.location || post.city || profileObj.location || '';
            if (!postLoc && post.caption && post.caption.includes('[location:')) {
              const match = post.caption.match(/\[location:(.*?)\]/);
              if (match && match[1]) {
                postLoc = match[1].trim();
              }
            }
            if (!postLoc) {
              const comp = COMPANIONS.find(c => c.username === profileObj.username || c.id === post.host_id);
              postLoc = comp?.location || 'London, Mayfair';
            }

            return {
              ...post,
              user_id: post.host_id,
              hasUserLiked,
              views_count: Number(views),
              likes_count: Number(likes),
              location: postLoc,
              city: post.city || postLoc.split(',')[0],
              stableUsername: profileObj.username || 'lounge_member',
              stableAvatarUrl: profileObj.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              stableIsVerified: !!profileObj.is_verified,
              profiles: {
                username: profileObj.username || 'lounge_member',
                avatar_url: profileObj.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                is_verified: !!profileObj.is_verified,
                title: profileObj.title || 'Lounge Live Broadcaster',
                location: profileObj.location
              }
            };
          }).filter((item: any) => {
            const hasVideoUrl = !!item.video_url;
            const isNotTest = !(
              (item.caption && item.caption.toLowerCase().includes('test')) || 
              (item.title && item.title.toLowerCase().includes('test')) ||
              (item.description && item.description.toLowerCase().includes('test')) ||
              (item.stableUsername && item.stableUsername.toLowerCase().includes('test')) ||
              (item.stableUsername === 'rls deletion test')
            );
            return hasVideoUrl && isNotTest;
          });
          // 🎲 SHUFFLE ALGORITHM: Randomize the array order to keep the feed unexpected and fresh on every load
          const randomizedMapped = [...mapped].sort(() => Math.random() - 0.5);
          const mixed = interleaveVideos(randomizedMapped);

          // 🚀 Prioritize active boosted clips at the top of the feed matrix
          let finalMixed = mixed;
          if (boostedShortIds.length > 0) {
            const boostedSet = new Set(boostedShortIds);
            const boostedVideos = mixed.filter(p => boostedSet.has(p.id));
            const regularVideos = mixed.filter(p => !boostedSet.has(p.id));
            finalMixed = [...boostedVideos, ...regularVideos];
          }

          if (finalMixed.length === 0) {
            console.warn("⚠️ Database query returned zero filtered lounge shorts. Loading static fallback assets...");
            finalMixed = getStaticFallbackFeed();
          }

          setPosts(finalMixed);
          if (finalMixed.length > 0) {
            setActiveVideoId(finalMixed[0].id);
          }
          // 💾 Save a backup copy to memory cache if online fetch succeeds
          localStorage.setItem('cached_lounge_feed', JSON.stringify(finalMixed));
        } else if (error) {
          console.warn("Failed to fetch with host_id relation, trying flat fallback with separate profile query", error);
          const { data: fallbackData } = await supabase
            .from('lounge_shorts')
            .select(`
              *,
              lounge_short_likes ( id, user_id ),
              short_likes ( id, user_id )
            `)
            .order('created_at', { ascending: false });

          if (fallbackData) {
            // Fetch profiles manually for each creator
            const creatorIds = Array.from(new Set(fallbackData.map((post: any) => post.host_id || post.user_id).filter(Boolean)));
            const profilesMap: { [key: string]: any } = {};

            if (creatorIds.length > 0) {
              const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, is_verified, title')
                .in('id', creatorIds);
              
              if (profilesData) {
                profilesData.forEach((p: any) => {
                  profilesMap[p.id] = p;
                });
              }
            }

            const mapped = fallbackData.map((post: any) => {
              const creatorId = post.host_id || post.user_id;
              const profileObj = profilesMap[creatorId] || {};

              const loungeLikes = post.lounge_short_likes || [];
              const shortLikes = post.short_likes || [];
              const hasUserLiked = loungeLikes.some((l: any) => l.user_id === currentUid) || shortLikes.some((l: any) => l.user_id === currentUid);

              const views = post.views_count !== undefined && post.views_count !== null 
                ? post.views_count 
                : (post.views || 0);

              // Dynamically count likes from the like tables if rows are present, fallback to database likes_count
              const dbLikesCount = Math.max(loungeLikes.length, shortLikes.length);
              const likes = dbLikesCount > 0 
                ? dbLikesCount 
                : (post.likes_count !== undefined && post.likes_count !== null 
                    ? post.likes_count 
                    : (post.likes || 0));

              return {
                ...post,
                user_id: creatorId,
                hasUserLiked,
                views_count: Number(views),
                likes_count: Number(likes),
                stableUsername: profileObj.username || 'lounge_member',
                stableAvatarUrl: profileObj.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                stableIsVerified: !!profileObj.is_verified,
                profiles: {
                  username: profileObj.username || 'lounge_member',
                  avatar_url: profileObj.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                  is_verified: !!profileObj.is_verified,
                  title: profileObj.title || 'Lounge Live Broadcaster'
                }
              };
            }).filter((item: any) => {
              const hasVideoUrl = !!item.video_url;
              const isNotTest = !(
                (item.caption && item.caption.toLowerCase().includes('test')) || 
                (item.title && item.title.toLowerCase().includes('test')) ||
                (item.description && item.description.toLowerCase().includes('test'))
              );
              return hasVideoUrl && isNotTest;
            });
            // 🎲 SHUFFLE ALGORITHM: Randomize the array order to keep the feed unexpected and fresh on every load
            const randomizedMapped = [...mapped].sort(() => Math.random() - 0.5);
            const mixed = interleaveVideos(randomizedMapped);

            // 🚀 Prioritize active boosted clips at the top of the feed matrix
            let finalMixed = mixed;
            if (boostedShortIds.length > 0) {
              const boostedSet = new Set(boostedShortIds);
              const boostedVideos = mixed.filter(p => boostedSet.has(p.id));
              const regularVideos = mixed.filter(p => !boostedSet.has(p.id));
              finalMixed = [...boostedVideos, ...regularVideos];
            }

            if (finalMixed.length === 0) {
              console.warn("⚠️ Fallback database query returned zero filtered lounge shorts. Loading static fallback assets...");
              finalMixed = getStaticFallbackFeed();
            }

            setPosts(finalMixed);
            if (finalMixed.length > 0) {
              setActiveVideoId(finalMixed[0].id);
            }
            // 💾 Save a backup copy to memory cache if online fetch succeeds
            localStorage.setItem('cached_lounge_feed', JSON.stringify(finalMixed));
          } else {
            console.warn("⚠️ Fallback query had no data. Loading static fallback assets...");
            const finalFallback = getStaticFallbackFeed();
            setPosts(finalFallback);
            if (finalFallback.length > 0) {
              setActiveVideoId(finalFallback[0].id);
            }
            localStorage.setItem('cached_lounge_feed', JSON.stringify(finalFallback));
          }
        }
      } catch (err) {
        console.error("Critical error in fetchAllFeedData:", err);
        console.warn("Network issue detected. Falling back to offline media cache...");
        
        // 🔌 Fallback: Load the previous session loops if offline
        const offlineBackup = localStorage.getItem('cached_lounge_feed');
        if (offlineBackup) {
          try {
            const parsed = JSON.parse(offlineBackup);
            setPosts(parsed);
            if (parsed.length > 0) {
              setActiveVideoId(parsed[0].id);
            }
          } catch (e) {
            console.error("Error parsing cached feed, loading static fallback:", e);
            const finalFallback = getStaticFallbackFeed();
            setPosts(finalFallback);
            if (finalFallback.length > 0) {
              setActiveVideoId(finalFallback[0].id);
            }
          }
        } else {
          console.warn("⚠️ No offline backup found in localStorage. Seeding with high-quality static assets...");
          const finalFallback = getStaticFallbackFeed();
          setPosts(finalFallback);
          if (finalFallback.length > 0) {
            setActiveVideoId(finalFallback[0].id);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAllFeedData();
  }, [currentUserId]);

  // 📡 Realtime sync for views and likes updates
  useEffect(() => {
    const shortsSubscription = supabase
      .channel('shorts-changes-feed')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lounge_shorts' },
        (payload) => {
          console.log("🔥 Real-time update to lounge_shorts detected:", payload.new);
          setPosts((currentVideos) =>
            currentVideos.map((video) => {
              if (video.id === payload.new.id) {
                // Keep existing relationships intact but update metric counters
                return {
                  ...video,
                  views_count: payload.new.views_count !== undefined ? Number(payload.new.views_count) : video.views_count,
                  likes_count: payload.new.likes_count !== undefined ? Number(payload.new.likes_count) : video.likes_count,
                  // Also handle legacy or backup column names
                  views: payload.new.views !== undefined ? Number(payload.new.views) : video.views,
                  likes: payload.new.likes !== undefined ? Number(payload.new.likes) : video.likes,
                };
              }
              return video;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shortsSubscription);
    };
  }, []);

  // Propagate shorts loaded back to parent safely using useRef to break the infinite render loop
  const onShortsLoadedRef = useRef(onShortsLoaded);
  const onActiveVideoChangeRef = useRef(onActiveVideoChange);

  useEffect(() => {
    onShortsLoadedRef.current = onShortsLoaded;
  }, [onShortsLoaded]);

  useEffect(() => {
    onActiveVideoChangeRef.current = onActiveVideoChange;
  }, [onActiveVideoChange]);

  useEffect(() => {
    if (posts.length > 0) {
      onShortsLoadedRef.current?.(posts);
    }
  }, [posts]);

  // Propagate active video changes to parent
  useEffect(() => {
    if (activeVideoId) {
      const activePost = posts.find(p => p.id === activeVideoId);
      if (activePost) {
        onActiveVideoChangeRef.current?.(activePost);
      }
    }
  }, [activeVideoId, posts]);

  // Handle snapping layout scroll offsets
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const height = container.clientHeight;
    if (height === 0) return;
    const scrollTop = container.scrollTop;
    const index = Math.round(scrollTop / height);
    if (index >= 0 && index < posts.length) {
      const activePost = posts[index];
      if (activePost && activePost.id !== activeVideoId) {
        setActiveVideoId(activePost.id);
      }
    }
  };

  // 📡 Sync active video scrolling offset when player is loaded
  useEffect(() => {
    let timer: any = null;
    if (viewMode === 'player' && activeVideoId && containerRef.current) {
      const index = posts.findIndex(p => p.id === activeVideoId);
      if (index !== -1) {
        const height = containerRef.current.clientHeight;
        if (height > 0) {
          containerRef.current.scrollTop = index * height;
        } else {
          timer = setTimeout(() => {
            if (containerRef.current) {
              const h = containerRef.current.clientHeight;
              containerRef.current.scrollTop = index * h;
            }
          }, 60);
        }
      }
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [viewMode, activeVideoId, posts]);

  // 📍 Dynamically extract pinned cities in database posts
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    posts.forEach(p => {
      if (p.location) {
        set.add(p.location.trim());
        const mainCity = p.location.split(',')[0].trim();
        if (mainCity) set.add(mainCity);
      }
    });
    // Add popular default pinned cities in database
    ['London', 'Miami', 'Paris', 'Dubai', 'New York', 'Los Angeles', 'Tokyo', 'Las Vegas', 'Ibiza', 'Amsterdam'].forEach(c => set.add(c));
    return Array.from(set).sort();
  }, [posts]);

  // Count videos per city
  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => {
      const pLoc = (p.location || '').toLowerCase();
      availableCities.forEach(c => {
        if (pLoc.includes(c.toLowerCase())) {
          counts[c] = (counts[c] || 0) + 1;
        }
      });
    });
    return counts;
  }, [posts, availableCities]);

  // Filter posts by active tab and selected city
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (feedFilter === 'boosted') {
        if (!post.is_boosted && !post.has_active_boost && !post.boost_active) return false;
      }
      if (feedFilter === 'local' || selectedCity !== 'All') {
        if (selectedCity !== 'All') {
          const postLoc = (post.location || post.city || '').toLowerCase();
          const target = selectedCity.toLowerCase();
          if (!postLoc.includes(target)) return false;
        }
      }
      return true;
    });
  }, [posts, feedFilter, selectedCity]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Synchronizing Feed Channels...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#07090e] relative flex flex-col">
      {posts.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
          <p className="text-zinc-600 font-mono text-xs mb-2">No active lounge streams found...</p>
          <p className="text-zinc-700 font-sans text-xs">Verify your broadcasting status in the studio console to register a clip.</p>
        </div>
      ) : (
        <>
          {/* ── 📱 GRID MODE (DEFAULT LIST VIEW OVERVIEW) ── */}
          {viewMode === 'grid' && (
            <div className="w-full h-full overflow-y-auto pt-24 pb-28 px-4 bg-[#07090e] no-scrollbar">
              
              {/* Header Title Bar */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                    Live Lounge Broadcasts
                  </h2>
                  <p className="text-[9px] text-zinc-500 font-mono uppercase mt-0.5">Instant sequential creator loops</p>
                </div>
                
                <div className="bg-zinc-900/50 px-2.5 py-1 rounded-xl border border-zinc-800/40 flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {filteredPosts.length} LOOPS LIVE
                </div>
              </div>

              {/* ── 📍 FEED FILTER & LOCAL CITY SEARCH SYSTEM TOOLBAR ── */}
              <div className="mb-6 bg-zinc-950/80 p-3 rounded-2xl border border-zinc-900/80 backdrop-blur-md space-y-3">
                {/* Feed Navigation Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => { setFeedFilter('all'); setSelectedCity('All'); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
                        feedFilter === 'all' && selectedCity === 'All'
                          ? 'bg-pink-500 text-white shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>All Broadcasts</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFeedFilter('local'); if (selectedCity === 'All') setSelectedCity('London'); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
                        feedFilter === 'local' || selectedCity !== 'All'
                          ? 'bg-pink-500 text-white shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-pink-300" />
                      <span>Local Feed</span>
                      {selectedCity !== 'All' && (
                        <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-mono">
                          {selectedCity.split(',')[0]}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFeedFilter('boosted'); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
                        feedFilter === 'boosted'
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>VIP Boosted</span>
                    </button>
                  </div>

                  {/* Location Search / Pinned Cities Dropdown Toggle */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-pink-500/50 text-xs px-3 py-1.5 rounded-xl text-zinc-200 flex items-center gap-2 transition cursor-pointer font-medium select-none"
                    >
                      <MapPin className="w-3.5 h-3.5 text-pink-500" />
                      <span>{selectedCity === 'All' ? 'Filter Pinned City' : `📍 ${selectedCity}`}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    </button>

                    {/* Dropdown Menu & Location Search Input */}
                    {showLocationDropdown && (
                      <div className="absolute right-0 mt-2 w-72 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                        {/* Location-search input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Search city (e.g. London, Miami, Paris)..."
                            value={citySearchTerm}
                            onChange={(e) => setCitySearchTerm(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-xs pl-8 pr-3 py-1.5 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
                          />
                          {citySearchTerm && (
                            <button
                              type="button"
                              onClick={() => setCitySearchTerm('')}
                              className="absolute right-2 top-2 text-zinc-500 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* List of Pinned Cities from database */}
                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1 no-scrollbar">
                          <button
                            type="button"
                            onClick={() => { setSelectedCity('All'); setFeedFilter('all'); setShowLocationDropdown(false); }}
                            className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                              selectedCity === 'All' ? 'bg-pink-500/20 text-pink-400 font-bold border border-pink-500/30' : 'text-zinc-300 hover:bg-zinc-900'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Globe className="w-3 h-3 text-zinc-400" />
                              <span>All Pinned Cities</span>
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">{posts.length}</span>
                          </button>

                          {availableCities
                            .filter(city => city.toLowerCase().includes(citySearchTerm.toLowerCase()))
                            .map(city => {
                              const count = cityCounts[city] || 0;
                              const isSelected = selectedCity.toLowerCase() === city.toLowerCase();
                              return (
                                <button
                                  key={city}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCity(city);
                                    setFeedFilter('local');
                                    setShowLocationDropdown(false);
                                  }}
                                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                                    isSelected ? 'bg-pink-500/20 text-pink-400 font-bold border border-pink-500/30' : 'text-zinc-300 hover:bg-zinc-900'
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5 truncate">
                                    <MapPin className="w-3 h-3 text-pink-500 shrink-0" />
                                    <span className="truncate">{city}</span>
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">{count}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Filter Indicator Tag */}
                {selectedCity !== 'All' && (
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-900 text-xs">
                    <span className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5">
                      <span>Local Feed Pinned City:</span>
                      <strong className="text-pink-400 font-bold flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-pink-500" />
                        {selectedCity}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setSelectedCity('All'); setFeedFilter('all'); }}
                      className="text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-2 py-0.5 rounded-full border border-zinc-800 transition cursor-pointer"
                    >
                      ✕ Reset Filter
                    </button>
                  </div>
                )}
              </div>

              {/* Filtered Empty State */}
              {filteredPosts.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-zinc-950/40 rounded-2xl border border-zinc-900">
                  <MapPin className="w-8 h-8 text-pink-500/40 mx-auto animate-bounce" />
                  <p className="text-zinc-400 font-medium text-xs">No broadcast loops found pinned to "{selectedCity}"</p>
                  <button
                    type="button"
                    onClick={() => { setSelectedCity('All'); setFeedFilter('all'); }}
                    className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg"
                  >
                    View All Pinned Cities
                  </button>
                </div>
              ) : (
                /* Responsive Feed Matrix Grid */
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3.5">
                  {filteredPosts.map((post) => {
                    const views = post.views_count !== undefined ? post.views_count : (post.views || 0);
                    const likes = post.likes_count !== undefined ? post.likes_count : (post.likes || 0);
                    const isBoosted = post.has_active_boost || post.boost_active || false;
                    const isHostVerified = post.stableIsVerified || post.profiles?.is_verified || false;

                    return (
                      <div 
                        key={post.id} 
                        id={`broadcast-grid-item-${post.id}`}
                        onClick={() => {
                          setActiveVideoId(post.id);
                          setViewMode('player');
                        }}
                        className="relative aspect-[9/16] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-900/60 group cursor-pointer hover:border-pink-500/40 hover:shadow-[0_0_15px_rgba(236,72,153,0.12)] transition-all duration-300 flex flex-col justify-end"
                      >
                        {/* Thumbnail Cover Image or Video Preload Fallback */}
                        {post.thumbnail_url && !post.thumbnail_url.includes('images.unsplash.com') ? (
                          <img 
                            src={post.thumbnail_url} 
                            alt={post.caption || 'Live Broadcast'} 
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 z-0"
                          />
                        ) : (
                          <video 
                            src={getSafeVideoUrl(post.video_url)} 
                            preload="auto"
                            autoPlay
                            loop
                            muted
                            playsInline
                            crossOrigin="anonymous"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 z-0"
                          />
                        )}

                        {/* Dark Vignette Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

                        {/* Top Badges */}
                        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
                          <span className="bg-pink-600 text-[8px] font-black px-1.5 py-0.5 rounded text-white uppercase tracking-widest shadow flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                            LIVE
                          </span>
                          {isBoosted && (
                            <span className="bg-gradient-to-r from-amber-500 to-pink-500 text-white font-mono text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
                              <Sparkles className="w-2 h-2 fill-white shrink-0" />
                              BOOSTED
                            </span>
                          )}
                        </div>

                        {/* 👁️ Real-time View Count Badge at top-right */}
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <RealtimeViewBadge views={views} />
                        </div>

                        {/* Play Hover Overlay Icon */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-black/15">
                          <div className="w-10 h-10 rounded-full bg-pink-500/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* Bottom Metadata */}
                        <div className="relative p-3 z-10 space-y-1 text-left">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-pink-400 font-mono font-bold tracking-tight block">
                              @{post.stableUsername || 'companion'}
                            </span>
                            
                            {/* Sleek Blue Checkmark Badge */}
                            {isHostVerified && (
                              <span 
                                className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-blue-500 text-white text-[7px] font-extrabold shadow-md shrink-0"
                                title="Verified Host"
                              >
                                ✓
                              </span>
                            )}

                            {/* VIP Crown Accent */}
                            {isHostVerified && (
                              <span className="text-[9px] shrink-0" title="Verified VIP Host">👑</span>
                            )}
                          </div>

                          {/* 📍 Pinned City Location Badge */}
                          {post.location && (
                            <div className="text-[8px] text-pink-300 font-mono flex items-center gap-0.5 truncate bg-black/60 px-1.5 py-0.5 rounded border border-pink-500/20 max-w-full">
                              <MapPin className="w-2.5 h-2.5 text-pink-400 shrink-0" />
                              <span className="truncate">{post.location}</span>
                            </div>
                          )}

                          <p className="text-[10px] text-zinc-100 leading-snug font-medium line-clamp-1">
                            {post.caption || 'Live Broadcast Room'}
                          </p>

                          <div className="flex items-center justify-between text-[9px] text-zinc-400 font-mono bg-black/50 backdrop-blur-sm p-1 px-1.5 rounded-lg border border-zinc-800/30">
                            <div className="flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5 text-zinc-500" />
                              <span>{formatMetricCount(views)}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Heart className="w-2.5 h-2.5 text-pink-500 fill-pink-500/20" />
                              <span>{formatMetricCount(likes)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 📱 ACTIVE FULLSCREEN PLAYER OVERLAY WITH SWIPE-TO-DISMISS ── */}
          <AnimatePresence mode="wait">
            {viewMode === 'player' && (
              <motion.div
                key="lounge-player-overlay"
                id="lounge-player-dismiss-overlay"
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.85 }}
                onDragEnd={(_event, info) => {
                  // Drag down by more than 120px, or vertical slide speed is high, trigger dismiss action
                  if (info.offset.y > 120 || info.velocity.y > 350) {
                    setViewMode('grid');
                  }
                }}
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="absolute inset-0 z-50 bg-black flex flex-col justify-end pointer-events-auto"
              >
                {/* ── DRAG TO DISMISS TOP PILL HANDLE HEADER ── */}
                <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-50 flex flex-col items-center justify-center pointer-events-none select-none">
                  <div className="w-12 h-1 bg-zinc-700/70 rounded-full mb-1" />
                  <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1 select-none">
                    <MoveDown className="w-2 h-2 text-pink-500 animate-bounce" />
                    Swipe down to return to feed
                  </span>
                </div>

                {/* Return Button for Desktop or non-touch fallback */}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('grid');
                  }}
                  className="absolute top-4 left-4 z-50 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-zinc-800/40 text-white flex items-center justify-center hover:bg-zinc-950 hover:text-pink-400 transition-all cursor-pointer shadow-lg"
                  title="Return to feed grid"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                {/* Vertical Loop Snapping Video Feed List */}
                <div 
                  ref={containerRef}
                  onScroll={handleScroll}
                  className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
                >
                  {filteredPosts.map((post, index) => {
                    const activeIndex = filteredPosts.findIndex(p => p.id === activeVideoId);
                    // Flag next TWO videos in the queue for background prefetching
                    const isNextItemInList = index === activeIndex + 1 || index === activeIndex + 2;
                    const isPreloadedByProgress = preloadedVideoIds && !!preloadedVideoIds[post.id];
                    const isNext = (isNextItemInList || isPreloadedByProgress) && viewMode === 'player';
                    const nextPost = activeIndex !== -1 ? filteredPosts[activeIndex + 1] : null;
                    const nextVideoId = nextPost ? nextPost.id : null;
                    return (
                      <div key={post.id} className="w-full h-full snap-start relative bg-black flex flex-col justify-end">
                        {/* 🚀 Preload link tag for the NEXT video in line for instant swipe buffering */}
                        {isNext && post.video_url && (
                          <link rel="preload" as="video" href={post.video_url} />
                        )}
                        <LoungeShortsPlayer 
                          short={post} 
                          currentUserId={currentUserId || 'anonymous_lounge_guest'} 
                          isActive={post.id === activeVideoId && viewMode === 'player'}
                          isNext={isNext && viewMode === 'player'}
                          isMuted={isFeedMuted}
                          onMuteToggle={handleMuteToggle}
                          onProgress={(percent) => {
                            if (post.id === activeVideoId && onActiveVideoProgress) {
                              onActiveVideoProgress(index, post.id, percent, nextVideoId);
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
