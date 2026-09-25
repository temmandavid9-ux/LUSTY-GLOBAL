import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getSafeVideoUrl } from '../utils/videoUtils';

interface FeedPost {
  id: string | number;
  video_url: string;
  caption: string;
  thumbnail_url?: string; // Optional thumbnail to hide the black flash
  username?: string;
}

interface PersistentFeedProps {
  posts: FeedPost[];
}

export const PersistentShortsFeed: React.FC<PersistentFeedProps> = ({ posts }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentPost = posts[activeIndex];
  const safeUrl = currentPost ? getSafeVideoUrl(currentPost.video_url, Number(currentPost.id) || 0) : '';

  // Reset readiness whenever active index/URL changes
  useEffect(() => {
    setIsVideoReady(false);
  }, [activeIndex, safeUrl]);

  // Manage single video source swapping and instant playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !safeUrl) return;

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
      {/* BACKGROUND VIDEO LAYER WITH THUMBNAIL FALLBACK */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center">
        {/* Thumbnail overlay hides the black screen until the video is ready to paint pixels */}
        {currentPost?.thumbnail_url && !isVideoReady && (
          <img 
            src={currentPost.thumbnail_url} 
            alt="Loading..." 
            className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-105"
          />
        )}

        <video
          ref={videoRef}
          playsInline
          muted={isMuted}
          loop
          onCanPlay={() => setIsVideoReady(true)}
          className={`w-full h-full object-cover pointer-events-auto cursor-pointer transition-opacity duration-300 ${isVideoReady ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsMuted((prev) => !prev)}
        />
      </div>

      {/* FEED CONTENT LAYERS */}
      {posts.map((post, index) => (
        <div 
          key={post.id} 
          className="w-full h-full snap-start relative flex flex-col justify-end p-6 z-10 pointer-events-none"
        >
          {Math.abs(index - activeIndex) <= 1 && (
            <div className="pointer-events-auto text-white mb-12 max-w-[80%]">
              <h3 className="font-bold text-lg mb-2">@{post.username || 'user'}</h3>
              <p className="text-sm opacity-90">{post.caption}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
