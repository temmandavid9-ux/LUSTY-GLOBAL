import { useState, useCallback, useEffect } from 'react';
import { videoPrefetcher } from '../utils/videoPrefetcher';

export function useVideoPrefetcher(bufferCount = 2) {
  const [preloadedVideoIds, setPreloadedVideoIds] = useState<Record<string | number, boolean>>({});

  const prefetchQueue = useCallback((
    videos: Array<{ id: string | number; video_url?: string }>,
    currentIndex: number
  ) => {
    if (!videos || videos.length === 0 || currentIndex < 0) return;

    // Buffer the next 2 videos in background
    const prefetched = videoPrefetcher.prefetchNextVideos(videos, currentIndex, bufferCount);

    setPreloadedVideoIds((prev) => {
      const updated = { ...prev };
      let changed = false;

      prefetched.forEach((id) => {
        if (!updated[id]) {
          updated[id] = true;
          changed = true;
        }
      });

      return changed ? updated : prev;
    });
  }, [bufferCount]);

  useEffect(() => {
    return () => {
      videoPrefetcher.clear();
    };
  }, []);

  return {
    preloadedVideoIds,
    prefetchQueue,
  };
}
