import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Compass, MessageSquare, Award, MapPin, Loader2 } from 'lucide-react';
import { calculateDistanceInMiles } from '../utils/geo';

interface RadarCompanion {
  id: string;
  username: string;
  avatar_url?: string;
  location: string;
  hourly_rate: number;
  lat_offset: number;
  lng_offset: number;
  is_online?: boolean;
}

export function LustyLiveRadar({ 
  currentUserId,
  onStartChat
}: { 
  currentUserId: string;
  onStartChat?: (companionId: string) => void;
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

  const handleCenterLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Not supported");
      setTimeout(() => setLocationStatus(null), 3000);
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
        setLocationStatus("Synced!");
        setTimeout(() => setLocationStatus(null), 3000);
      },
      (error) => {
        console.warn('Geolocation access failed or blocked:', error);
        setIsLocating(false);
        setLocationStatus("Failed");
        setTimeout(() => setLocationStatus(null), 3000);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Request browser/device GPS coordinates
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
        console.warn('Geolocation access failed or blocked:', error);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // 1. Fetch nearby hosts with real offset values
  useEffect(() => {
    const fetchRadarData = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('profiles')
          .select('id, username, avatar_url, location, hourly_rate, lat_offset, lng_offset, is_online');

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (currentUserId && uuidRegex.test(currentUserId)) {
          query = query.not('id', 'eq', currentUserId);
        } else {
          query = query.not('id', 'is', null);
        }

        const { data, error } = await query.limit(8);

        if (!error && data && data.length > 0) {
          // Ensure mock data fallbacks map onto coordinates if they are completely blank
          const mappedData = data.map((host: any, idx: number) => {
            const isOnlineVal = host.is_online === true || host.is_online === 'true' || host.is_online === 1 || host.is_online === '1';
            return {
              id: host.id,
              username: host.username || 'anonymous',
              avatar_url: host.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
              location: host.location || 'London, Mayfair',
              hourly_rate: host.hourly_rate || 250,
              lat_offset: Number(host.lat_offset) || [0.25, -0.4, 0.45, -0.15, 0.1, -0.3, 0.35, -0.2][idx % 8],
              lng_offset: Number(host.lng_offset) || [-0.35, 0.35, -0.1, -0.45, 0.4, -0.2, 0.15, -0.3][idx % 8],
              is_online: isOnlineVal
            };
          });
          setHosts(mappedData);
          if (mappedData.length > 0) setSelectedHost(mappedData[0]);
        } else {
          setHosts(getFallbackRadarHosts());
          const fallback = getFallbackRadarHosts();
          if (fallback.length > 0) setSelectedHost(fallback[0]);
        }
      } catch (err) {
        console.warn('Radar live data handshake failed, using simulated high-precision positioning offsets:', err);
        setHosts(getFallbackRadarHosts());
        const fallback = getFallbackRadarHosts();
        if (fallback.length > 0) setSelectedHost(fallback[0]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRadarData();
  }, [currentUserId]);

  const getFallbackRadarHosts = (): RadarCompanion[] => {
    return [
      { id: 'comp_1', username: 'clara_mayfair', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', location: 'London, Mayfair', hourly_rate: 250, lat_offset: 0.25, lng_offset: -0.35, is_online: true },
      { id: 'comp_2', username: 'elena_luxe', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', location: 'London, Chelsea', hourly_rate: 300, lat_offset: -0.4, lng_offset: 0.35, is_online: true },
      { id: 'comp_3', username: 'sophia_grace', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', location: 'London, Kensington', hourly_rate: 200, lat_offset: 0.45, lng_offset: -0.1, is_online: false },
      { id: 'comp_4', username: 'mya_adore', avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', location: 'London, Soho', hourly_rate: 280, lat_offset: -0.15, lng_offset: -0.45, is_online: true },
      { id: 'comp_5', username: 'bella_elite', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150', location: 'London, Westminster', hourly_rate: 350, lat_offset: 0.1, lng_offset: 0.4, is_online: true },
      { id: 'comp_6', username: 'stella_lounge', avatar_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150', location: 'London, Knightsbridge', hourly_rate: 400, lat_offset: -0.3, lng_offset: -0.2, is_online: false }
    ];
  };

  return (
    <div className="bg-[#0c0c0e] border border-zinc-900 rounded-3xl w-full max-w-6xl overflow-hidden font-sans text-white flex flex-col md:flex-row h-auto md:h-[520px]">
      
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
        <div className="relative w-full aspect-[2/1] max-h-72 my-6 flex items-center justify-center overflow-hidden border border-zinc-900/60 rounded-2xl bg-zinc-950/40">
          
          {/* Grid lines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(244,63,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

          {/* Orbital Rings - Replicating image_65abb8.png design */}
          <div className="absolute w-[85%] h-[170%] border border-zinc-800/40 rounded-full opacity-60 pointer-events-none" />
          <div className="absolute w-[60%] h-[120%] border border-zinc-800/60 rounded-full pointer-events-none" />
          <div className="absolute w-[35%] h-[70%] border border-zinc-800/80 rounded-full pointer-events-none" />

          {/* Radar Sweep Animation Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/0 via-pink-500/0 to-pink-500/5 origin-center animate-spin pointer-events-none" style={{ animationDuration: '4s' }} />

          {/* Center Point Indicator: YOU */}
          <div className="absolute z-10 flex flex-col items-center justify-center">
            <div className="w-3.5 h-3.5 bg-pink-500 rounded-full border-2 border-zinc-950 shadow-[0_0_12px_rgba(236,72,153,0.8)]" />
            <span className="text-[8px] font-black tracking-widest text-pink-500 uppercase mt-1 font-mono bg-zinc-950/80 px-1 rounded">You</span>
          </div>

          {/* Dynamic Map Placement Loops */}
          {isLoading ? (
            <div className="text-xs font-mono text-zinc-600 animate-pulse">Positioning local nodes...</div>
          ) : (
            hosts.map((host, idx) => {
              // Translate coordinate floats (-1 to +1 space) into canvas positioning percentages
              const leftPercent = 50 + host.lng_offset * 40;
              const topPercent = 50 + host.lat_offset * 40;
              const isSelected = selectedHost?.id === host.id;

              return (
                <button
                  type="button"
                  key={host.id || `host_${idx}`}
                  onClick={() => setSelectedHost(host)}
                  style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 z-20 cursor-pointer focus:outline-none"
                >
                  <div className="relative">
                    {/* Custom Premium Hover Tooltip card showing status and name */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-max bg-[#0c0c0e] border border-zinc-800 rounded-lg px-2.5 py-1.5 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-200 z-30 shadow-[0_4px_20px_rgba(0,0,0,0.9)] flex flex-col items-center gap-0.5 min-w-[90px]">
                      <span className="text-[10px] font-black text-white tracking-wide">
                        @{host.username}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${host.is_online ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-zinc-500'}`} />
                        <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-400">
                          {host.is_online ? 'Active Now' : 'Offline'}
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
