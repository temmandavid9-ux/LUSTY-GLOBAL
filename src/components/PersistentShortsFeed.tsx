import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getSafeVideoUrl } from '../utils/videoUtils';

interface FeedPost {
  id: string | number;
  video_url: string;
  caption: string;
  username?: string;
  avatar?: string;
}

interface PersistentFeedProps {
  posts: FeedPost[];
}

export const PersistentShortsFeed: React.FC<PersistentFeedProps> = ({ posts }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentPost = posts[activeIndex];
  const safeUrl = currentPost ? getSafeVideoUrl(currentPost.video_url, Number(currentPost.id) || 0) : '';

  // 1. Manage single video source swapping and instant playback on index change (handles random jumps too)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !safeUrl) return;

    // Update source dynamically without destroying the video element DOM node
    videoEl.src = safeUrl;
    videoEl.load();

    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("[PersistentPlayer] Play interrupted or blocked:", err);
      });
    }

    return () => {
      videoEl.pause();
    };
  }, [activeIndex, safeUrl]);

  // 2. Track scroll position to update active index cleanly
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < posts.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, posts.length]);

  if (!posts.length) {
    return <div className="w-full h-screen bg-black flex items-center justify-center text-white">Loading feed...</div>;
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="relative w-full h-screen overflow-y-scroll snap-y snap-mandatory bg-black no-scrollbar"
    >
      {/* THE SINGLE PERSISTENT VIDEO PLAYER (Anchored once at the feed level, never unmounts) */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted={isMuted}
          loop
          className="w-full h-full object-cover pointer-events-auto cursor-pointer"
          onClick={() => setIsMuted((prev) => !prev)}
        />
      </div>

      {/* FEED CONTENT LAYERS (Metadata, captions, buttons scroll freely over the persistent video) */}
      {posts.map((post, index) => {
        const isActive = index === activeIndex;

        return (
          <div 
            key={post.id} 
            className={`w-full h-full snap-start relative flex flex-col justify-end p-6 z-10 pointer-events-none ${isActive ? 'opacity-100' : 'opacity-80'}`}
          >
            {/* Only render metadata for the active or nearby posts to keep DOM ultra-light */}
            {Math.abs(index - activeIndex) <= 1 && (
              <div className="pointer-events-auto text-white mb-12 max-w-[80%]">
                <h3 className="font-bold text-lg mb-2">@{post.username || 'user'}</h3>
                <p className="text-sm opacity-90">{post.caption}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
