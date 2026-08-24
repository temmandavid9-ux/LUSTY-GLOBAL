import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, Heart, Film, Trash2, Sparkles, AlertCircle, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ShortsWatermark, drawWatermarkOnCanvas } from './ShortsWatermark';
import { formatMetricCount } from '../utils/formatMetrics';
import { getSafeVideoUrl } from '../utils/videoUtils';

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
          const filteredData = (data || []).filter((item: any) => {
            const hasVideoUrl = !!item.video_url;
            const isNotTest = !(
              (item.caption && item.caption.toLowerCase().includes('test')) || 
              (item.title && item.title.toLowerCase().includes('test')) ||
              (item.description && item.description.toLowerCase().includes('test'))
            );
            return hasVideoUrl && isNotTest;
          });
          setPastVideos(filteredData);
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
      const videoUrl = video.video_url;
      const hostName = video.host_name || 'VIP';

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

      // 2. Create off-screen video element
      videoEl = document.createElement('video');
      videoEl.src = localBlobUrl;
      videoEl.crossOrigin = 'anonymous';
      videoEl.muted = false; // Must be unmuted so audio track can be captured
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

      // Load metadata
      await new Promise((resolve, reject) => {
        if (!videoEl) return reject();
        videoEl.onloadedmetadata = resolve;
        videoEl.onerror = () => reject(new Error("Error loading video metadata"));
      });

      const duration = videoEl.duration || 10;
      const width = videoEl.videoWidth || 720;
      const height = videoEl.videoHeight || 1280;

      // 3. Set up the canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not initialize canvas 2D context");

      // 4. Load watermark logo
      const logo = new Image();
      let logoLoaded = false;
      
      // Try to fetch same-origin /logo.png as blob first to completely bypass CORS headers issues on localhost/iframe
      try {
        const logoRes = await fetch('/logo.png');
        if (logoRes.ok) {
          const logoBlob = await logoRes.blob();
          logoBlobUrl = window.URL.createObjectURL(logoBlob);
          logo.src = logoBlobUrl;
          await new Promise((resolve, reject) => {
            logo.onload = () => {
              logoLoaded = true;
              resolve(true);
            };
            logo.onerror = reject;
          });
        }
      } catch (err) {
        console.warn("Failed to load local /logo.png via Blob fetch, trying fallback Supabase URL.", err);
      }

      // Fallback: If local fetch failed, try loading /logo.png directly as an image
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
          console.error("Watermark logo failed to load from fallback local URL. Proceeding with text-only watermark.", err);
        }
      }

      // 5. Try capturing audio using WebAudio API + direct fallback
      let audioTrack: MediaStreamTrack | null = null;
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaElementSource(videoEl);
        const destination = audioContext.createMediaStreamDestination();
        
        // Connect source directly to recording destination at 100% full volume
        source.connect(destination);
        
        // Attenuate speaker playback so user isn't blasted with sound during export
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
        videoBitsPerSecond: 2500000 // 2.5 Mbps prevents encoding lag and video stutter
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

      // 7. Render frame-by-frame draw loop
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

        // Render Watermark Logo if successfully loaded
        const logoWidth = width * 0.18;
        const logoHeight = logo.complete && logo.naturalWidth ? (logo.naturalHeight / logo.naturalWidth) * logoWidth : logoWidth;
        const padding = width * 0.04;

        if (logo.complete && logo.naturalWidth) {
          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 4;
          ctx.shadowOffsetY = 4;
          ctx.drawImage(logo, width - logoWidth - padding, padding, logoWidth, logoHeight);
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

      // Frame callback synchronization loop
      if ('requestVideoFrameCallback' in videoEl) {
        const updateLoop = () => {
          drawFrame();
          if (isRecording && videoEl && !videoEl.ended) {
            (videoEl as any).requestVideoFrameCallback(updateLoop);
          }
        };
        (videoEl as any).requestVideoFrameCallback(updateLoop);
      } else {
        const intervalId = setInterval(() => {
          if (!isRecording || !videoEl || videoEl.ended) {
            clearInterval(intervalId);
          } else {
            drawFrame();
          }
        }, 1000 / 30);
      }

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

  return (
    <div className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/80 group">
      {/* 📹 Video Playback Element */}
      <video
        src={getSafeVideoUrl(video.video_url)} 
        className="w-full h-full object-cover"
        loop
        playsInline
        crossOrigin="anonymous"
        controls={isPlaying} // 🕹️ Shows play/pause/scrub timeline only when playing
        id={`video-${video.id}`}
      />

      {/* 🌟 THE OFFICIAL PLATFORM WATERMARK OVERLAY */}
      <ShortsWatermark username={video.profiles?.username || 'VIP'} />

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
            <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-zinc-400" /> {formatMetricCount(views)}</span>
            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-pink-500 fill-pink-500/20" /> {formatMetricCount(likes)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
