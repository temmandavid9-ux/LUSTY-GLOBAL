export interface Companion {
  id: string;
  username: string;
  name: string;
  avatar: string;
  images: string[];
  isVIP: boolean;
  isOnline: boolean;
  age: number;
  height?: string;
  location: string;
  distance: string;
  distanceMiles?: number;
  ratePerHour: number;
  bio: string;
  tags: string[];
  rating: number;
  avg_rating?: number | null;
  reviewsCount: number;
  verifiedAt?: string;
  languages: string[];
  is_verified?: boolean;
  isVerified?: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  default_caption?: string;
  lastSeen?: string;
  created_at?: string;
}

export interface VideoItem {
  id: string;
  videoUrl: string;
  creatorId: string;
  caption: string;
  soundTrack: string;
  likes: number;
  views: number;
  isLiked: boolean;
  commentsCount: number;
  location?: string;
  city?: string;
}

export interface Comment {
  id: string;
  username: string;
  text: string;
  time: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  time: string;
  type: 'text' | 'image' | 'tip' | 'proposal' | 'voice';
  status?: 'sending' | 'sent' | 'failed';
  mediaUrl?: string;
  amount?: number;
  proposalDetails?: {
    date: string;
    duration: number;
    rate: number;
    location: string;
    status: 'pending' | 'accepted' | 'declined';
  };
}

export interface Chat {
  id: string;
  companionId: string;
  messages: Message[];
  unread: boolean;
}

export interface Booking {
  id: string;
  companionId: string;
  date: string;
  time: string;
  duration: number; // hours
  rate: number;
  location: string;
  status: 'pending' | 'confirmed' | 'escrowed' | 'completed' | 'cancelled' | 'paid_escrow' | 'pending_confirmation' | 'pending_transfer' | 'active' | 'funded';
  notes?: string;
  senderId?: string;
  senderUsername?: string;
  senderAvatar?: string;
  receiverId?: string;
  receiverUsername?: string;
  receiverAvatar?: string;
  escrowDeposit?: number;
  isVerified?: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  price: string;
  rawPrice: number;
  viewsBoost: number;
  likesBoost: number;
  color: string;
  description: string;
}
