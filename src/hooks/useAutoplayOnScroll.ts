import { useEffect, useRef } from 'react';

export function useAutoplayOnScroll(videoUrl: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !videoUrl) return;

    // Start with metadata only to prevent heavy upfront chunk downloads
    element.preload = 'metadata';

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Video entered viewport: buffer and play instantly
            element.preload = 'auto';
            const playPromise = element.play();
            
            // Bulletproof catch for interrupted play requests during fast scrolling
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                console.warn("[Autoplay] Interrupted or blocked:", err);
              });
            }
          } else {
            // Video left viewport: pause, reset time, and sever network stream immediately
            element.pause();
            element.currentTime = 0;
          }
        });
      },
      { threshold: 0.6 } // Triggers when 60% of the video is visible on screen
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (element) {
        element.pause();
        element.src = ''; // Cuts off socket immediately on unmount
        element.load();
      }
    };
  }, [videoUrl]);

  return videoRef;
}
