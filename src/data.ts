import { Companion, VideoItem, Campaign } from './types';

export const COMPANIONS: Companion[] = [
  {
    id: 'comp_lucy',
    username: 'LUCY JUICY',
    name: 'Lucy Juicy',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    images: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600'
    ],
    isVIP: true,
    isOnline: true,
    age: 23,
    location: 'Abuja',
    distance: '3.0 miles away',
    ratePerHour: 200,
    bio: 'VIP host and lifestyle model available in Abuja. Enquire for private bookings and exclusive social accompaniment.',
    tags: ['VIP Host', 'Elegance', 'Model'],
    rating: 4.9,
    reviewsCount: 38,
    verifiedAt: 'August 2026',
    languages: ['English']
  },
  {
    id: 'comp_starboy',
    username: 'starboy',
    name: 'Starboy VIP',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    images: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600'
    ],
    isVIP: true,
    isOnline: true,
    age: 26,
    location: 'London, Mayfair',
    distance: '1.2 miles away',
    ratePerHour: 250,
    bio: 'Nightlife creator and elite VIP entertainer. Available for private lounge hosting.',
    tags: ['VIP', 'Nightlife', 'Host'],
    rating: 4.9,
    reviewsCount: 52,
    verifiedAt: 'July 2026',
    languages: ['English']
  },
  {
    id: 'comp_testcreator',
    username: 'Test Creator',
    name: 'Test Creator',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    images: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600'
    ],
    isVIP: false,
    isOnline: false,
    age: 25,
    location: 'London Area',
    distance: '2.5 miles away',
    ratePerHour: 250,
    bio: 'Official test creator account for live radar streaming and video lounge testing.',
    tags: ['Creator', 'Live Stream'],
    rating: 4.9,
    reviewsCount: 15,
    verifiedAt: 'August 2026',
    languages: ['English']
  },
  {
    id: 'comp_blackqueen',
    username: 'blackqueen',
    name: 'Black Queen',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=300&q=80',
    images: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600'
    ],
    isVIP: true,
    isOnline: true,
    age: 24,
    location: 'London, Chelsea',
    distance: '1.8 miles away',
    ratePerHour: 180,
    bio: 'Top tier VIP host with 116.2k followers. High-fashion model and private lounge guest.',
    tags: ['Model', 'VIP', 'Fashion'],
    rating: 4.8,
    reviewsCount: 89,
    verifiedAt: 'June 2026',
    languages: ['English']
  },
  {
    id: 'comp_1',
    username: 'Elena_VIP',
    name: 'Elena Rostova',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
    images: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600'
    ],
    isVIP: true,
    isOnline: true,
    age: 24,
    location: 'London, Mayfair',
    distance: '0.8 miles away',
    ratePerHour: 250,
    bio: 'Enquire for private bookings in the premium VIP Lounge 1. Elite host, professional model, and champagne enthusiast. I offer high-class hosting and elegant dinner accompaniment.',
    tags: ['Elegance', 'Champagne', 'Dinner Host', 'Bilingual'],
    rating: 4.9,
    reviewsCount: 48,
    verifiedAt: 'June 2026',
    languages: ['English', 'Russian']
  },
  {
    id: 'comp_2',
    username: 'Bella_Dance',
    name: 'Bella Thorne',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300',
    images: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600'
    ],
    isVIP: true,
    isOnline: true,
    age: 22,
    location: 'London, Kensington',
    distance: '1.4 miles away',
    ratePerHour: 300,
    bio: 'Professional dancer, aerialist, and VIP entertainer. Highly active in the Live Lounge scene. Propose direct bookings for premium events, club hosting, and high-energy gatherings.',
    tags: ['Active', 'Dance', 'VIP Lounge', 'Parties'],
    rating: 5.0,
    reviewsCount: 32,
    verifiedAt: 'May 2026',
    languages: ['English', 'Spanish']
  },
  {
    id: 'comp_3',
    username: 'Natasha_Rose',
    name: 'Natasha Rose',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
    images: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600'
    ],
    isVIP: true,
    isOnline: false,
    lastSeen: new Date(Date.now() - 34 * 60 * 1000).toISOString(),
    age: 25,
    location: 'London, Chelsea',
    distance: '2.1 miles away',
    ratePerHour: 400,
    bio: 'Premium verified guest. Exclusive companion for fine dining, corporate retreats, and upscale international travel. Rates are non-negotiable. Booking requires 30% advanced escrow deposit.',
    tags: ['Luxury', 'Travel Escort', 'Corporate Gala', 'Private Yacht'],
    rating: 4.8,
    reviewsCount: 65,
    verifiedAt: 'April 2026',
    languages: ['English', 'French']
  },
  {
    id: 'comp_4',
    username: 'Zara_Mystique',
    name: 'Zara Vane',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300',
    images: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600'
    ],
    isVIP: false,
    isOnline: true,
    age: 23,
    location: 'London, Soho',
    distance: '0.3 miles away',
    ratePerHour: 180,
    bio: 'Creative body artist, conversationalist, and late-night lounge enthusiast. Let us meet in quiet cocktail bars or explore the art scene of Soho. I love witty banter and dry martinis.',
    tags: ['Creative', 'Art Lover', 'Cocktails', 'Indie'],
    rating: 4.7,
    reviewsCount: 19,
    verifiedAt: 'June 2026',
    languages: ['English']
  },
  {
    id: 'comp_5',
    username: 'Sophia_M',
    name: 'Sophia Miller',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300',
    images: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600'
    ],
    isVIP: false,
    isOnline: false,
    lastSeen: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
    age: 26,
    location: 'London, Hampstead',
    distance: '4.5 miles away',
    ratePerHour: 150,
    bio: 'An avid reader, museum guide, and tea connoisseur. Available for intellectual coffee dates, book shop browsing, and afternoon strolls.',
    tags: ['Intellectual', 'Museums', 'Tea', 'Quiet'],
    rating: 4.6,
    reviewsCount: 12,
    verifiedAt: 'March 2026',
    languages: ['English', 'German']
  }
];

export const VIDEOS: VideoItem[] = [
  {
    id: 'vid_1',
    videoUrl: 'https://vtmaffcyvhnnmfibfswm.supabase.co/storage/v1/object/public/videos/shorts/ec698e7c-3885-4d9e-81af-e91e9fa6fc97/1783632687007.mp4',
    creatorId: 'comp_1',
    caption: 'Midnight neon vibes in the main lounge 💜 Propose a rendezvous in direct messages! #viplounge #nightlife [location:London, Mayfair]',
    soundTrack: 'Original sound - VIP Elena',
    likes: 124500, // 124.5k
    views: 1450200, // 1.5m
    isLiked: false,
    commentsCount: 382,
    location: 'London, Mayfair',
    city: 'London'
  },
  {
    id: 'vid_2',
    videoUrl: 'https://vtmaffcyvhnnmfibfswm.supabase.co/storage/v1/object/public/videos/shorts/393b5067-999e-4bde-a1bc-1a71e29fa365/1784071450957.mp4',
    creatorId: 'comp_2',
    caption: 'Warming up before the live show tonight! Grab your front-row passes now 🎫 #dance #performer [location:Miami, South Beach]',
    soundTrack: 'Deep House Beats (Lounge Mix)',
    likes: 85200, // 85.2k
    views: 980500, // 980.5k
    isLiked: true,
    commentsCount: 142,
    location: 'Miami, South Beach',
    city: 'Miami'
  },
  {
    id: 'vid_3',
    videoUrl: 'https://vtmaffcyvhnnmfibfswm.supabase.co/storage/v1/object/public/videos/shorts/0cac9f78-2a47-45f1-b4aa-f8dccdaa343d/1784080441834.mp4',
    creatorId: 'comp_3',
    caption: 'The look on my face when someone books the VIP package instantly ✨ #satisfying #luxury [location:Paris, Le Marais]',
    soundTrack: 'Natasha Rose - Sunset Chill',
    likes: 1890000, // 1.9m
    views: 2340000, // 2.3m
    isLiked: false,
    commentsCount: 1982,
    location: 'Paris, Le Marais',
    city: 'Paris'
  },
  {
    id: 'vid_4',
    videoUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
    creatorId: 'comp_4',
    caption: 'Neon body art session is live. Come watch the magic unfold! 🌌 #bodyart #glow [location:Dubai, Marina]',
    soundTrack: 'Mystic Lounge Soundscapes',
    likes: 9800, // 9.8k
    views: 45600, // 45.6k
    isLiked: false,
    commentsCount: 54,
    location: 'Dubai, Marina',
    city: 'Dubai'
  }
];

export const CAMPAIGNS: Campaign[] = [
  { 
    id: 'camp_1', 
    title: 'Bronze Rush', 
    price: '$5', 
    rawPrice: 5, 
    viewsBoost: 4500, 
    likesBoost: 1200, 
    color: 'from-amber-600 to-yellow-500',
    description: 'Perfect for new companions to kickstart visual momentum and test reactions.'
  },
  { 
    id: 'camp_2', 
    title: 'Silver Pulse', 
    price: '$12', 
    rawPrice: 12, 
    viewsBoost: 15500, 
    likesBoost: 4800, 
    color: 'from-slate-400 to-zinc-200',
    description: 'Increases local relevance and pushes content directly to Mayfair & Chelsea feeds.'
  },
  { 
    id: 'camp_3', 
    title: 'Gold Avalanche', 
    price: '$25', 
    rawPrice: 25, 
    viewsBoost: 52000, 
    likesBoost: 16500, 
    color: 'from-yellow-500 to-orange-400',
    description: 'Guarantees homepage feature placement and VIP email recommendations.'
  },
  { 
    id: 'camp_4', 
    title: 'VIP Nebula Surge', 
    price: '$50', 
    rawPrice: 50, 
    viewsBoost: 1250000, 
    likesBoost: 480000, 
    color: 'from-purple-600 to-pink-500',
    description: 'Maximal velocity: broadcasts to international premium members with pushes.'
  }
];
