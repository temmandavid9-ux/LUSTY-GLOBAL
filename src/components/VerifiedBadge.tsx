import React from 'react';

interface VerifiedBadgeProps {
  className?: string;
  size?: number;
  variant?: 'blue' | 'purple';
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ 
  className = "inline-block align-middle ml-1", 
  size = 18,
  variant = 'blue'
}) => {
  // Hardcoded Official Twitter/Instagram Verified Blue (#1D9BF0) by default
  const isPurple = variant === 'purple';
  const badgeFill = isPurple ? '#A855F7' : '#1D9BF0';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className.replace(/text-purple-\d+/g, '')}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      aria-label="Verified User"
    >
      {/* Official Verified Blue Scalloped Badge Background */}
      <path
        d="M12 2L14.5 3.8L17.5 3.5L18.8 6.3L21.5 7.8L21 10.8L22.8 13.3L20.8 15.8L21 18.8L18 19.2L16.2 21.8L13.2 21L11 22.8L8.8 21L5.8 21.8L4 19.2L1 18.8L1.2 15.8L-0.8 13.3L1 10.8L0.5 7.8L3.2 6.3L4.5 3.5L7.5 3.8L10 2H12Z"
        fill={badgeFill}
      />
      {/* White Checkmark */}
      <path
        d="M9 12.5L11 14.5L15.5 9.5"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default VerifiedBadge;
