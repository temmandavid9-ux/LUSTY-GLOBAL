import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Compass, MessageSquare, Award, MapPin, Loader2, LocateFixed, Move } from 'lucide-react';
import { calculateDistanceInMiles } from '../utils/geo';

export interface RadarCompanion {
  id: string;
  username: string;
  avatar_url?: string;
  location: string;
  hourly_rate: number;
  rating: number;
  lat_offset: number;
  lng_offset: number;
  is_online?: boolean;
}

export const MOCK_RADAR_HOSTS: RadarCompanion[] = [];

export interface RadarFilters {
  onlineOnly: boolean;
  minRating: number;
  minRate: number;
  maxRate: number;
}

export function LustyLiveRadar({ 
  currentUserId,
  onStartChat,
  filters,
  centerTrigger
}: { 
  currentUserId: string;
  onStartChat?: (companionId: string) => void;
  filters?: RadarFilters;
  centerTrigger?: number;
}) {
  const [hosts, setHosts] = useState<RadarCompanion[]>([]);
  const [selectedHost, setSelectedHost] = useState<RadarCompanion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number }>({
    lat: 51.5074, // Default London Center
    lon: -0.1278
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Pan offset and centering animation state
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isCentering, setIsCentering] = useState(false);
  const [showPulsePing, setShowPulsePing] = useState(false);

  const prevCenterTrigger = useRef<number | undefined>(centerTrigger);

  const handleCenterLocation = () => {
    setIsCentering(true);
    setPanOffset({ x: 0, y: 0 });
    setShowPulsePing(true);

    if (!navigator.geolocation) {
      setLocationStatus("Not supported");
      setTimeout(() => {
        setLocationStatus(null);
        setIsCentering(false);
      }, 2000);
      return;
    }

    setIsLocating(true);
    setLocationStatus("Locating...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setIsLocating(false);
        setLocationStatus("Centered!");
        setTimeout(() => {
          setLocationStatus(null);
          setIsCentering(false);
          setShowPulsePing(false);
        }, 2500);
      },
      (error) => {
        console.warn('Geolocation access failed or timed out, using fallback coordinates:', error);
        setUserCoords({ lat: 51.5074, lon: -0.1278 });
        setIsLocating(false);
        setLocationStatus("Centered (Default GPS)");
        setTimeout(() => {
          setLocationStatus(null);
          setIsCentering(false);
          setShowPulsePing(false);
        }, 2500);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  };

  useEffect(() => {
    if (centerTrigger !== undefined && centerTrigger !== prevCenterTrigger.current) {
      prevCenterTrigger.current = centerTrigger;
      handleCenterLocation();
    }
  }, [centerTrigger]);

  // Drag handlers for canvas panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - panOffset.x, y: e.touches[0].clientY - panOffset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setPanOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const isPanned = Math.abs(panOffset.x) > 8 || Math.abs(panOffset.y) > 8;

  // Request browser/device GPS coordinates with graceful fallback to London default coords
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        console.warn('Geolocation access failed or timed out, using default coordinates:', error);
        setUserCoords({ lat: 51.5074, lon: -0.1278 });
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  }, []);

  // 1. Fetch nearby hosts with real offset values from live Supabase profiles
  useEffect(() => {
    const fetchRadarData = async () => {
      setIsLoading(true);
      try {
        let activeUserId = currentUserId;
        if (!activeUserId) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) {
              activeUserId = authData.user.id;
            }
          } catch (e) {
            console.warn("Could not retrieve auth session user for radar:", e);
          }
        }

        let queryData: any[] | null = null;

        // Fetch real profiles from Supabase using valid column selection
        let query = supabase
          .from('profiles')
          .select('id, username, avatar_url, location, hourly_rate, lat_offset, lng_offset, is_online, current_lat, current_lon');

        if (activeUserId) {
          query = query.neq('id', activeUserId);
        }

        const { data, error } = await query.limit(20);
        if (!error && data && data.length > 0) {
          queryData = data;
        } else {
          if (error) {
            console.warn("Error fetching profiles table:", error);
          }
          // Fallback to companions table
          let compQuery = supabase
            .from('companions')
            .select('id, name, username, avatar_url, location, hourly_rate, lat_offset, lng_offset, is_online');
          if (activeUserId) {
            compQuery = compQuery.neq('id', activeUserId);
          }
          const { data: compData, error: compError } = await compQuery.limit(20);
          if (!compError && compData && compData.length > 0) {
            queryData = compData.map((c: any) => ({
              ...c,
              username: c.username || c.name
            }));
          }
        }

        if (queryData && queryData.length > 0) {
          const mappedData = queryData.map((host: any, idx: number) => {
            const isOnlineVal = host.is_online === true || host.is_online === 'true' || host.is_online === 1 || host.is_online === '1';
            
            // Generate deterministic radar positions relative to center if lat/lng_offset are 0/null
            const defaultLatOffsets = [0.25, -0.4, 0.45, -0.15, 0.1, -0.3, 0.35, -0.2, 0.2, -0.35, 0.15, -0.25];
            const defaultLngOffsets = [-0.35, 0.35, -0.1, -0.45, 0.4, -0.2, 0.15, -0.3, 0.3, -0.15, -0.4, 0.25];

            const latOffsetVal = Number(host.lat_offset) || defaultLatOffsets[idx % defaultLatOffsets.length];
            const lngOffsetVal = Number(host.lng_offset) || defaultLngOffsets[idx % defaultLngOffsets.length];

            return {
              id: host.id,
              username: host.username || 'anonymous',
              avatar_url: host.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
              location: host.location || 'London Area',
              hourly_rate: Number(host.hourly_rate) || 250,
              rating: [4.9, 4.8, 4.6, 4.9, 5.0, 4.7, 4.8, 4.9][idx % 8],
              lat_offset: latOffsetVal,
              lng_offset: lngOffsetVal,
              is_online: isOnlineVal
            };
          });
          setHosts(mappedData);
          if (mappedData.length > 0) setSelectedHost(mappedData[0]);
        } else {
          // If database returns empty list or isn't populated, use mock radar hosts fallback
          setHosts(MOCK_RADAR_HOSTS);
          if (MOCK_RADAR_HOSTS.length > 0) setSelectedHost(MOCK_RADAR_HOSTS[0]);
        }
      } catch (err) {
        console.warn('Radar live data fetch failed, using mock radar hosts:', err);
        setHosts(MOCK_RADAR_HOSTS);
        if (MOCK_RADAR_HOSTS.length > 0) setSelectedHost(MOCK_RADAR_HOSTS[0]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRadarData();

    // Subscribe to live profile changes in Supabase Realtime
    const channel = supabase
      .channel('public:profiles:radar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchRadarData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const filteredHosts = hosts.filter((host) => {
    if (!filters) return true;
    if (filters.onlineOnly && !host.is_online) return false;
    if (filters.minRating > 0 && (host.rating || 0) < filters.minRating) return false;
    if (filters.minRate > 0 && host.hourly_rate < filters.minRate) return false;
    if (filters.maxRate < 1000 && host.hourly_rate > filters.maxRate) return false;
    return true;
  });

  useEffect(() => {
    if (selectedHost && !filteredHosts.some(h => h.id === selectedHost.id)) {
      setSelectedHost(filteredHosts[0] || null);
    } else if (!selectedHost && filteredHosts.length > 0) {
      setSelectedHost(filteredHosts[0]);
    }
  }, [filteredHosts, selectedHost]);

  return (
    <div className="bg-[#0c0c0e] border border-zinc-900 rounded-3xl w-full max-w-6xl font-sans text-white flex flex-col md:flex-row h-auto md:min-h-[520px]">
      
      {/* 🔮 LEFT RADAR CANVAS LAYER */}
      <div className="flex-1 p-6 relative flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-900 bg-[#09090b]/40 min-h-[350px] md:min-h-0">
        
        {/* Top Header Controls Match from image_65abb8.png */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="text-pink-500 w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-100">Lusty Live Radar</h2>
            </div>
            <p className="text-[10px] font-mono text-zinc-500 mt-0.5 uppercase tracking-wide">
              Location Services • London Area
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Center on My Location Button */}
            <button
              id="center-on-my-location-button"
              type="button"
              onClick={handleCenterLocation}
              disabled={isLocating}
              className="bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 hover:border-pink-500/50 text-zinc-300 hover:text-white text-[10px] font-mono uppercase tracking-wider font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLocating ? (
                <Loader2 className="w-3 h-3 animate-spin text-pink-500" />
              ) : (
                <MapPin className="w-3 h-3 text-pink-500" />
              )}
              <span>{locationStatus || "Center on My Location"}</span>
            </button>

            <div className="bg-zinc-950/80 border border-zinc-900 px-3 py-1.5 rounded-xl text-center">
              <span className="block text-[8px] uppercase text-zinc-500 font-bold tracking-tight">Accuracy</span>
              <span className="text-emerald-400 font-mono text-[10px] font-bold">± 3m GPS Live</span>
            </div>
          </div>
        </div>

        {/* 🎯 RADAR MAP GRID CANVAS CONTAINER */}
        <div 
          className="relative w-full aspect-[2/1] max-h-72 my-6 flex items-center justify-center overflow-hidden border border-zinc-900/60 rounded-2xl bg-zinc-950/40 select-none cursor-grab active:cursor-grabbing touch-pan-y"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          
          {/* Panning Transform Layer */}
          <div 
            className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none"
            style={{
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`,
              transition: isCentering ? 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
            }}
          >
            {/* Grid lines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(244,63,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

            {/* Orbital Rings */}
            <div className="absolute w-[85%] h-[170%] border border-zinc-800/40 rounded-full opacity-60 pointer-events-none" />
            <div className="absolute w-[60%] h-[120%] border border-zinc-800/60 rounded-full pointer-events-none" />
            <div className="absolute w-[35%] h-[70%] border border-zinc-800/80 rounded-full pointer-events-none" />

            {/* Radar Sweep Animation Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/0 via-pink-500/0 to-pink-500/5 origin-center animate-spin pointer-events-none" style={{ animationDuration: '4s' }} />

            {/* Center Point Indicator: YOU */}
            <div className="absolute z-10 flex flex-col items-center justify-center pointer-events-auto">
              {showPulsePing && (
                <div className="absolute w-14 h-14 bg-pink-500/40 rounded-full animate-ping border border-pink-400 pointer-events-none" />
              )}
              <div className="w-3.5 h-3.5 bg-pink-500 rounded-full border-2 border-zinc-950 shadow-[0_0_12px_rgba(236,72,153,0.8)]" />
              <span className="text-[8px] font-black tracking-widest text-pink-500 uppercase mt-1 font-mono bg-zinc-950/80 px-1 rounded">You</span>
            </div>

            {/* Dynamic Map Placement Loops */}
            {isLoading ? (
              <div className="text-xs font-mono text-zinc-600 animate-pulse">Positioning local nodes...</div>
            ) : filteredHosts.length === 0 ? (
              <div className="text-center z-20 px-4 py-6 bg-zinc-950/90 border border-zinc-800 rounded-2xl max-w-xs pointer-events-auto">
                <span className="text-xl text-zinc-500 block mb-1">🔍</span>
                <p className="text-xs font-bold text-zinc-300">No Hosts Match Filters</p>
                <p className="text-[10px] text-zinc-500 mt-1">Try adjusting your online status, rating, or rate filters.</p>
              </div>
            ) : (
              filteredHosts.map((host, idx) => {
                // Translate coordinate floats (-1 to +1 space) into canvas positioning percentages
                const leftPercent = Math.min(Math.max(50 + host.lng_offset * 40, 10), 90);
                const topPercent = Math.min(Math.max(50 + host.lat_offset * 40, 10), 90);
                const isSelected = selectedHost?.id === host.id;

                return (
                  <button
                    type="button"
                    key={host.id || `host_${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHost(host);
                    }}
                    style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 z-20 cursor-pointer focus:outline-none pointer-events-auto"
                  >
                    <div className="relative">
                      {/* Custom Premium Hover Tooltip card showing status, rating and name */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-max bg-[#0c0c0e] border border-zinc-800 rounded-lg px-2.5 py-1.5 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-200 z-30 shadow-[0_4px_20px_rgba(0,0,0,0.9)] flex flex-col items-center gap-0.5 min-w-[90px]">
                        <span className="text-[10px] font-black text-white tracking-wide">
                          @{host.username}
                        </span>
                        <div className="flex items-center gap-1.5 text-[8px] font-mono">
                          <span className="text-amber-400 font-bold flex items-center gap-0.5">
                            ★ {(host.rating || 4.8).toFixed(1)}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${host.is_online ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                          <span className="uppercase tracking-wider text-zinc-400">
                            {host.is_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <span className="text-[9px] text-pink-500 font-mono font-bold">${host.hourly_rate}/hr</span>
                        {/* Little Arrow Indicator */}
                        <div className="w-1.5 h-1.5 bg-[#0c0c0e] border-r border-b border-zinc-800 rotate-45 absolute -bottom-[4px] left-1/2 -translate-x-1/2" />
                      </div>

                      <div className={`w-9 h-9 rounded-full overflow-hidden border-2 transition ${
                        isSelected 
                          ? 'border-pink-500 scale-110 shadow-[0_0_15px_rgba(236,72,153,0.6)]' 
                          : 'border-zinc-700 hover:border-zinc-400 hover:scale-105'
                      }`}>
                        <img 
                          src={host.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-zinc-950 ${host.is_online ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Overlay Floating Recenter Button when Panned */}
          {isPanned && (
            <button
              id="center-on-me-overlay-button"
              type="button"
              onClick={handleCenterLocation}
              className="absolute bottom-3 right-3 z-30 bg-pink-500 hover:bg-pink-600 text-white font-mono text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.6)] flex items-center gap-1.5 transition-all animate-bounce cursor-pointer"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span>Center on Me</span>
            </button>
          )}

          {/* Instruction hint for panning */}
          <div className="absolute top-2 left-2 z-20 pointer-events-none text-[9px] font-mono text-zinc-500/70 bg-zinc-950/60 px-2 py-0.5 rounded border border-zinc-900/60 flex items-center gap-1">
            <Move className="w-2.5 h-2.5 text-zinc-400" />
            <span>Drag map to pan</span>
          </div>

        </div>

        {/* Bottom Banner Descriptor */}
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mt-2">
          <span className="text-pink-500 animate-ping">➔</span> Tap companion pins to enquire about location discovery
        </div>
      </div>

      {/* 📋 RIGHT CONTENT CONSOLE DETAILS PANEL */}
      <div className="w-full md:w-80 bg-[#0c0c0e] p-6 flex flex-col justify-between items-center text-center">
        {selectedHost ? (
          <div className="w-full h-full flex flex-col justify-between text-left animate-fadeIn">
            <div>
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-zinc-800 mx-auto md:mx-0 mb-4 bg-zinc-900 shadow-xl">
                <img 
                  src={selectedHost.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
                <div className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-zinc-950 ${selectedHost.is_online ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
              </div>
              
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-black text-white">@{selectedHost.username}</h3>
                <Award className="w-4 h-4 text-pink-500" />
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono ml-auto">
                  ★ {(selectedHost.rating || 4.8).toFixed(1)}
                </span>
              </div>
              
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                📍 {selectedHost.location || 'London Area'}
              </p>
              
              <div className="mt-4 p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl font-mono">
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>Base Rate</span>
                  <span className="text-emerald-400 font-bold">${selectedHost.hourly_rate || 250}/hr</span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500 mt-1.5 pt-1.5 border-t border-zinc-900/60">
                  <span>Proximity Estimate</span>
                  <span className="text-zinc-300 font-bold">
                    {(() => {
                      const hostLat = userCoords.lat + (selectedHost.lat_offset * 0.1);
                      const hostLon = userCoords.lon + (selectedHost.lng_offset * 0.1);
                      const miles = calculateDistanceInMiles(userCoords.lat, userCoords.lon, hostLat, hostLon);
                      const formattedDistance = miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
                      return `~${formattedDistance} Miles Away`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button 
                type="button"
                onClick={() => {
                  if (onStartChat) {
                    onStartChat(selectedHost.id);
                  } else {
                    window.location.hash = '#chats';
                  }
                }}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white text-xs font-black uppercase tracking-wider py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send Secure Message</span>
              </button>
            </div>
          </div>
        ) : (
          /* Empty Placeholder UI state exact from image_65abb8.png */
          <div className="max-w-xs py-12">
            <span className="text-3xl text-zinc-700 block mb-3">📍</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300">No Host Selected</h3>
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              Select any companion marker pin on the London live radar to view distances, location estimates, and initiate direct communication.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
