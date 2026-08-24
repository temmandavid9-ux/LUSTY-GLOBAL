export interface VideoFilter {
  id: string;
  name: string;
  style: string;
  creator: string;
  category: string;
  previewUrl: string;
  shaderStyle: string;
  maskType: 'smooth' | 'cyber-visor' | 'neon-horns' | 'thermal' | 'anime-eyes' | 'glitch' | 'halo' | 'dog' | 'mustache' | 'makeup' | 'glasses' | 'sparkle' | 'none';
  class?: string;
  isVerified?: boolean;
}

export const SNAP_FILTERS: VideoFilter[] = [
  { 
    id: 'normal', 
    name: 'Normal', 
    style: 'none', 
    creator: 'Lounge Studio',
    category: 'For You',
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'none',
    maskType: 'none',
    class: '',
    isVerified: true
  },
  { 
    id: 'soft-beauty', 
    name: 'Soft Glow & Smooth', 
    style: 'brightness(1.08) contrast(0.96) saturate(1.08) blur(0.3px)', 
    creator: 'Lounge Studio',
    category: 'Face',
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'brightness(1.08) contrast(0.96) saturate(1.08)',
    maskType: 'smooth',
    class: 'brightness-105 contrast-95 saturate-105',
    isVerified: true
  },
  { 
    id: 'porcelain-skin', 
    name: 'Porcelain Smooth', 
    style: 'brightness(1.12) contrast(0.92) saturate(0.98)', 
    creator: 'Lounge Studio',
    category: 'Face',
    previewUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'brightness(1.12) contrast(0.92) saturate(0.98)',
    maskType: 'smooth',
    class: 'brightness-110 contrast-90',
    isVerified: true
  },
  { 
    id: 'kawaii-pastel', 
    name: 'Kawaii Pastel Makeup', 
    style: 'brightness(1.1) contrast(0.95) saturate(1.1)', 
    creator: 'Easy Lens AI',
    category: 'Face',
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'brightness(1.15) saturate(1.2) contrast(0.95)',
    maskType: 'makeup',
    class: 'brightness-110 contrast-95 saturate-110',
    isVerified: true
  },
  { 
    id: 'golden-hour', 
    name: 'Golden Hour Grade', 
    style: 'sepia(0.25) saturate(1.4) brightness(1.05) contrast(1.1)', 
    creator: 'AI Transform',
    category: 'For You',
    previewUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'sepia(0.25) saturate(1.4) brightness(1.05) contrast(1.1)',
    maskType: 'none',
    class: 'sepia-[0.25] saturate-140 brightness-105 contrast-110',
    isVerified: false
  },
  { 
    id: 'cyber-doll', 
    name: 'Cyber-Doll Glow', 
    style: 'hue-rotate(290deg) saturate(1.4) contrast(1.15) brightness(1.05)', 
    creator: 'CyberLabs',
    category: 'Trending',
    previewUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'hue-rotate(290deg) saturate(1.4) contrast(1.15) brightness(1.05)',
    maskType: 'makeup',
    class: 'hue-rotate-[290deg] saturate-140 contrast-115 brightness-105',
    isVerified: true
  },
  { 
    id: 'vintage-glam', 
    name: '1950 Vintage Glam', 
    style: 'sepia(0.4) contrast(0.9) brightness(0.95) saturate(0.8)', 
    creator: 'RetroFX',
    category: 'Face',
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'sepia(0.4) contrast(0.9) brightness(0.95) saturate(0.8)',
    maskType: 'makeup',
    class: 'sepia-[0.4] contrast-90 brightness-95 saturate-80',
    isVerified: false
  },
  { 
    id: 'silver-gray-clear', 
    name: 'Silver Iris & Glasses', 
    style: 'contrast(1.1) grayscale(0.1)', 
    creator: 'Easy Lens AI',
    category: 'Face',
    previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'contrast(1.1) grayscale(0.1)',
    maskType: 'glasses',
    class: 'contrast-110 grayscale-[0.1]',
    isVerified: true
  },
  { 
    id: 'ethereal-twinkles', 
    name: 'Ethereal Sparkles', 
    style: 'brightness(1.15) contrast(0.95) saturate(1.2)', 
    creator: 'Easy Lens AI',
    category: 'Creators',
    previewUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'brightness(1.15) contrast(0.95) saturate(1.2)',
    maskType: 'sparkle',
    class: 'brightness-115 contrast-95 saturate-[1.2]',
    isVerified: true
  },
  { 
    id: 'dramatic', 
    name: 'Cinematic Theater', 
    style: 'contrast(1.5) saturate(0.5) brightness(0.95)', 
    creator: 'Anamorphic',
    category: 'Live',
    previewUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'contrast(1.5) saturate(0.5) brightness(0.95)',
    maskType: 'none',
    class: 'contrast-150 saturate-50 brightness-95',
    isVerified: false
  },
  { 
    id: 'vintage', 
    name: '1993 Noir', 
    style: 'sepia(1) contrast(0.75) brightness(0.9) grayscale(0.5)', 
    creator: 'RetroFX',
    category: 'For You',
    previewUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'sepia(1) contrast(0.75) brightness(0.9) grayscale(0.5)',
    maskType: 'none',
    class: 'sepia contrast-75 brightness-90 grayscale-[0.5]',
    isVerified: false
  }
];

// Landmark index paths for FaceMesh
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109
];

export const LEFT_EYE = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7
];

export const RIGHT_EYE = [
  362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 375, 364, 363
];

export const LIPS = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146
];

export type Landmark = { x: number; y: number; z?: number };

/**
 * Draws a closed path loop from landmark indices
 */
export const drawPath = (
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  indices: number[],
  width: number,
  height: number
) => {
  indices.forEach((index, i) => {
    const point = landmarks[index];
    if (!point) return;
    const x = point.x * width;
    const y = point.y * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
};

/**
 * Smooths skin while leaving eyes & lips sharp using evenodd clipping in Canvas 2D
 */
export const applyTargetedFaceSmoothing = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | HTMLCanvasElement,
  landmarks: Landmark[],
  intensity: number = 0.6, // Scale 0.0 to 1.0
  facingMode: 'user' | 'environment' = 'user',
  activeFilterStyle: string = ''
) => {
  const { width, height } = ctx.canvas;

  if (!landmarks || landmarks.length === 0) return;

  ctx.save();

  // Align coordinate system when front camera is mirrored
  if (facingMode === 'user') {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  // 1. Build multi-ring path
  ctx.beginPath();
  
  // Outer boundary (Face)
  drawPath(ctx, landmarks, FACE_OVAL, width, height);
  
  // Inner cutouts (Holes for eyes & lips)
  drawPath(ctx, landmarks, LEFT_EYE, width, height);
  drawPath(ctx, landmarks, RIGHT_EYE, width, height);
  drawPath(ctx, landmarks, LIPS, width, height);

  // 2. Clip using 'evenodd' rule (Face region MINUS eyes and lips)
  ctx.clip('evenodd');

  // 3. Apply smooth skin pass inside clipped skin area
  // Include active filter style so the smoothed patch shares identical color grading with the background frame
  const blurAmount = Math.max(1, Math.round(intensity * 4)); // Gentle blur radius
  const baseFilter = (activeFilterStyle && activeFilterStyle !== 'none') ? activeFilterStyle : '';
  ctx.filter = `${baseFilter} blur(${blurAmount}px)`.trim();
  ctx.globalAlpha = 0.35; // Gentle alpha blend for natural skin texture without harsh edges

  ctx.drawImage(video, 0, 0, width, height);

  // 4. Restore context state (clears filters and clipping)
  ctx.restore();
};

