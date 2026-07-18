export interface VideoFilter {
  id: string;
  name: string;
  style: string;
  creator: string;
  category: string;
  previewUrl: string; // Distinct, real matching content for each lens
  shaderStyle: string; // Color matrix tint overlay
  maskType: 'dog' | 'mustache' | 'makeup' | 'glasses' | 'sparkle' | 'none';
  class?: string;
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
    class: ''
  },
  { 
    id: 'dog-lens', 
    name: 'Dog Lens', 
    style: 'none', 
    creator: 'Snapchat',
    category: 'Trending',
    // 🐕 REAL CONTENT: Person with dog/puppy ears filter look
    previewUrl: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'sepia(0.05) contrast(1.02)',
    maskType: 'dog',
    class: ''
  },
  { 
    id: 'classic-mustache', 
    name: 'Classic Mustache Mode', 
    style: 'sepia(0.15) contrast(1.05)', 
    creator: 'Snapchat',
    category: 'Face',
    // 👨 REAL CONTENT: Person sporting a fun mustache look
    previewUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'sepia(0.2) contrast(1.1) brightness(0.95)',
    maskType: 'mustache',
    class: 'sepia-[0.15] contrast-105'
  },
  { 
    id: 'kawaii-pastel', 
    name: 'Kawaii Pastel Makeup', 
    style: 'brightness(1.1) contrast(0.95) saturate(1.1) blur(0.3px)', 
    creator: 'Easy Lens AI',
    category: 'Face',
    // 🌸 REAL CONTENT: Soft pink pastel cosmetic makeup look
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'brightness(1.15) saturate(1.2) contrast(0.95)',
    maskType: 'makeup',
    class: 'brightness-110 contrast-95 saturate-110 blur-[0.3px]'
  },
  { 
    id: 'cyber-doll', 
    name: 'Cyber-Doll Glow', 
    style: 'hue-rotate(290deg) saturate(1.4) contrast(1.15) brightness(1.05)', 
    creator: 'CyberLabs',
    category: 'Trending',
    // 🌌 REAL CONTENT: High-fashion neon cyber doll look
    previewUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'hue-rotate(290deg) saturate(1.4) contrast(1.15) brightness(1.05)',
    maskType: 'makeup',
    class: 'hue-rotate-[290deg] saturate-140 contrast-115 brightness-105'
  },
  { 
    id: 'chalk-style', 
    name: 'Chalk Abstract Stylization', 
    style: 'contrast(1.8) saturate(0.4) brightness(1.1)', 
    creator: 'Immersive ML',
    category: 'World',
    // 🎨 REAL CONTENT: Textured artistic/chalk style
    previewUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'contrast(1.8) saturate(0.4) brightness(1.1)',
    maskType: 'none',
    class: 'contrast-180 saturate-40 brightness-110'
  },
  { 
    id: 'vintage-glam', 
    name: '1950 Vintage Glam', 
    style: 'sepia(0.4) contrast(0.9) brightness(0.95) saturate(0.8)', 
    creator: 'RetroFX',
    category: 'Face',
    // 💄 REAL CONTENT: Classic retro studio portrait glam
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'sepia(0.4) contrast(0.9) brightness(0.95) saturate(0.8)',
    maskType: 'makeup',
    class: 'sepia-[0.4] contrast-90 brightness-95 saturate-80'
  },
  { 
    id: 'candy-popcorn', 
    name: 'Candy Popcorn Hat', 
    style: 'saturate(1.8) brightness(1.05) contrast(1.05) hue-rotate(15deg)', 
    creator: 'AI Transform',
    category: 'Trending',
    // 🍿 REAL CONTENT: Playful colorful concept look
    previewUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'saturate(1.8) brightness(1.05) contrast(1.05) hue-rotate(15deg)',
    maskType: 'none',
    class: 'saturate-180 brightness-105 contrast-105 hue-rotate-[15deg]'
  },
  { 
    id: 'silver-gray-clear', 
    name: 'Silver Iris & Glasses', 
    style: 'contrast(1.1) grayscale(0.1)', 
    creator: 'Easy Lens AI',
    category: 'Face',
    // 👓 REAL CONTENT: Person with clear style glasses accessory
    previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'contrast(1.1) grayscale(0.1)',
    maskType: 'glasses',
    class: 'contrast-110 grayscale-[0.1]'
  },
  { 
    id: 'golden-hour', 
    name: 'Golden Hour Grade', 
    style: 'sepia(0.25) saturate(1.4) brightness(1.05) contrast(1.1)', 
    creator: 'AI Transform',
    category: 'For You',
    // ☀️ REAL CONTENT: Sunset golden warmth lighting look
    previewUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'sepia(0.25) saturate(1.4) brightness(1.05) contrast(1.1)',
    maskType: 'none',
    class: 'sepia-[0.25] saturate-140 brightness-105 contrast-110'
  },
  { 
    id: 'cyberpunk', 
    name: 'Neon Pink Tint', 
    style: 'hue-rotate(320deg) saturate(2) contrast(1.25)', 
    creator: 'CyberLabs',
    category: 'Trending',
    // ⚡ REAL CONTENT: Vibrant magenta city style tint
    previewUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'hue-rotate(320deg) saturate(2) contrast(1.25)',
    maskType: 'none',
    class: 'hue-rotate-[320deg] saturate-200 contrast-125'
  },
  { 
    id: 'vintage', 
    name: '1993 Noir', 
    style: 'sepia(1) contrast(0.75) brightness(0.9) grayscale(0.5)', 
    creator: 'RetroFX',
    category: 'For You',
    // 🎬 REAL CONTENT: Black & white vintage moody look
    previewUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'sepia(1) contrast(0.75) brightness(0.9) grayscale(0.5)',
    maskType: 'none',
    class: 'sepia contrast-75 brightness-90 grayscale-[0.5]'
  },
  { 
    id: 'dramatic', 
    name: 'Cinematic Theater', 
    style: 'contrast(1.5) saturate(0.5) brightness(0.95)', 
    creator: 'Anamorphic',
    category: 'Live',
    // 🎥 REAL CONTENT: Deep cinematic movie color grading
    previewUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'contrast(1.5) saturate(0.5) brightness(0.95)',
    maskType: 'none',
    class: 'contrast-150 saturate-50 brightness-95'
  },
  { 
    id: 'ethereal-twinkles', 
    name: 'Ethereal Sparkles', 
    style: 'brightness(1.15) contrast(0.95) saturate(1.2)', 
    creator: 'Easy Lens AI',
    category: 'Creators',
    // ✨ REAL CONTENT: Bright glowing fairy portrait look
    previewUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&w=400&q=80',
    shaderStyle: 'brightness(1.15) contrast(0.95) saturate(1.2)',
    maskType: 'sparkle',
    class: 'brightness-115 contrast-95 saturate-[1.2]'
  }
];
