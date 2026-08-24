import { getSafeVideoUrl } from './videoUtils';

/**
 * 📹 VIDEO PREFETCHING UTILITY FOR SHORTS FEED SYSTEM
 * 
 * Buffers the next two videos in the feed queue to ensure instant, zero-latency playback
 * when scrolling, while keeping the currently active video playing smoothly.
 */

class VideoPrefetcher {
  private cache: Map<string | number, HTMLVideoElement> = new Map();
  private maxCacheSize: number = 8;

  /**
   * Prefetch and buffer the next N videos (default: 2) in the queue
   */
  public prefetchNextVideos(
    videos: Array<{ id: string | number; video_url?: string }>,
    currentIndex: number,
    bufferCount: number = 2
  ): Array<string | number> {
    if (!videos || videos.length === 0 || currentIndex < 0) return [];

    const prefetchedIds: Array<string | number> = [];

    for (let i = 1; i <= bufferCount; i++) {
      const targetIndex = currentIndex + i;
      if (targetIndex < videos.length) {
        const targetVideo = videos[targetIndex];
        const videoUrl = targetVideo.video_url;
        const videoId = targetVideo.id;

        if (videoUrl) {
          if (!this.cache.has(videoId)) {
            this.preloadVideoUrl(videoId, videoUrl);
          }
          prefetchedIds.push(videoId);
        }
      }
    }

    this.pruneCache(videos, currentIndex);
    return prefetchedIds;
  }

  /**
   * Instantiate background HTMLVideoElement to buffer video bytes into browser media cache
   */
  private preloadVideoUrl(id: string | number, rawUrl: string): void {
    if (typeof window === 'undefined') return;

    const safeUrl = getSafeVideoUrl(rawUrl, typeof id === 'number' ? id : 0);

    try {
      const videoEl = document.createElement('video');
      videoEl.preload = 'auto';
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.crossOrigin = 'anonymous';
      videoEl.src = safeUrl;

      videoEl.onerror = () => {
        console.warn(`[VideoPrefetcher] Preload error for video [${id}]: ${safeUrl}`);
        this.cache.delete(id);
      };

      // Trigger background buffering
      videoEl.load();

      this.cache.set(id, videoEl);
      console.log(`[VideoPrefetcher] 🚀 Prefetched & buffered video queue item [${id}] (${safeUrl})`);
    } catch (err) {
      console.warn(`[VideoPrefetcher] Preload failed for video [${id}]:`, err);
    }
  }

  /**
   * Prunes old cached video elements outside the active window to conserve memory
   */
  private pruneCache(
    videos: Array<{ id: string | number }>,
    currentIndex: number
  ): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Keep active video plus next 4 items in cache
    const activeAndNextIds = new Set(
      videos.slice(Math.max(0, currentIndex - 1), currentIndex + 5).map(v => v.id)
    );

    for (const [id, videoEl] of this.cache.entries()) {
      if (!activeAndNextIds.has(id)) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
        this.cache.delete(id);
      }
    }
  }

  public clear(): void {
    for (const [, videoEl] of this.cache.entries()) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }
    this.cache.clear();
  }
}

export const videoPrefetcher = new VideoPrefetcher();
