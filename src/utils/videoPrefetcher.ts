import { getSafeVideoUrl } from './videoUtils';

class VideoPrefetcher {
  private cache: Map<string | number, HTMLVideoElement> = new Map();
  private maxCacheSize: number = 6; // Reduced max cache to limit socket pressure

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
            // Stagger preloads slightly to prevent hitting QUIC protocol limits all at once
            setTimeout(() => {
              if (!this.cache.has(videoId)) {
                this.preloadVideoUrl(videoId, videoUrl);
              }
            }, i * 150); 
          }
          prefetchedIds.push(videoId);
        }
      }
    }

    this.pruneCache(videos, currentIndex);
    return prefetchedIds;
  }

  private preloadVideoUrl(id: string | number, rawUrl: string): void {
    if (typeof window === 'undefined') return;

    const safeUrl = getSafeVideoUrl(rawUrl, typeof id === 'number' ? id : 0);

    try {
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata'; // Changed from 'auto' to 'metadata' to prevent massive chunk downloads upfront!
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.crossOrigin = 'anonymous';
      videoEl.src = safeUrl;

      videoEl.onerror = () => {
        console.warn(`[VideoPrefetcher] Preload error for video [${id}]`);
        this.cache.delete(id);
      };

      videoEl.load();
      this.cache.set(id, videoEl);
    } catch (err) {
      console.warn(`[VideoPrefetcher] Preload failed for video [${id}]:`, err);
    }
  }

  private pruneCache(
    videos: Array<{ id: string | number }>,
    currentIndex: number
  ): void {
    if (this.cache.size <= this.maxCacheSize) return;

    const activeAndNextIds = new Set(
      videos.slice(Math.max(0, currentIndex - 1), currentIndex + 3).map(v => v.id)
    );

    for (const [id, videoEl] of this.cache.entries()) {
      if (!activeAndNextIds.has(id)) {
        videoEl.pause();
        videoEl.src = '';
        videoEl.load(); // Forces socket termination
        this.cache.delete(id);
      }
    }
  }

  public clear(): void {
    for (const [, videoEl] of this.cache.entries()) {
      videoEl.pause();
      videoEl.src = '';
      videoEl.load();
    }
    this.cache.clear();
  }
}

export const videoPrefetcher = new VideoPrefetcher();
