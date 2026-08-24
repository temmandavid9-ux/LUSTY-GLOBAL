import React, { useState } from 'react';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  className?: string;
  width?: number;
  quality?: number;
  fallbackSrc?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  width = 400,
  quality = 80,
  fallbackSrc = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const optimizedSrc = hasError
    ? fallbackSrc
    : getOptimizedImageUrl(src, width, quality);

  return (
    <div className={`relative overflow-hidden bg-zinc-900/60 ${className}`}>
      {/* Skeleton loading pulse */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 bg-[length:200%_100%] animate-pulse" />
      )}

      <img
        {...props}
        src={optimizedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          setIsLoaded(true);
          if (props.onLoad) props.onLoad(e);
        }}
        onError={(e) => {
          setHasError(true);
          if (props.onError) props.onError(e);
        }}
        className={`w-full h-full object-cover transition-all duration-500 ease-out ${
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        }`}
      />
    </div>
  );
};
