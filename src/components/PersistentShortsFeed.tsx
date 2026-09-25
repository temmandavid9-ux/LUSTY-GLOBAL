import React, { useState, useRef, useEffect } from 'react';
import { getSafeVideoUrl } from '../utils/videoUtils';

interface FeedPost {
  id: string | number;
  video_url: string;
  caption: string;
  [key: string]: any;
}

interface PersistentFeedProps {
  posts: FeedPost[];
}

export const PersistentShortsFeed: React.FC<PersistentFeedProps> = ({ posts }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentPost = posts[activeIndex];
  const safeUrl = currentPost ? getSafeVideoUrl(currentPost.video_url, Number(currentPost.id) || 0) : '';

  // Handle active video swapping and instant playback whenever index changes (random scroll/jump)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !safeUrl) return;

    videoEl.src = safeUrl;
    videoEl.load();
    
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Autoplay prevented on random jump:", err);
      });
    }

    return () => {
      videoEl.pause();
    };
  }, [activeIndex, safeUrl]);

  // Observer to track which post is currently in view during scrolling
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < posts.length) {
      setActiveIndex(newIndex);
    }
  };

  if (!posts.length) return <div className="text-white p-4">Loading feed...</div>;

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="relative w-full h-screen overflow-y-scroll snap-y snap-mandatory bg-black"
    >
      {posts.map((post, index) => (
        <div 
          key={post.id} 
          className="w-full h-full snap-start relative flex items-center justify-center"
        >
          {/* Metadata UI (Caption, Avatar, Likes) renders for every post */}
          <div className="absolute bottom-10 left-4 z-10 text-white pointer-events-none">
            <p className="font-bold">{post.caption}</p>
          </div>

          {/* THE SINGLE PERSISTENT VIDEO PLAYER: 
              Rendered only on the active index item so it never unmounts or stutters */}
          {index === activeIndex && (
            <video
              ref={videoRef}
              playsInline
              muted={isMuted}
              loop
              className="w-full h-full object-cover"
              onClick={() => setIsMuted(!isMuted)}
            />
          )}
        </div>
      ))}
    </div>
  );
};
