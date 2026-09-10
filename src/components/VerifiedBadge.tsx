import React from 'react';

interface VerifiedBadgeProps {
  className?: string;
  size?: number;
  variant?: 'blue' | 'purple';
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ 
  className = "", 
  size = 18,
  variant = 'blue'
}) => {
  const isPurple = variant === 'purple';
  const badgeFill = isPurple ? '#A855F7' : '#1D9BF0';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      aria-label="Verified User"
    >
      <path
        d="M22.25 12c0-1.43-.88-2.67-2.15-3.21.15-.44.24-.91.24-1.4 0-2.2-1.72-4-3.83-4-.48 0-.94.1-1.35.27C14.56 2.39 13.38 1.5 12 1.5s-2.56.89-3.16 2.16c-.41-.17-.87-.27-1.35-.27-2.11 0-3.83 1.8-3.83 4 0 .49.09.96.24 1.4-1.27.54-2.15 1.78-2.15 3.21 0 1.43.88 2.67 2.15 3.21-.15.44-.24.91-.24 1.4 0 2.2 1.72 4 3.83 4 .48 0 .94-.1 1.35-.27.6 1.27 1.78 2.16 3.16 2.16s2.56-.89 3.16-2.16c.41.17.87.27 1.35.27 2.11 0 3.83-1.8 3.83-4 0-.49-.09-.96-.24-1.4 1.27-.54 2.15-1.78 2.15-3.21zm-12.5 4L6 12.25l1.5-1.5 2.25 2.25L16.25 6.5l1.5 1.5-8 8z"
        fill={badgeFill}
      />
    </svg>
  );
};

export default VerifiedBadge;
