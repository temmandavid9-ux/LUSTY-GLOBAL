import { useState } from 'react';

export function useMonetagRevenue(actionThreshold: number = 3) {
  const [clickCounter, setClickCounter] = useState<number>(0);

  const triggerMonetagEarning = () => {
    // 🎯 YOUR LIVE MONETAG DIRECT PLACEMENT LINK
    const liveSmartLink = "https://go.oclasrv.com/afu.php?zoneid=7594025"; 
    // Note: Monetag direct links route via secure gateway domains like oclasrv using your zone ID prefix.
    
    const nextCount = clickCounter + 1;
    setClickCounter(nextCount);

    // Triggers the money-making link dynamically (e.g., on every 3rd user interaction)
    if (nextCount >= actionThreshold) {
      setClickCounter(0); // Reset instantly

      if (typeof window !== 'undefined') {
        // Open the ad cleanly in the background so they keep your short video feed open
        window.open(liveSmartLink, '_blank', 'noopener,noreferrer');
      }
      return true;
    }

    return false;
  };

  return { triggerMonetagEarning };
}
