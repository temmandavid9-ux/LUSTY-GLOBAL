import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HostVisibilityBoostPanel } from './HostVisibilityBoostPanel';
import { ShieldAlert, Film, CheckCircle2, ChevronRight } from 'lucide-react';
import { formatMetricCount } from '../utils/formatMetrics';
import { getSafeVideoUrl } from '../utils/videoUtils';

export function HostBoostMarketingConsole({ currentUserId }: { currentUserId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myVideos, setMyVideos] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const loadHostBillingState = async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, is_payout_verified, connected_payout_id, has_payment_method, card_brand_last4')
        .eq('id', currentUserId)
        .maybeSingle();

      const localLinked = typeof window !== 'undefined' && localStorage.getItem(`card_linked_${currentUserId}`) === 'true';

      if (data) {
        if (!data.has_payment_method && localLinked) {
          data.has_payment_method = true;
          data.card_brand_last4 = data.card_brand_last4 || 'Visa •••• 4242';
          await supabase.from('profiles').upsert({
            id: currentUserId,
            has_payment_method: true,
            card_brand_last4: data.card_brand_last4
          }, { onConflict: 'id' });
        }
        setProfile(data);
      } else {
        setProfile({
          id: currentUserId,
          is_payout_verified: false,
          connected_payout_id: null,
          has_payment_method: localLinked,
          card_brand_last4: localLinked ? 'Visa •••• 4242' : null
        });
      }
    } catch (err) {
      console.error('Handshake synchronization failure on host profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHostBillingState();
    if (typeof window !== 'undefined') {
      window.addEventListener('cardLinked', loadHostBillingState);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cardLinked', loadHostBillingState);
      }
    };
  }, [currentUserId]);

  // Fetch only the shorts belonging to this logged-in host
  useEffect(() => {
    async function loadHostVideos() {
      if (!currentUserId) {
        console.warn("⚠️ Cannot fetch videos: currentUserId is null or undefined!");
        return;
      }
      
      console.log("📡 Fetching videos for ID:", currentUserId);

      try {
        // Query the actual existing schema columns: 'caption', 'video_url', and 'thumbnail_url'
        const { data, error } = await supabase
          .from('lounge_shorts')
          .select('id, caption, video_url, thumbnail_url, views_count, likes_count, host_id')
          .eq('host_id', currentUserId)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.warn("⚠️ Primary query with 'host_id' failed, trying 'user_id' fallback:", error.message);
          
          // Try user_id column fallback with correct database columns
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('lounge_shorts')
            .select('id, caption, video_url, thumbnail_url, views_count, likes_count')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false });

          if (fallbackError) {
            console.error("❌ Both primary and fallback queries failed:", fallbackError.message);
            return;
          }

          if (fallbackData) {
            console.log("✅ Fallback videos found in database:", fallbackData);
            const mapped = fallbackData.map((vid: any) => ({
              ...vid,
              title: vid.caption || "Untitled Video Loop",
              thumbnail_url: vid.thumbnail_url || vid.video_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400"
            }));
            setMyVideos(mapped);
            if (mapped.length > 0 && !selectedVideo) {
              setSelectedVideo(mapped[0]);
            }
          }
        } else if (data) {
          console.log("✅ Videos found in database:", data);
          const mapped = data.map((vid: any) => ({
            ...vid,
            title: vid.caption || "Untitled Video Loop",
            thumbnail_url: vid.thumbnail_url || vid.video_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400"
          }));
          setMyVideos(mapped);
          if (mapped.length > 0 && !selectedVideo) {
            setSelectedVideo(mapped[0]);
          }
        }
      } catch (err) {
        console.error("❌ Exception during loadHostVideos:", err);
      }
    }
    loadHostVideos();
  }, [currentUserId]);

  useEffect(() => {
    loadHostBillingState();
  }, [currentUserId]);

  if (isLoading) {
    return (
      <div className="text-center py-12 text-xs font-mono text-zinc-600 animate-pulse">
        Verifying network security nodes...
      </div>
    );
  }

  const isEligible = !!profile?.has_payment_method;
  const cardLast4 = profile?.card_brand_last4 || 'CARD';

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-6">
      {!isEligible && (
        <div className="w-full bg-rose-950/20 border border-rose-800/40 rounded-2xl p-4 flex items-center gap-3 text-rose-400 text-xs text-left animate-fade-in">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div className="text-left">
            <span className="font-bold uppercase block text-[10px] tracking-wider">Campaign Restrictions Active</span>
            To initialize direct-charged visibility campaigns, you must first complete your profile setup or payment linkage.
          </div>
        </div>
      )}

      {/* ── 🎬 STEP 1: SPECIFIC VIDEO LOOP TARGET SELECTOR ── */}
      <div className="w-full bg-[#0e1117] border border-zinc-900 rounded-3xl p-6 text-left relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-3 font-mono">
          Target Video Selection
        </label>

        {!selectedVideo ? (
          // Unselected State Button Trigger
          <button 
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="w-full bg-[#12161f] hover:bg-[#161b26] border border-dashed border-zinc-800 rounded-2xl p-5 flex items-center justify-between transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-amber-500 transition-colors">
                <Film className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-zinc-200 block">Choose a video loop...</span>
                <span className="text-[11px] text-zinc-500 mt-0.5 block">Pick which clip gets visibility distribution</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition" />
          </button>
        ) : (
          // Active Selected Video Card Profile
          <div className="w-full bg-[#12161f] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-4">
              <div className="w-12 h-16 rounded-xl bg-zinc-950 overflow-hidden relative border border-zinc-800 shrink-0">
                {selectedVideo.video_url || (selectedVideo.thumbnail_url && selectedVideo.thumbnail_url.endsWith('.mp4')) ? (
                  <video 
                    src={`${getSafeVideoUrl(selectedVideo.video_url || selectedVideo.thumbnail_url)}#t=0.1`} 
                    preload="metadata"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <img 
                    src={selectedVideo.thumbnail_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"} 
                    alt="" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              <div className="text-left">
                <span className="text-xs font-black text-zinc-100 block line-clamp-1 uppercase tracking-wider">
                  {selectedVideo.title || "Untitled Video Loop"}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-1 font-mono">
                  ❤️ {formatMetricCount(selectedVideo.likes_count)} • 👁️ {formatMetricCount(selectedVideo.views_count)}
                </span>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="text-[10px] font-bold text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 transition-all cursor-pointer hover:border-amber-500/40 active:scale-95 font-sans"
            >
              Change Clip
            </button>
          </div>
        )}
      </div>

      {/* ── INTERACTIVE CHOOSE CLIP MODAL POPUP SHEET ── */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center px-4 md:px-0">
          <div className="bg-[#0e1117] border-t border-zinc-900 w-full max-w-md rounded-t-3xl max-h-[70vh] flex flex-col overflow-hidden pb-6 animate-slide-up">
            
            {/* Modal Title Banner */}
            <div className="p-5 border-b border-zinc-900 flex items-center justify-between shrink-0">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400 font-mono">Select Campaign Loop</span>
              <button 
                type="button"
                onClick={() => setIsPickerOpen(false)} 
                className="text-xs font-bold text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-900 transition"
              >
                Close
              </button>
            </div>

            {/* Scrollable Clips Grid Selection Frame */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {myVideos.length === 0 ? (
                <div className="text-center py-12 text-xs text-zinc-600 font-mono">
                  No video loops uploaded to your feed catalog yet.
                </div>
              ) : (
                myVideos.map((vid) => (
                  <button 
                    key={vid.id}
                    type="button"
                    onClick={() => {
                      setSelectedVideo(vid);
                      setIsPickerOpen(false);
                    }}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                      selectedVideo?.id === vid.id 
                        ? 'bg-amber-950/20 border-amber-500/40' 
                        : 'bg-[#12161f]/50 border-transparent hover:bg-[#12161f]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded-lg bg-zinc-950 overflow-hidden shrink-0 border border-zinc-900">
                        {vid.video_url || (vid.thumbnail_url && vid.thumbnail_url.endsWith('.mp4')) ? (
                          <video 
                            src={`${getSafeVideoUrl(vid.video_url || vid.thumbnail_url)}#t=0.1`} 
                            preload="metadata"
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <img 
                            src={vid.thumbnail_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"} 
                            alt="" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-200 line-clamp-1">{vid.title || "Lounge Clip"}</span>
                        <span className="text-[10px] text-zinc-500 font-mono mt-0.5">👁️ {formatMetricCount(vid.views_count)}</span>
                      </div>
                    </div>
                    {selectedVideo?.id === vid.id && <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />}
                  </button>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── 📦 STEP 2: RENDER CAMPAIGN TIERS LIST BELOW ── */}
      <HostVisibilityBoostPanel 
        currentUserId={currentUserId}
        hasPaymentMethod={isEligible}
        cardBrandLast4={cardLast4 || '4242'}
        selectedVideo={selectedVideo}
      />
    </div>
  );
}
