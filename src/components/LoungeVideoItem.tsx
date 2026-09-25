import React, { useState } from 'react';
import { useAutoplayOnScroll } from '../hooks/useAutoplayOnScroll';
import { getSafeVideoUrl } from '../utils/videoUtils';

interface VideoItemProps {
  id: string | number;
  video_url: string;
  isMuted: boolean;
}

export const LoungeVideoItem: React.FC<VideoItemProps> = ({ id, video_url, isMuted }) => {
  const safeUrl = getSafeVideoUrl(video_url, typeof id === 'number' ? id : 0);
  const videoRef = useAutoplayOnScroll(safeUrl);
  const [_, setIsPlaying] = useState(true);

  // Manual tap to toggle play/pause if user wants to pause explicitly
  const handleTapToToggle = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black" onClick={handleTapToToggle}>
      <video
        ref={videoRef}
        src={safeUrl}
        playsInline
        muted={isMuted}
        loop
        className="w-full h-full object-cover"
      />
    </div>
  );
};
