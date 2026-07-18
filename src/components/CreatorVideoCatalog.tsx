import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, Heart, Film, Trash2, Sparkles, AlertCircle, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreatorVideoCatalogProps {
  currentUserId: string;
  refreshTrigger?: number;
  readOnly?: boolean;
}

export function CreatorVideoCatalog({ currentUserId, refreshTrigger = 0, readOnly = false }: CreatorVideoCatalogProps) {
  const [pastVideos, setPastVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPastVideos() {
      if (!currentUserId) return;
      
      try {
        setIsLoading(true);
        setErrorFeedback(null);
        console.log(`📡 Fetching videos for ID: ${currentUserId}`);

        // 🎯 FIX: Query only against 'host_id' since 'user_id' doesn't exist on the lounge_shorts table
        const { data, error } = await supabase
          .from('lounge_shorts')
          .select('*')
          .eq('host_id', currentUserId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (isMounted) {
          console.log(`✅ Videos found in database: Array(${data?.length || 0})`);
          setPastVideos(data || []);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Error fetching historic catalog:", err.message || err);
          setErrorFeedback("Failed to load your past videos. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchPastVideos();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, refreshTrigger]);

  const handleDeleteVideo = async (videoId: string | number, e: React.MouseEvent) => {
    e.stopPropagation();

    // 📣 Trigger a sticky, interactive dark-mode confirmation banner matching LUSTY GLOBAL VIP design
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in zoom-in-95 duration-200' : 'animate-out fade-out zoom-out-95 duration-200'
        } max-w-sm w-full bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl pointer-events-auto p-4 mt-2 text-left z-50`}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 text-sm flex-shrink-0">
            ⚠️
          </div>
          <div className="flex-1">
            <p className="text-xs font-black text-pink-500 uppercase tracking-wider font-sans">
              Confirm Deletion
            </p>
            <p className="mt-1 text-xs text-zinc-300 font-medium font-sans">
              Are you sure you want to permanently delete this video? This action cannot be undone.
            </p>
            
            {/* Action Buttons Row */}
            <div className="mt-4 flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-[11px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  toast.dismiss(t.id); // Clear confirmation box
                  
                  try {
                    setDeletingId(videoId);

                    // 💥 Programmatic Cascade Deletion to bypass Foreign Key Constraint blocks:
                    // Deleting all potential referencing rows in likes, comments, views/interactions, and campaign tables first.
                    // Promise.allSettled avoids failure if any optional table is blocked by RLS or missing.
                    await Promise.allSettled([
                      supabase.from('video_boost_campaigns').delete().eq('id', videoId),
                      supabase.from('video_interactions').delete().eq('video_id', videoId),
                      supabase.from('short_comments').delete().eq('short_id', videoId),
                      supabase.from('lounge_short_likes').delete().eq('short_id', videoId),
                      supabase.from('short_likes').delete().eq('short_id', videoId)
                    ]);

                    // Use .select() to verify if the row was actually deleted (and not silently blocked by RLS)
                    const { data, error } = await supabase
                      .from('lounge_shorts')
                      .delete()
                      .eq('id', videoId)
                      .eq('host_id', currentUserId)
                      .select();

                    if (error) throw error;

                    if (!data || data.length === 0) {
                      throw new Error("No records were deleted. This usually means your database Row-Level Security (RLS) policies block DELETE operations on the lounge_shorts table.\n\nPlease ensure a DELETE policy exists in your Supabase SQL editor:\n\nCREATE POLICY \"Hosts can delete own shorts\" ON lounge_shorts FOR DELETE TO authenticated USING (auth.uid() = host_id);");
                    }

                    toast.success("Video permanently removed!", {
                      style: {
                        background: '#09090b',
                        color: '#f4f4f5',
                        border: '1px solid #27272a'
                      }
                    });
                    setPastVideos(prev => prev.filter(v => v.id !== videoId));
                  } catch (err: any) {
                    console.error("Error deleting video:", err);
                    toast.error(err.message || "Failed to delete video.", {
                      style: {
                        background: '#09090b',
                        color: '#f4f4f5',
                        border: '1px solid #27272a'
                      }
                    });
                  } finally {
                    setDeletingId(null);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-[11px] transition-colors shadow-lg shadow-pink-500/20 cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      </div>
    ), { id: `confirm-${videoId}`, duration: Infinity }); // Keep it on screen until they pick an action!
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-500 text-xs font-mono">
        <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span>Syncing media archive...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorFeedback && (
        <div className="bg-red-950/40 border border-red-500/20 text-red-400 text-[10px] p-2.5 rounded-xl flex items-center gap-2 font-mono">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorFeedback}</span>
        </div>
      )}

      {pastVideos.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-xs font-mono">
          <Film className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p>No video loops uploaded yet.</p>
          <p className="text-[10px] text-zinc-600 mt-1">Use the upload studio tab to post your first short video!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2.5">
          {pastVideos.map((video) => (
            <PlaybackCard 
              key={video.id} 
              video={video} 
              deletingId={deletingId}
              onDelete={handleDeleteVideo}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlaybackCard({ 
  video, 
  deletingId, 
  onDelete,
  readOnly = false
}: { 
  video: any; 
  deletingId: string | number | null; 
  onDelete: (id: string | number, e: React.MouseEvent) => void;
  readOnly?: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const views = video.views_count !== undefined ? video.views_count : (video.views || 0);
  const likes = video.likes_count !== undefined ? video.likes_count : (video.likes || 0);
  const hasActiveCampaign = video.has_active_boost || video.boost_active;

  // 📥 Secure blob compilation handler to force an asset file download on mobile/desktop devices with baked-in watermark
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop the video from triggering a play/pause toggle when clicked
    if (isDownloading) return;

    setIsDownloading(true);
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
          videoUrl: video.video_url,
          hostName: video.host_name,
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
      link.download = `LustyGlobal-VIP-${video.id || 'download'}.mp4`;
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

  return (
    <div className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/80 group">
      {/* 📹 Video Playback Element */}
      <video
        src={video.video_url} 
        className="w-full h-full object-cover"
        loop
        playsInline
        controls={isPlaying} // 🕹️ Shows play/pause/scrub timeline only when playing
        id={`video-${video.id}`}
      />

      {/* 🌟 THE OFFICIAL PLATFORM WATERMARK OVERLAY */}
      <div className="absolute top-10 left-2 z-20 pointer-events-none opacity-40 mix-blend-screen select-none">
        <p className="font-black text-[8px] tracking-widest text-white uppercase drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)] flex items-center gap-0.5">
          <span className="text-pink-500">👑</span> LUSTY GLOBAL <span className="text-pink-500">VIP</span>
        </p>
      </div>

      {/* 🔮 Active Boost indicator */}
      {hasActiveCampaign && (
        <div className="absolute top-2 left-2 bg-pink-500/90 text-white font-mono text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg backdrop-blur-sm z-10">
          <Sparkles className="w-2.5 h-2.5 fill-white" />
          <span>BOOSTED</span>
        </div>
      )}

      {/* 📥 Download button */}
      <button
        type="button"
        disabled={isDownloading}
        onClick={handleDownload}
        className="absolute top-2 right-10 bg-black/60 hover:bg-zinc-800 hover:text-white text-zinc-300 p-1.5 rounded-full transition duration-150 backdrop-blur-sm cursor-pointer z-20 disabled:opacity-50"
        title="Download Video"
      >
        {isDownloading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
      </button>

      {/* 🗑️ Delete button */}
      {!readOnly && (
        <button
          type="button"
          disabled={deletingId === video.id}
          onClick={(e) => onDelete(video.id, e)}
          className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 hover:text-white text-zinc-400 p-1.5 rounded-full transition duration-150 backdrop-blur-sm cursor-pointer z-20"
          title="Delete Video"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 🔮 Dark Overlay Overlay (Hidden when video is actively playing) */}
      {!isPlaying && (
        <div 
          onClick={() => {
            const el = document.getElementById(`video-${video.id}`) as HTMLVideoElement;
            if (el) {
              el.play().catch(err => console.warn("Video play failed:", err));
              setIsPlaying(true);
            }
          }}
          className="absolute inset-0 bg-black/45 flex flex-col justify-between p-3 cursor-pointer transition-opacity duration-300 group-hover:bg-black/20 z-10"
        >
          {/* Top Metadata: Upload Date (shifted down slightly to avoid overlap with Delete/Boost button) */}
          <div className="text-left mt-8">
            <span className="text-[9px] bg-zinc-900/80 text-zinc-300 backdrop-blur-md px-2 py-0.5 rounded-full font-bold">
              {video.created_at ? new Date(video.created_at).toLocaleDateString() : 'Recent'}
            </span>
          </div>

          {/* Title overlay */}
          <div className="absolute top-16 left-3 right-3 text-left">
            <h4 className="text-[10px] font-black text-zinc-100 truncate drop-shadow-sm font-sans tracking-wide">
              {video.title || 'Untitled loop'}
            </h4>
          </div>

          {/* Central Play Indicator Icon */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-9 h-9 rounded-full bg-[#ff2d55] flex items-center justify-center text-white text-[11px] shadow-lg shadow-[#ff2d55]/40 transform transition-transform group-hover:scale-110">
              ▶
            </div>
          </div>

          {/* Bottom Video Metrics Row */}
          <div className="flex items-center justify-between text-[10px] text-zinc-300 font-bold backdrop-blur-sm bg-black/30 p-1.5 rounded-xl">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-zinc-400" /> {views}</span>
            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-pink-500 fill-pink-500/20" /> {likes}</span>
          </div>
        </div>
      )}
    </div>
  );
}
