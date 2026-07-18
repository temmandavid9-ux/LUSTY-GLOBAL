import { useState, useEffect, useMemo } from 'react';
import { COMPANIONS } from '../data';
import { supabase } from '../lib/supabase';
import { Search, Loader2, Heart, Mic, MicOff } from 'lucide-react';
import { Companion, Booking } from '../types';
import { CompanionDirectoryCard } from './CompanionDirectoryCard';
import { calculateDistanceInMiles } from '../utils/geo';

interface DirectoryViewProps {
  onStartChat: (companionId: string) => void;
  currentUser: { id: string; username: string; avatar: string } | null;
  onWalletDeduction: (amount: number) => void;
  onAddBooking: (booking: Booking) => void;
}

export default function DirectoryView({ 
  onStartChat, 
  currentUser,
  onWalletDeduction,
  onAddBooking
}: DirectoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);

  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      setIsSpeechSupported(true);
      const rec = new SpeechRecognitionClass();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setSpeechStatus('Listening...');
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const cleaned = transcript.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
          setSearchTerm(cleaned);
          setSpeechStatus(`Search: "${cleaned}"`);
          setTimeout(() => setSpeechStatus(null), 3500);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechStatus('Blocked');
        } else {
          setSpeechStatus('Error');
        }
        setTimeout(() => setSpeechStatus(null), 3000);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const handleMicClick = () => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech:', err);
      }
    }
  };
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'top_rated' | 'closest'>('newest');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [activityStatus, setActivityStatus] = useState<string>('all');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number }>({
    lat: 51.5074,
    lon: -0.1278
  });

  // Load favorites on mount / currentUser change
  useEffect(() => {
    // 1. Initial fallback load from LocalStorage
    const stored = localStorage.getItem('lusty_favorites');
    let localFavs: string[] = [];
    if (stored) {
      try {
        localFavs = JSON.parse(stored);
        setFavoriteIds(localFavs);
      } catch (e) {
        console.error("Failed to parse local favorites:", e);
      }
    }

    if (!currentUser?.id) return;

    // 2. Fetch from database profiles favorites column
    async function fetchUserFavorites() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('favorites')
          .eq('id', currentUser!.id)
          .maybeSingle();

        if (error) {
          console.warn("Could not load favorites from profiles table:", error.message);
          return;
        }

        if (data && Array.isArray(data.favorites)) {
          setFavoriteIds(data.favorites);
          localStorage.setItem('lusty_favorites', JSON.stringify(data.favorites));
        } else {
          // If column exists but is empty/null, sync our local storage favorites up to DB
          if (localFavs.length > 0) {
            await supabase
              .from('profiles')
              .update({ favorites: localFavs })
              .eq('id', currentUser!.id);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch profiles.favorites from database, falling back to offline cache:", err);
      }
    }

    fetchUserFavorites();
  }, [currentUser?.id]);

  const handleToggleFavorite = async (companionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    let updated: string[];
    if (favoriteIds.includes(companionId)) {
      updated = favoriteIds.filter(id => id !== companionId);
    } else {
      updated = [...favoriteIds, companionId];
    }

    setFavoriteIds(updated);
    localStorage.setItem('lusty_favorites', JSON.stringify(updated));

    if (currentUser?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ favorites: updated })
          .eq('id', currentUser.id);

        if (error) {
          console.warn("Could not save favorites to database column (make sure favorites column is added to profiles):", error.message);
        }
      } catch (err) {
        console.warn("Database error saving favorites:", err);
      }
    }
  };

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setGpsError(null);
      },
      (error) => {
        console.warn('Geolocation blocked or failed in DirectoryView:', error);
        setGpsError('Location access was denied or is unavailable. Defaulting to London coords.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    requestGeolocation();
  }, []);

  useEffect(() => {
    async function loadCompanions(silent = false) {
      if (!silent) setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('is_verified', { ascending: false })
          .order('created_at', { ascending: false });
        
        if (error) throw error;

        if (data && data.length > 0) {
          const mapped = data.map((profile: any) => {
            const rawTags = Array.isArray(profile.tags) ? profile.tags : [];
            // Remove '#' symbol for clean tag displaying or matching
            const tags = rawTags.map((t: string) => t.startsWith('#') ? t.substring(1) : t);
            
            const latOffset = Number(profile.lat_offset) || 0;
            const lngOffset = Number(profile.lng_offset) || 0;
            const hostLat = userCoords.lat + (latOffset * 0.1);
            const hostLon = userCoords.lon + (lngOffset * 0.1);
            const miles = calculateDistanceInMiles(userCoords.lat, userCoords.lon, hostLat, hostLon);
            const formattedDistance = miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
            const distanceStr = `~${formattedDistance} miles away`;

            return {
              id: profile.id,
              username: profile.username || 'anonymous',
              name: profile.name || profile.username || 'Anonymous Host',
              avatar: profile.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
              images: [
                profile.cover_image_url || profile.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600',
                'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600'
              ],
              isVIP: !!(profile.is_verified || profile.tier_badge === 'VIP SELECT'),
              is_verified: !!profile.is_verified,
              isVerified: !!profile.is_verified,
              isOnline: profile.is_online === true || (profile.last_seen && new Date(profile.last_seen).getTime() > Date.now() - 5 * 60 * 1000),
              lastSeen: profile.last_seen,
              age: profile.age || 24,
              location: profile.location || 'London, Mayfair',
              distance: distanceStr,
              distanceMiles: miles,
              ratePerHour: profile.hourly_rate || 250,
              bio: profile.bio || 'Verified VIP guest. Rates available on demand 🔒',
              default_caption: profile.default_caption || profile.title || profile.bio || 'Verified VIP guest. Rates available on demand 🔒',
              tags: tags,
              rating: (profile.is_verified || profile.tier_badge === 'VIP SELECT') ? 5.0 : (profile.rating || 4.9),
              avg_rating: (profile.is_verified || profile.tier_badge === 'VIP SELECT') ? 5.0 : (profile.avg_rating || profile.rating || 4.9),
              reviewsCount: profile.reviews_count || 42,
              verifiedAt: profile.verified_at || 'June 2026',
              languages: profile.languages || ['English'],
              created_at: profile.created_at || new Date().toISOString()
            };
          });
          setCompanions(mapped);
        } else {
          setCompanions(COMPANIONS);
        }
      } catch (err) {
        console.warn("Supabase loadCompanions failed, falling back to mock content:", err);
        setCompanions(COMPANIONS);
      } finally {
        if (!silent) setIsLoading(false);
      }
    }

    loadCompanions();

    // Subscribe to real live changes on the profiles database table
    const profileSubscription = supabase
      .channel(`live_status_updates_${Math.random().toString(36).substring(2, 11)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        console.log("🔄 Real-time database change detected! Syncing live directories...");
        loadCompanions(true); // silent background update to prevent page flickers
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [userCoords.lat, userCoords.lon]);

  // Aggregate all unique tags from currently loaded companions
  const allTags = Array.from(
    new Set(companions.flatMap(c => c.tags))
  );

  // Aggregate all unique languages from currently loaded companions
  const allLanguages = Array.from(
    new Set(companions.flatMap(c => c.languages || []))
  ).filter(Boolean);

  const filteredCompanions = companions.filter(companion => {
    const matchesSearch = companion.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      companion.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      companion.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      companion.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTag = selectedTag ? companion.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase()) : true;
    const matchesLanguage = selectedLanguage 
      ? companion.languages?.some(lang => lang.toLowerCase() === selectedLanguage.toLowerCase()) 
      : true;
    const matchesFavorite = showFavoritesOnly ? favoriteIds.includes(companion.id) : true;
    const matchesVerified = showVerifiedOnly ? (companion.is_verified || companion.isVerified) : true;
    
    let matchesActivity = true;
    if (activityStatus === 'active') {
      matchesActivity = !!companion.isOnline;
    } else if (activityStatus === 'lasthour') {
      if (companion.isOnline) {
        matchesActivity = true;
      } else if (companion.lastSeen) {
        const diffMs = new Date().getTime() - new Date(companion.lastSeen).getTime();
        matchesActivity = diffMs <= 60 * 60 * 1000;
      } else {
        matchesActivity = false;
      }
    } else if (activityStatus === 'recently_active') {
      if (companion.isOnline) {
        matchesActivity = true;
      } else if (companion.lastSeen) {
        const diffMs = new Date().getTime() - new Date(companion.lastSeen).getTime();
        matchesActivity = diffMs <= 24 * 60 * 60 * 1000;
      } else {
        matchesActivity = false;
      }
    }
    
    return matchesSearch && matchesTag && matchesLanguage && matchesFavorite && matchesVerified && matchesActivity;
  });

  const sortedCompanions = useMemo(() => {
    const sorted = [...filteredCompanions].sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      }
      
      if (sortBy === 'top_rated') {
        const ratingA = a.avg_rating !== undefined && a.avg_rating !== null ? Number(a.avg_rating) : (a.rating || 0);
        const ratingB = b.avg_rating !== undefined && b.avg_rating !== null ? Number(b.avg_rating) : (b.rating || 0);
        return ratingB - ratingA;
      }
      
      if (sortBy === 'closest') {
        const distA = a.distanceMiles !== undefined ? a.distanceMiles : (a.distance ? parseFloat(a.distance.replace(/[^\d.]/g, '')) || 9999 : 9999);
        const distB = b.distanceMiles !== undefined ? b.distanceMiles : (b.distance ? parseFloat(b.distance.replace(/[^\d.]/g, '')) || 9999 : 9999);
        return distA - distB;
      }
      return 0;
    });

    // Deduplicate profiles by ID to avoid any potential duplicate cards in the grid layout
    return Array.from(new Map(sorted.map(item => [item.id, item])).values());
  }, [filteredCompanions, sortBy]);

  return (
    <div id="directory-view-container" className="w-full flex flex-col h-full bg-zinc-950 p-4 md:p-6 overflow-y-auto no-scrollbar">
      
      {/* Header Info */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          Verified Companion Directory
          <span className="text-[10px] bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-widest font-bold">VIP Hub</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Each host is double-verified via secure biometric checks. Propose immediate rendezvous, direct message, or reserve safe escrow bookings.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-[#ff2d55] transition-colors" />
          <input
            id="directory-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, location, or tag..."
            className="w-full bg-zinc-900/80 text-xs text-zinc-100 rounded-xl pl-10 pr-36 py-3 border border-zinc-800 focus:outline-none focus:border-[#ff2d55] focus:bg-[#0a0512] transition-all font-mono"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            {speechStatus && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#ff2d55] bg-[#ff2d55]/10 px-2 py-0.5 rounded animate-pulse select-none">
                {speechStatus}
              </span>
            )}
            {searchTerm && (
              <button
                id="clear-search-button"
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 font-mono uppercase tracking-wider font-bold px-2 py-1 rounded transition-colors active:scale-95 cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              id="speech-recognition-button"
              type="button"
              onClick={handleMicClick}
              disabled={!isSpeechSupported}
              title={isSpeechSupported ? (isListening ? "Stop listening" : "Search by voice") : "Voice search not supported"}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                isListening 
                  ? 'bg-pink-600 text-white animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.6)] cursor-pointer' 
                  : isSpeechSupported
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer active:scale-95'
                    : 'bg-zinc-900/40 text-zinc-600 cursor-not-allowed opacity-50'
              }`}
            >
              {isListening ? (
                <Mic className="w-3.5 h-3.5" />
              ) : isSpeechSupported ? (
                <Mic className="w-3.5 h-3.5" />
              ) : (
                <MicOff className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-row gap-3 flex-wrap lg:flex-nowrap">
          {/* Show Only Verified Switch */}
          <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 sm:py-2 flex-1 sm:flex-initial select-none">
            <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider font-bold whitespace-nowrap">Only Verified</span>
            <button
              type="button"
              onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                showVerifiedOnly ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  showVerifiedOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Activity Status filter dropdown */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 sm:py-0 flex-1 sm:flex-initial">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider whitespace-nowrap">Activity</span>
            <select
              id="activity-status-filter"
              value={activityStatus}
              onChange={(e) => setActivityStatus(e.target.value)}
              className="bg-transparent text-xs text-zinc-100 font-medium focus:outline-none pr-6 cursor-pointer min-w-[120px]"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">Any Status</option>
              <option value="active" className="bg-zinc-900 text-zinc-200">Active Now</option>
              <option value="lasthour" className="bg-zinc-900 text-zinc-200">Online in last hour</option>
              <option value="recently_active" className="bg-zinc-900 text-zinc-200">Recently active</option>
            </select>
          </div>

          {/* Language filter dropdown */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 sm:py-0 flex-1 sm:flex-initial">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider whitespace-nowrap">Language</span>
            <select
              value={selectedLanguage || 'all'}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedLanguage(val === 'all' ? null : val);
              }}
              className="bg-transparent text-xs text-zinc-100 font-medium focus:outline-none pr-6 cursor-pointer min-w-[100px]"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">All Languages</option>
              {allLanguages.map(lang => (
                <option key={lang} value={lang} className="bg-zinc-900 text-zinc-200">
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Proximity / Sort selector */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 sm:py-0 flex-1 sm:flex-initial">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider whitespace-nowrap">Sort By</span>
            <select
              value={sortBy}
              onChange={(e) => {
                const val = e.target.value as 'newest' | 'top_rated' | 'closest';
                setSortBy(val);
                if (val === 'closest') {
                  requestGeolocation();
                }
              }}
              className="bg-transparent text-xs text-zinc-100 font-medium focus:outline-none pr-6 cursor-pointer min-w-[100px]"
            >
              <option value="newest" className="bg-zinc-900 text-zinc-200">Newest</option>
              <option value="top_rated" className="bg-zinc-900 text-zinc-200">Top Rated</option>
              <option value="closest" className="bg-zinc-900 text-zinc-200">Closest Distance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Geolocation dynamic feedback block */}
      {sortBy === 'closest' && gpsError && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2.5 rounded-xl text-[10px] flex items-center justify-between gap-2">
          <span>📍 {gpsError}</span>
          <button 
            onClick={requestGeolocation}
            className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-mono font-bold uppercase tracking-wider"
          >
            Retry GPS
          </button>
        </div>
      )}

      {/* Tags Fast Filter Chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => {
            setSelectedTag(null);
            setShowFavoritesOnly(false);
          }}
          className={`px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wide font-bold transition-all duration-200 ${
            selectedTag === null && !showFavoritesOnly
              ? 'bg-pink-500 text-white' 
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          ALL COMPANIONS
        </button>

        {/* ❤️ Show Favorites Filter Chip */}
        <button
          onClick={() => {
            setShowFavoritesOnly(!showFavoritesOnly);
            setSelectedTag(null);
          }}
          className={`px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wide font-bold transition-all duration-200 flex items-center gap-1.5 ${
            showFavoritesOnly
              ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)]'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Heart className={`w-3 h-3 ${showFavoritesOnly ? 'fill-current text-white' : 'text-red-500'}`} />
          FAVORITES ({favoriteIds.length})
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wide transition-all duration-200 ${
              tag === selectedTag
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            #{tag.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Companions Grid Layout */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-500 font-mono text-xs">
          <Loader2 className="w-8 h-8 text-pink-500 animate-spin mb-3 animate-pulse" />
          <span>Syncing Global Verified Directories...</span>
        </div>
      ) : sortedCompanions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-500 font-mono text-xs">
          <span>No hosts found matching this filter or search term.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {sortedCompanions.map(companion => (
            <CompanionDirectoryCard
              key={companion.id}
              companion={companion}
              currentUserId={currentUser?.id || ''}
              onStartChat={onStartChat}
              onWalletDeduction={onWalletDeduction}
              onAddBooking={onAddBooking}
              isFavorited={favoriteIds.includes(companion.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}



    </div>
  );
}
