import { useState, useEffect, useRef } from 'react';
import AgeGate from './components/AgeGate';
import { LustyGlobalLogo } from './components/LustyGlobalLogo';
import { WatermarkBackground } from './components/WatermarkBackground';
import LoginForm from './components/LoginForm';
import BiometricScanner from './components/BiometricScanner';
import ShortsFeedSystem from './components/ShortsFeedSystem';
import DirectoryView from './components/DirectoryView';
import CompanionMap from './components/CompanionMap';
import ChatView from './components/ChatView';
import { NotificationDropdown } from './components/NotificationDropdown';
import DirectBookingModal from './components/DirectBookingModal';
import SecurityPaymentGateway from './components/SecurityPaymentGateway';
import AdminDashboardView from './components/AdminDashboardView';
import VerificationPayoutDashboard, { VerificationBadge } from './components/VerificationPayoutDashboard';
import { PublicCompanionProfileView } from './components/PublicCompanionProfileView';
import { ChatUnreadBadge } from './components/ChatUnreadBadge';
import { useRealTimeNotifications } from './hooks/useRealTimeNotifications';
import { UnifiedAlertListener } from './components/UnifiedAlertListener';
import { COMPANIONS } from './data';
import { Companion, Booking } from './types';
import { supabase } from './lib/supabase';
import { initiateFlutterwavePayment } from './lib/flutterwave';
import { 
  Tv, 
  Users, 
  MapPin, 
  MessageSquare, 
  ShieldCheck, 
  Compass,
  Award,
  Camera
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function App() {
  // 1. Age Verification Gate State
  const [isAgeVerified, setIsAgeVerified] = useState(false);

  // 2. Auth Session State
  const [userProfile, setUserProfile] = useState<{ id: string; username: string; avatar: string } | null>(null);

  // 3. Biometric Security Gate State
  const [isBiometricPassed, setIsBiometricPassed] = useState(false);

  // 4. Current App Tab
  const [activeTab, setActiveTab] = useState<'feed' | 'directory' | 'map' | 'chat' | 'admin' | 'verification'>('feed');

  // Shared States
  const [activeCompanionIdForChat, setActiveCompanionIdForChat] = useState<string | null>(null);
  const [viewingPublicProfileId, setViewingPublicProfileId] = useState<string | null>(null);
  const [publicProfileDefaultTab, setPublicProfileDefaultTab] = useState<'about' | 'media'>('about');
  const [bookingCompanion, setBookingCompanion] = useState<Companion | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [escrowBalance, setEscrowBalance] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // System Theme Switcher State
  const [currentTheme, setCurrentTheme] = useState<'default' | 'vintage-neon' | 'cyber-luxe' | 'deep-void'>('default');

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'default';
    setCurrentTheme(savedTheme as any);
    if (savedTheme !== 'default') {
      document.body.className = savedTheme;
    } else {
      document.body.className = '';
    }

    // Handle /join/:username promo link referrals on startup
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/join/')) {
        const username = path.substring(6).trim();
        if (username) {
          localStorage.setItem('referred_by_host', username);
          console.log(`🎯 Fan tracking initiated. Referrer: @${username}`);
          
          // Show custom welcome toast matching LUSTY GLOBAL VIP design
          setTimeout(() => {
            toast.custom((t) => (
              <div
                className={`${
                  t.visible ? 'animate-in fade-in slide-in-from-top-4 duration-300' : 'animate-out fade-out slide-out-to-top-4 duration-300'
                } max-w-sm w-full bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl pointer-events-auto p-4 mt-2 flex items-center gap-3 text-left z-50`}
              >
                <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500 text-sm flex-shrink-0">
                  ✨
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-pink-500 uppercase tracking-wider font-sans">
                    Referral Activated!
                  </p>
                  <p className="text-[11px] text-zinc-300 font-medium font-sans mt-0.5">
                    You were invited by <span className="font-bold text-white">@{username}</span>. Claim your VIP lounge access below!
                  </p>
                </div>
              </div>
            ), { duration: 6500 });
          }, 1000);

          // Clean up URL path nicely to not confuse the user
          window.history.replaceState({}, '', window.location.origin + window.location.search);
        }
      }
    }

    // Request browser Notification API permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  const handleThemeChange = (theme: 'default' | 'vintage-neon' | 'cyber-luxe' | 'deep-void') => {
    setCurrentTheme(theme);
    localStorage.setItem('app-theme', theme);
    if (theme !== 'default') {
      document.body.className = theme;
    } else {
      document.body.className = '';
    }
    showToast(`Theme changed to ${theme === 'default' ? 'Classic Dark' : theme.replace('-', ' ')}!`);
  };

  // Profile dropdown states in App.tsx
  const [profile, setProfile] = useState<any>(null);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const mobileProfileDropdownRef = useRef<HTMLDivElement>(null);

  // Booking & Gallery States
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  // 5. Payment Gateway State
  const [pendingPayment, setPendingPayment] = useState<{
    amount: number;
    recipientUsername: string;
    recipientId: string;
    type: 'booking' | 'tip';
    bookingDetails?: Booking;
  } | null>(null);

  const restoreSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Pull metadata straight out of our permanent backend table row
        let profile = null;
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('username, is_verified, bio, current_balance, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle();
          if (error) throw error;
          profile = data;
          if (profile) {
            localStorage.setItem(`cached_profile_${session.user.id}`, JSON.stringify(profile));
          }
        } catch (dbErr) {
          console.warn("Could not query profiles during restoreSession, trying local cache:", dbErr);
          try {
            const stored = localStorage.getItem(`cached_profile_${session.user.id}`);
            if (stored) {
              profile = JSON.parse(stored);
            }
          } catch (storageErr) {
            console.error("Could not read local storage during restoreSession:", storageErr);
          }
        }

        if (!profile) {
          // If profile doesn't exist, auto-create it for a Google user
          const displayName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Google User';
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([
              {
                id: session.user.id,
                username: displayName,
                email: session.user.email
              }
            ])
            .select('username, is_verified, bio, current_balance, avatar_url')
            .maybeSingle();
          
          if (!insertError && newProfile) {
            profile = newProfile;
          } else {
            profile = { username: displayName, is_verified: false } as any;
          }
        }

        if (profile) {
          const fallbackAvatar = `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150`;
          const avatarUrl = (profile as any).avatar_url || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || fallbackAvatar;
          setUserProfile({
            id: session.user.id,
            username: profile.username,
            avatar: avatarUrl
          });
          setIsVerified(!!(profile as any).is_verified);
          // Auto bypass biometric if restored successfully
          setIsBiometricPassed(true);
        }
      }
    } catch (err) {
      console.error("Session restoration error:", err);
    }
  };

  // 1. Auto-check for an active, valid authentication token on mount
  useEffect(() => {
    restoreSession();
  }, []);

  const fetchFullProfile = async () => {
    if (!userProfile?.id) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userProfile?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setAvatarUrlInput(data.avatar_url || '');
        setGalleryImages(data.gallery_images || []);
        try {
          localStorage.setItem(`cached_profile_${userProfile.id}`, JSON.stringify(data));
        } catch (e) {
          console.warn("Could not save profile cache to localStorage:", e);
        }
      } else {
        const fallbackData = {
          id: userProfile?.id,
          username: userProfile?.username,
          bio: 'Verified VIP guest. Rates available on demand 🔒',
          current_balance: 1450.00,
          views_count: 1250,
          is_verified: isVerified,
          hourly_rate: 0,
          full_time_rate: 0,
          age: '',
          height: '',
          gallery_images: []
        };
        setProfile(fallbackData);
        setAvatarUrlInput('');
        setGalleryImages([]);
      }
    } catch (err) {
      console.warn("Failed to load profile in App.tsx, attempting local cache restore:", err);
      
      let offlineData = null;
      try {
        const stored = localStorage.getItem(`cached_profile_${userProfile.id}`);
        if (stored) {
          offlineData = JSON.parse(stored);
          if (offlineData) {
            offlineData.is_offline = true;
          }
        }
      } catch (storageErr) {
        console.warn("Failed to retrieve cached profile from localStorage:", storageErr);
      }

      if (!offlineData) {
        offlineData = {
          id: userProfile?.id,
          username: userProfile?.username,
          bio: 'Verified VIP guest. Rates available on demand 🔒 (Offline)',
          current_balance: 1450.00,
          views_count: 1250,
          is_verified: isVerified,
          hourly_rate: 0,
          full_time_rate: 0,
          age: '',
          height: '',
          gallery_images: [],
          is_offline: true
        };
      }
      
      setProfile(offlineData);
      setAvatarUrlInput(offlineData.avatar_url || '');
      setGalleryImages(offlineData.gallery_images || []);
    }
  };

  // Load full profile details whenever userProfile or verification status updates, or when any component dispatches a 'wallet-withdrawn' event
  useEffect(() => {
    fetchFullProfile();

    const handleWalletWithdrawn = () => {
      console.log("Wallet withdrawn event captured, synchronizing App.tsx profile state...");
      fetchFullProfile();
    };

    const handleLoungeBooking = (e: Event) => {
      const customEvent = e as CustomEvent;
      const hostId = customEvent.detail?.hostId;
      if (hostId) {
        handleOpenBooking(hostId);
      }
    };

    const handleLoungeTabChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tab = customEvent.detail?.tab;
      if (tab) {
        setActiveTab(tab);
      }
    };

    const handleLoungeChat = (e: Event) => {
      const customEvent = e as CustomEvent;
      const companionId = customEvent.detail?.companionId;
      if (companionId) {
        handleStartChat(companionId);
      }
    };

    const handleLoungeViewProfile = (e: Event) => {
      const customEvent = e as CustomEvent;
      const hostId = customEvent.detail?.hostId;
      const defaultTab = customEvent.detail?.defaultTab || 'about';
      if (hostId) {
        setViewingPublicProfileId(hostId);
        setPublicProfileDefaultTab(defaultTab);
      }
    };

    window.addEventListener('wallet-withdrawn', handleWalletWithdrawn);
    window.addEventListener('lounge-booking', handleLoungeBooking);
    window.addEventListener('lounge-tab-change', handleLoungeTabChange);
    window.addEventListener('lounge-chat', handleLoungeChat);
    window.addEventListener('lounge-view-profile', handleLoungeViewProfile);
    return () => {
      window.removeEventListener('wallet-withdrawn', handleWalletWithdrawn);
      window.removeEventListener('lounge-booking', handleLoungeBooking);
      window.removeEventListener('lounge-tab-change', handleLoungeTabChange);
      window.removeEventListener('lounge-chat', handleLoungeChat);
      window.removeEventListener('lounge-view-profile', handleLoungeViewProfile);
    };
  }, [userProfile?.id, isVerified]);

  // ⚡ Step 3: Broadcast Active Presence on User Mount
  useEffect(() => {
    if (!userProfile?.id) return;

    // 1. Immediately set presence to true upon component initialization mount
    const updatePresence = async (status: boolean) => {
      try {
        await supabase
          .from('profiles')
          .update({ 
            is_online: status,
            last_seen: new Date().toISOString()
          })
          .eq('id', userProfile.id);
      } catch (err) {
        console.warn("Failed to update dynamic presence heartbeat:", err);
      }
    };

    updatePresence(true);

    // Set up active presence interval heartbeat every 2 minutes
    const interval = setInterval(() => {
      updatePresence(true);
    }, 2 * 60 * 1000);

    // 2. Clear status automatically when user closes the app browser tab window
    const handleVisibilityOrUnmount = () => {
      updatePresence(false);
    };

    window.addEventListener('beforeunload', handleVisibilityOrUnmount);
    return () => {
      clearInterval(interval);
      updatePresence(false);
      window.removeEventListener('beforeunload', handleVisibilityOrUnmount);
    };
  }, [userProfile?.id]);

  // Listen for hash change routing triggers to route guest directly into Escrow Vault
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#escrow-vault') {
        setActiveTab('admin');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Load bookings from Supabase when userProfile is available to sync escrow and host dashboards
  useEffect(() => {
    if (!userProfile?.id) {
      setBookings([]);
      return;
    }

    async function fetchBookings() {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data && data.length > 0) {
          const mapped: Booking[] = data.map((b: any) => ({
            id: b.id || `booking_${b.companion_id}_${b.created_at || Date.now()}`,
            companionId: b.companion_id,
            date: b.date || (b.created_at ? new Date(b.created_at).toLocaleDateString() : new Date().toLocaleDateString()),
            time: b.time || (b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
            duration: Number(b.duration_hours || b.duration || 1),
            rate: Number(b.hourly_rate_at_booking || b.rate || 250),
            location: b.location || 'London, Mayfair',
            status: b.status === 'pending' ? 'escrowed' : b.status,
            notes: b.notes || 'Supabase unified booking row'
          }));
          setBookings(mapped);
          
          // Calculate active escrow held
          const activeEscrows = mapped
            .filter(b => b.status === 'escrowed' || b.status === 'pending')
            .reduce((sum, b) => sum + (b.rate * b.duration), 0);
          setEscrowBalance(activeEscrows);
        }
      } catch (err) {
        console.warn("Could not sync remote bookings, using local bookings database state:", err);
      }
    }
    fetchBookings();
  }, [userProfile?.id]);

  // Handle clicking outside the profile dropdown to dismiss it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const clickedOutsideDesktop = !profileDropdownRef.current || !profileDropdownRef.current.contains(event.target as Node);
      const clickedOutsideMobile = !mobileProfileDropdownRef.current || !mobileProfileDropdownRef.current.contains(event.target as Node);
      if (clickedOutsideDesktop && clickedOutsideMobile) {
        setShowProfileDetails(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);



  const handleSaveAvatar = async (url: string) => {
    try {
      if (!userProfile?.id) return;
      setProfile((prev: any) => ({ ...prev, avatar_url: url }));
      setUserProfile((prev: any) => prev ? { ...prev, avatar: url } : null);
      
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', userProfile.id);

      if (error) throw error;
      showToast("Profile image updated successfully!");
    } catch (err) {
      console.warn("Error saving avatar in App.tsx:", err);
      showToast("Avatar updated locally");
    }
  };

  // Handler to add an image link to the 4-image gallery
  const handleAddGalleryImage = async () => {
    if (!userProfile?.id || !newImageUrl) return;
    if (galleryImages.length >= 4) {
      showToast("You can only showcase a maximum of 4 profile gallery images!");
      return;
    }

    const updatedGallery = [...galleryImages, newImageUrl];
    setGalleryImages(updatedGallery);
    setNewImageUrl('');
    
    // Update local profile state
    setProfile((prev: any) => ({
      ...prev,
      gallery_images: updatedGallery
    }));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ gallery_images: updatedGallery })
        .eq('id', userProfile.id);

      if (error) throw error;
      showToast("Gallery image added!");
    } catch (err) {
      console.error("Error saving gallery image:", err);
      showToast("Error saving gallery image");
    }
  };

  // Handler to remove a gallery image slot
  const handleRemoveImage = async (indexToRemove: number) => {
    if (!userProfile?.id) return;
    const updatedGallery = galleryImages.filter((_, idx) => idx !== indexToRemove);
    setGalleryImages(updatedGallery);
    
    // Update local profile state
    setProfile((prev: any) => ({
      ...prev,
      gallery_images: updatedGallery
    }));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ gallery_images: updatedGallery })
        .eq('id', userProfile.id);
        
      if (error) throw error;
      showToast("Gallery image removed");
    } catch (err) {
      console.error("Error updating gallery array:", err);
      showToast("Error removing gallery image");
    }
  };

  // 2. Listen to OAuth success messages in the parent/opener window
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const session = event.data.session;
        if (session?.user) {
          await restoreSession();
          showToast(`Welcome back, @${session.user.user_metadata?.full_name || session.user.email?.split('@')[0]}!`);
        }
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  // 3. Process the OAuth hash redirect and notify the parent if inside a popup
  useEffect(() => {
    let active = true;
    let unsubscribeFn: (() => void) | null = null;

    if (window.opener && (window.location.hash.includes('access_token') || window.location.search.includes('code='))) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (active && session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', session }, '*');
          setTimeout(() => {
            window.close();
          }, 150);
        }
      });
      unsubscribeFn = () => subscription.unsubscribe();
    }

    return () => {
      active = false;
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, []);

  // Custom Toast notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Real-time notifications for user's content receiving a new like or view
  useRealTimeNotifications(userProfile?.id || '', showToast);

  const handleAgeVerify = () => {
    setIsAgeVerified(true);
    showToast("Age verified successfully!");
  };

  const handleLoginSuccess = async (username: string, avatar: string, userId: string) => {
    setUserProfile({ id: userId, username, avatar });
    
    // Check if user is already verified in database
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_verified')
        .eq('id', userId)
        .maybeSingle();
      if (profile) {
        setIsVerified(!!(profile as any).is_verified);
      }
    } catch (e) {
      console.warn(e);
    }

    showToast(`Welcome, @${username}! Complete Biometrics check.`);
  };

  const handleBiometricSuccess = () => {
    setIsBiometricPassed(true);
    showToast("Identity verified! Welcome to the Live Lounge.");
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn(e);
    }
    setUserProfile(null);
    setIsVerified(false);
    setIsBiometricPassed(false);
    showToast("Session disconnected.");
  };

  // Launch chat with specific companion
  const handleStartChat = (companionId: string) => {
    setActiveCompanionIdForChat(companionId);
    setActiveTab('chat');
  };

  // Launch booking modal for companion
  const handleOpenBooking = async (companionId: string) => {
    let companion = COMPANIONS.find(c => c.id === companionId);
    if (!companion) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', companionId)
          .maybeSingle();

        if (profile) {
          const rawTags = Array.isArray(profile.tags) ? profile.tags : [];
          const tags = rawTags.map((t: string) => t.startsWith('#') ? t.substring(1) : t);
          companion = {
            id: profile.id,
            username: profile.username || 'anonymous',
            name: profile.name || profile.username || 'Anonymous Host',
            avatar: profile.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            images: [
              profile.cover_image_url || profile.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600'
            ],
            isVIP: !!(profile.is_verified || profile.tier_badge === 'VIP SELECT'),
            is_verified: !!profile.is_verified,
            isVerified: !!profile.is_verified,
            isOnline: profile.is_online === true || (profile.last_seen && new Date(profile.last_seen).getTime() > Date.now() - 5 * 60 * 1000),
            age: profile.age || 24,
            location: profile.location || 'London, Mayfair',
            distance: profile.distance || '0.8 miles away',
            ratePerHour: profile.hourly_rate || 250,
            bio: profile.bio || 'Verified VIP guest. Rates available on demand 🔒',
            tags: tags,
            rating: (profile.is_verified || profile.tier_badge === 'VIP SELECT') ? 5.0 : (profile.rating || 4.9),
            avg_rating: (profile.is_verified || profile.tier_badge === 'VIP SELECT') ? 5.0 : (profile.avg_rating || profile.rating || 4.9),
            reviewsCount: profile.reviews_count || 42,
            verifiedAt: profile.verified_at || 'June 2026',
            languages: profile.languages || ['English']
          };
        }
      } catch (err) {
        console.warn("Error looking up profile for booking:", err);
      }
    }

    if (companion) {
      setBookingCompanion(companion);
    }
  };

  // Submit rendezvous booking proposal
  const handleBookingSubmit = async (booking: Booking) => {
    let companion = COMPANIONS.find(c => c.id === booking.companionId);
    if (!companion) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', booking.companionId)
          .maybeSingle();

        if (profile) {
          const rawTags = Array.isArray(profile.tags) ? profile.tags : [];
          const tags = rawTags.map((t: string) => t.startsWith('#') ? t.substring(1) : t);
          companion = {
            id: profile.id,
            username: profile.username || 'anonymous',
            name: profile.name || profile.username || 'Anonymous Host',
            avatar: profile.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            images: [
              profile.cover_image_url || profile.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600'
            ],
            isVIP: !!(profile.is_verified || profile.tier_badge === 'VIP SELECT'),
            is_verified: !!profile.is_verified,
            isVerified: !!profile.is_verified,
            isOnline: profile.is_online === true || (profile.last_seen && new Date(profile.last_seen).getTime() > Date.now() - 5 * 60 * 1000),
            age: profile.age || 24,
            location: profile.location || 'London, Mayfair',
            distance: profile.distance || '0.8 miles away',
            ratePerHour: profile.hourly_rate || 250,
            bio: profile.bio || 'Verified VIP guest. Rates available on demand 🔒',
            tags: tags,
            rating: (profile.is_verified || profile.tier_badge === 'VIP SELECT') ? 5.0 : (profile.rating || 4.9),
            avg_rating: (profile.is_verified || profile.tier_badge === 'VIP SELECT') ? 5.0 : (profile.avg_rating || profile.rating || 4.9),
            reviewsCount: profile.reviews_count || 42,
            verifiedAt: profile.verified_at || 'June 2026',
            languages: profile.languages || ['English']
          };
        }
      } catch (err) {
        console.warn("Error looking up profile for booking submit:", err);
      }
    }

    if (!companion) {
      companion = COMPANIONS[0];
    }

    const basePrice = companion.ratePerHour * booking.duration;
    const bookerFee = 1.00;
    const totalCost = basePrice + bookerFee;
    const deposit = Math.round(totalCost * 0.3);

    // Queue secure deposit payment checkout
    setPendingPayment({
      amount: deposit,
      recipientUsername: companion.username,
      recipientId: companion.id,
      type: 'booking',
      bookingDetails: booking
    });

    setBookingCompanion(null);
    showToast(`Rendezvous booking proposal for @${companion.username} submitted successfully!`);
    window.dispatchEvent(new CustomEvent("booking-updated"));
  };

  // Implement the Direct Tip Handler using a secure direct debit card pipeline
  const handleSendDirectCardTip = async (recipientId: string, inputAmount: number, targetVideoId?: string) => {
    const currentUser = userProfile;
    if (!currentUser?.id) {
      alert("Please sign in to complete this payment.");
      return;
    }

    try {
      // 1️⃣ STEP ONE: Guard Clause - Check if the sender has a linked card
      const { data: profileStatus, error: profileError } = await supabase
        .from('profiles')
        .select('has_payment_method')
        .eq('id', currentUser.id)
        .single();

      // If there's an error retrieving the card, or if no card is explicitly marked as linked
      if (profileError || !profileStatus || !profileStatus.has_payment_method) {
        // 🛑 STOP right here. Do not forward the tip, do not write to the ledger.
        alert("Payment Failed: Please link a valid debit card in your billing profile before sending tips.");
        return;
      }

      // 2️⃣ STEP TWO: Fetch recipient's profile to build or resolve Flutterwave subaccount
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('settlement_bank_code, settlement_account_number, settlement_account_name')
        .eq('id', recipientId)
        .maybeSingle();

      let hostSubaccountId = null;
      if (recipientProfile?.settlement_bank_code && recipientProfile?.settlement_account_number) {
        try {
          const subRes = await fetch("https://vtmaffcyvhnnmfibfswm.supabase.co/functions/v1/create-subaccount", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              bank_code: recipientProfile.settlement_bank_code,
              account_number: recipientProfile.settlement_account_number,
              business_name: recipientProfile.settlement_account_name || "Lusty Creator Split",
              business_email: "host-billing@lustyglobal.vip"
            })
          });
          if (subRes.ok) {
            const subData = await subRes.json();
            if (subData.success && subData.subaccount_id) {
              hostSubaccountId = subData.subaccount_id;
            }
          }
        } catch (e) {
          console.warn("Could not resolve recipient subaccount:", e);
        }
      }

      console.log(`Spinning up secure Flutterwave checkout for $${inputAmount.toFixed(2)} with Subaccount: ${hostSubaccountId || 'None'}...`);
      
      // 🎯 FLUTTERWAVE GATEWAY EXECUTION
      await initiateFlutterwavePayment({
        amount: inputAmount,
        currency: "USD",
        email: currentUser.username ? `${currentUser.username}@lustyglobal.vip` : "user@lustyglobal.vip",
        name: currentUser.username || "VIP Member",
        description: `Direct Creator Tip of $${inputAmount.toFixed(2)}`,
        hostSubaccountId: hostSubaccountId,
        callback: async (response: any) => {
          if (response.status === "successful" || response.status === "completed" || response.success) {
            const paymentGatewayRef = response.transaction_id || response.tx_ref || `TRX-${Date.now()}`;
            
            // 1. Instantly show success UI and send chat logs (non-blocking)
            alert(`💳 Transaction Approved! Your direct tip of $${inputAmount.toFixed(2)} has been forwarded successfully via Flutterwave.`);

            // Send chat message in background
            const textContent = `💸 Sent a $${inputAmount} Direct Card Tip!`;
            (async () => {
              try {
                await supabase.from('chat_messages').insert([
                  {
                    sender_id: currentUser.id,
                    receiver_id: recipientId,
                    message_text: JSON.stringify({ text: textContent, type: 'tip' }),
                    is_read: false
                  }
                ]);
              } catch (msgErr: any) {
                console.warn("Could not log chat message for tip:", msgErr);
              }
            })();

            // Trigger delayed host thank you reply
            setTimeout(async () => {
              const thankYouReplies = [
                `Wow, thank you so much for the gorgeous tip! 😍 You are a perfect gentleman. I am locking in extra priority for your booking!`,
                `Oh! That is extremely sweet of you! ❤️ I really appreciate your gesture. When are we meeting?`,
                `A secure tip transfer received! Thank you, darling. Let's arrange our private rendezvous session soon.`
              ];
              const replyText = thankYouReplies[Math.floor(Math.random() * thankYouReplies.length)];
              try {
                await supabase.from('chat_messages').insert([
                  {
                    sender_id: recipientId,
                    receiver_id: currentUser.id,
                    message_text: replyText,
                    is_read: false
                  }
                ]);
              } catch (replyErr) {
                console.warn("Could not insert reply:", replyErr);
              }
            }, 1500);

            // 2. Write directly to platform ledger & tips tables in background with a 5-second timeout safety net
            const ledgerTask = (async () => {
              const { error: ledgerError } = await supabase
                .from('platform_ledger')
                .insert([{
                  sender_id: currentUser.id,
                  recipient_id: recipientId,
                  video_id: targetVideoId || null,
                  amount: inputAmount,
                  currency: 'USD',
                  payment_gateway_ref: paymentGatewayRef,
                  transaction_type: 'tip',
                  settlement_status: 'pending' // Ready for automatic transfer payouts or pull withdrawals
                }]);

              if (ledgerError) throw ledgerError;

              // Write to 'tips' table to automatically calculate the 15% platform split
              const { error: tipsError } = await supabase
                .from('tips')
                .insert([{
                  sender_id: currentUser.id,
                  receiver_id: recipientId,
                  gross_amount: inputAmount
                }]);
              if (tipsError) {
                console.warn("Failed to log to tips table in background:", tipsError);
              }

              // Log unified audit history
              try {
                await supabase.from('transaction_history').insert([{
                  sender_id: currentUser.id,
                  receiver_id: recipientId,
                  transaction_type: 'tip',
                  status: 'completed',
                  gross_amount: inputAmount,
                  platform_fee: inputAmount * 0.15,
                  net_payout: inputAmount * 0.85,
                  tx_ref: paymentGatewayRef
                }]);
              } catch (histErr) {
                console.warn("Unified transaction log error for tip (ignored):", histErr);
              }
            })();

            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Tip ledger write timed out')), 5000)
            );

            try {
              await Promise.race([ledgerTask, timeoutPromise]);
            } catch (ledgerErr: any) {
              console.error("Ledger logging error/timeout (non-blocking for user):", ledgerErr.message);
              // Log to administrative alert table for manual review (robustly caught)
              try {
                await supabase.from('payment_errors').insert([{
                  tx_ref: paymentGatewayRef,
                  amount: inputAmount,
                  error_msg: `Direct Tip Ledger Error: ${ledgerErr.message || 'Timeout'}`
                }]);
              } catch (logErr) {
                console.warn("Failed to log to payment_errors table (likely missing):", logErr);
              }
            }
          } else {
            alert("Payment verification failed or was declined.");
          }
        },
        onClose: () => {
          console.log("Flutterwave payment modal closed.");
        }
      });

    } catch (err) {
      console.error("Critical payment tracking pipeline fault:", err);
      alert("Payment captured but ledger logging timed out. Contact support.");
    }
  };

  // Handle direct tips from chat
  const handleSendTip = async (companionId: string, amount: number) => {
    await handleSendDirectCardTip(companionId, amount);
  };

  // Complete Payment checkout successfully
  const handlePaymentSuccess = async () => {
    if (!pendingPayment) return;

    if (pendingPayment.type === 'booking' && pendingPayment.bookingDetails) {
      const confirmedBooking: Booking = {
        ...pendingPayment.bookingDetails,
        status: 'escrowed'
      };
      setBookings(prev => [confirmedBooking, ...prev]);
      setEscrowBalance(prev => prev + pendingPayment.amount);
      showToast(`Rendezvous reserved! $${pendingPayment.amount} escrow contract created.`);
    } else if (pendingPayment.type === 'tip') {
      showToast(`Sent a secure tip of $${pendingPayment.amount} to @${pendingPayment.recipientUsername}!`);
      
      // Deduct from wallet balance as well
      handleWalletDeduction(pendingPayment.amount);

      // 🛠️ SUCCESS: Only push to messages table if the payment went through
      const textContent = `💸 Sent a $${pendingPayment.amount} Tip Token!`;
      try {
        await supabase.from('chat_messages').insert([
          {
            sender_id: userProfile?.id || '',
            receiver_id: pendingPayment.recipientId,
            message_text: JSON.stringify({ text: textContent, type: 'tip' }),
            is_read: false
          }
        ]);

        // Trigger delayed host thank you reply
        const recipientId = pendingPayment.recipientId;
        setTimeout(async () => {
          const thankYouReplies = [
            `Wow, thank you so much for the gorgeous tip! 😍 You are a perfect gentleman. I am locking in extra priority for your booking!`,
            `Oh! That is extremely sweet of you! ❤️ I really appreciate your gesture. When are we meeting?`,
            `A secure tip transfer received! Thank you, darling. Let's arrange our private rendezvous session soon.`
          ];
          const replyText = thankYouReplies[Math.floor(Math.random() * thankYouReplies.length)];
          try {
            await supabase.from('chat_messages').insert([
              {
                sender_id: recipientId,
                receiver_id: userProfile?.id || '',
                message_text: replyText,
                is_read: false
              }
            ]);
          } catch (err) {
            console.warn("Failed to write auto-reply to Supabase:", err);
          }
        }, 2000);

      } catch (err) {
        console.warn("Failed to complete tip record inserts in Supabase:", err);
      }
    }

    setPendingPayment(null);
  };

  const handleWalletDeduction = (amount: number) => {
    setEscrowBalance(prev => prev + amount);
    if (profile) {
      const nextBal = Math.max(0, (profile.current_balance || 1450.00) - amount);
      setProfile((prev: any) => ({
        ...prev,
        current_balance: nextBal,
        token_balance: nextBal
      }));
      // Persist user wallet balance update in Supabase
      if (userProfile?.id) {
        supabase
          .from('profiles')
          .update({ 
            current_balance: nextBal,
            token_balance: nextBal
          })
          .eq('id', userProfile.id)
          .then(({ error }) => {
            if (error) console.warn("Failed to update wallet balance in database:", error);
          });
      }
    }
  };

  const handleTopUp = async (amount: number) => {
    if (!userProfile?.id) return;
    const currentBal = profile?.current_balance || 0;
    const nextBal = currentBal + amount;
    setProfile((prev: any) => ({
      ...prev,
      current_balance: nextBal,
      token_balance: nextBal
    }));
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          current_balance: nextBal,
          token_balance: nextBal
        })
        .eq('id', userProfile.id);
      if (error) throw error;
      showToast(`Topped up $${amount} via linked card successfully!`);
    } catch (err) {
      console.warn("Top-up database update warning:", err);
      showToast(`Topped up $${amount} locally`);
    }
  };

  const handleSpendFunds = async (amount: number) => {
    if (!userProfile?.id) return;
    const currentBal = profile?.current_balance || 1450.00;
    const nextBal = Math.max(0, currentBal - amount);
    setProfile((prev: any) => ({
      ...prev,
      current_balance: nextBal,
      token_balance: nextBal
    }));
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          current_balance: nextBal,
          token_balance: nextBal
        })
        .eq('id', userProfile.id);
      if (error) throw error;
      // Dispatch event to sync balances globally
      window.dispatchEvent(new CustomEvent('wallet-withdrawn'));
    } catch (err) {
      console.warn("Deduction database update warning:", err);
    }
  };

  const handleDirectAddBooking = (newBooking: Booking) => {
    setBookings(prev => [newBooking, ...prev]);
  };

  // Render correct view based on tab selection
  const renderActiveView = () => {
    switch (activeTab) {
      case 'feed':
        return (
          <ShortsFeedSystem 
            walletBalance={profile?.current_balance !== undefined && profile?.current_balance !== null ? profile.current_balance : 1450.00}
            onSpendFunds={handleSpendFunds}
            currentUserId={userProfile?.id}
          />
        );
      case 'directory':
        return (
          <DirectoryView 
            onStartChat={handleStartChat} 
            currentUser={userProfile}
            onWalletDeduction={handleWalletDeduction}
            onAddBooking={handleDirectAddBooking}
          />
        );
      case 'map':
        return (
          <CompanionMap 
            onStartChat={handleStartChat} 
            onOpenBooking={handleOpenBooking} 
          />
        );
      case 'chat':
        return (
          <ChatView 
            activeCompanionId={activeCompanionIdForChat} 
            onOpenBooking={handleOpenBooking} 
            onSendTip={handleSendTip} 
            currentUserId={userProfile?.id || ''}
            currentBalance={profile?.current_balance || 1450.00}
            onTopUp={handleTopUp}
          />
        );
      case 'admin':
        return (
          <AdminDashboardView 
            bookings={bookings} 
            escrowBalance={escrowBalance} 
            currentUserProfile={profile}
            onRefreshProfile={fetchFullProfile}
          />
        );
      case 'verification':
        return (
          <VerificationPayoutDashboard 
            userProfile={userProfile!} 
            isVerified={isVerified} 
            onVerifySuccess={async () => {
              setIsVerified(true);
              // Synchronize the parent userProfile object state immediately
              setUserProfile((prev: any) => prev ? { ...prev, is_verified: true, verified: 'true' } : prev);
              showToast("Prestige Verification Approved!");
              if (userProfile?.id) {
                try {
                  await supabase
                    .from('profiles')
                    .update({ 
                      is_verified: true,
                      verified: 'true'
                    })
                    .eq('id', userProfile.id);
                } catch (err) {
                  console.warn("Failed to persist verification status to Supabase:", err);
                }
              }
            }} 
            escrowBalance={escrowBalance} 
            onLogout={handleLogout}
          />
        );
      default:
        return <ShortsFeedSystem currentUserId={userProfile?.id} />;
    }
  };

  const renderBreakoutDropdown = () => {
    if (!showProfileDetails || !userProfile) return null;
    return (
      <div 
        className="absolute right-0 top-full mt-3 w-[290px] xs:w-80 md:w-96 bg-zinc-950 border border-zinc-800 rounded-3xl p-4 md:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-[9999] block animate-fadeIn text-left max-h-[80vh] overflow-y-auto no-scrollbar"
        style={{ display: 'block', visibility: 'visible', opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Identity & Avatar Editing Section */}
        <div className="flex flex-col border-b border-zinc-900 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={userProfile.avatar} 
                alt="Expanded Profile" 
                className="w-14 h-14 rounded-full border-2 border-pink-500 object-cover bg-zinc-900"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingAvatar(!isEditingAvatar);
                }}
                className="absolute -bottom-1 -right-1 bg-pink-500 hover:bg-pink-600 text-zinc-950 rounded-full p-1 border border-zinc-950 transition duration-150 shadow-md cursor-pointer flex items-center justify-center"
                title="Update profile avatar"
              >
                <Camera className="w-3.5 h-3.5 text-black" />
              </button>
            </div>
            <div>
              <h4 className="text-sm font-black text-zinc-100 flex items-center gap-1.5">
                @{userProfile.username}
                {isVerified && <span className="text-pink-400 text-xs">✔</span>}
              </h4>
              <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded font-mono uppercase font-bold tracking-wider">
                {isVerified ? "VIP PRESTIGE HOST" : "STANDARD TIER"}
              </span>
            </div>
          </div>

          {/* Inline Profile Avatar Customization Suite */}
          {isEditingAvatar && (
            <div className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800 space-y-3 mt-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                <span>Change Avatar</span>
                <button 
                  type="button" 
                  onClick={() => setIsEditingAvatar(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  Cancel
                </button>
              </div>

              {/* File upload from device */}
              <div>
                <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1">Upload Device File</label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          handleSaveAvatar(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-[10px] text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-semibold file:bg-pink-500/10 file:text-pink-400 hover:file:bg-pink-500/20 cursor-pointer"
                />
              </div>

              {/* Text URL paste */}
              <div>
                <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1">Or Paste Image URL</label>
                <div className="flex gap-1.5">
                  <input 
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                    className="flex-1 bg-black text-[10px] text-zinc-100 rounded px-2 py-1 border border-zinc-800 focus:outline-none focus:border-pink-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (avatarUrlInput) handleSaveAvatar(avatarUrlInput);
                    }}
                    className="bg-pink-500 hover:bg-pink-600 text-zinc-950 font-extrabold text-[10px] px-2.5 rounded transition duration-150"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Portrait avatar presets */}
              <div>
                <span className="text-[8px] font-mono text-zinc-500 uppercase block mb-1.5">Model Presets</span>
                <div className="flex gap-2.5">
                  {[
                    { name: 'Sofia', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
                    { name: 'Elena', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150' },
                    { name: 'Chloe', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
                    { name: 'Amara', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' }
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setAvatarUrlInput(preset.url);
                        handleSaveAvatar(preset.url);
                      }}
                      className="relative rounded-full focus:outline-none cursor-pointer"
                      title={`Select ${preset.name}`}
                    >
                      <img 
                        src={preset.url} 
                        alt={preset.name} 
                        className={`w-8 h-8 rounded-full border-2 object-cover transition ${
                          userProfile.avatar === preset.url ? 'border-pink-500 scale-110' : 'border-zinc-800 hover:border-zinc-500'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>



        {/* 3. Integrated Financial Wallet Section */}
        <div className="space-y-3 my-4">
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 flex justify-between items-center">
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase font-mono">User Vault Balance (Escrow)</span>
              <div className="text-sm font-bold font-mono text-emerald-400">
                ${escrowBalance.toLocaleString()} USD
              </div>
            </div>
            <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded font-bold font-mono uppercase tracking-wider">🔒 Escrow Active</span>
          </div>

          {/* ── Direct Processing Billing Node ── */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 bg-zinc-900 border border-zinc-800/60 px-2.5 py-2.5 rounded-xl flex items-center gap-1.5 w-full justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Direct Card Settlement Active
            </span>
          </div>
        </div>

        {/* 🖼️ SECTION 2: SHOWCASE GALLERY (MAX 4 IMAGES) */}
        <div className="border-t border-zinc-900 pt-3 mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase text-pink-500 tracking-wider block">📸 Profile Showcase Gallery ({galleryImages.length}/4)</span>
          </div>

          {/* Display Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((index) => {
              const imgUrl = galleryImages[index];
              return (
                <div key={index} className="aspect-square bg-zinc-950 border border-zinc-900 rounded-lg overflow-hidden relative group flex items-center justify-center">
                  {imgUrl ? (
                    <>
                      <img src={imgUrl} alt={`Showcase slot ${index}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-0.5 right-0.5 bg-red-600/90 hover:bg-red-700 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="text-zinc-700 text-[10px] font-mono">+{index + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add image sub-row */}
          {galleryImages.length < 4 && (
            <div className="flex gap-1 pt-1">
              <input 
                type="text" 
                placeholder="Paste showcase image link..." 
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="flex-1 bg-black border border-zinc-850 p-1.5 rounded text-[11px] text-zinc-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddGalleryImage}
                className="bg-pink-600 hover:bg-pink-500 text-zinc-100 px-2.5 rounded text-xs font-bold font-mono"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* 🎨 BRANDING THEME SELECTOR PRESETS */}
        <div className="border-t border-zinc-900 pt-3 mt-3 space-y-2">
          <span className="text-[10px] font-mono uppercase text-pink-500 tracking-wider block">🎨 Select App Style Preset</span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'default', label: 'Classic Dark', color: 'bg-zinc-950 border-zinc-800' },
              { id: 'vintage-neon', label: 'Vintage Neon', color: 'bg-[#120424] border-pink-500/30' },
              { id: 'cyber-luxe', label: 'Cyber Luxe', color: 'bg-[#0d121c] border-yellow-500/30' },
              { id: 'deep-void', label: 'Deep Void', color: 'bg-black border-zinc-900' }
            ].map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeChange(theme.id as any)}
                className={`p-2 rounded-xl border text-[10px] font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                  currentTheme === theme.id 
                    ? 'border-pink-500 text-pink-500 scale-[1.02] font-black shadow-lg shadow-pink-500/10' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 bg-zinc-900/40'
                }`}
              >
                <span className={`w-3 h-3 rounded-full mb-1 border border-white/10 ${theme.color}`} />
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Action Suite / Logout */}
        <div className="pt-2 border-t border-zinc-900 mt-2">
          <button
            type="button"
            onClick={() => {
              setShowProfileDetails(false);
              const confirmAction = window.confirm("Are you sure you want to log out of your session?");
              if (confirmAction) {
                handleLogout();
              }
            }}
            className="w-full text-left p-3 hover:bg-red-950/20 rounded-2xl text-xs font-bold text-red-400 hover:text-red-300 transition duration-150 flex items-center gap-2 cursor-pointer"
          >
            <span>🚪</span> Secure Logout
          </button>
        </div>
      </div>
    );
  };

  // Step 1: Age Gate Check
  if (!isAgeVerified) {
    return <AgeGate onVerify={handleAgeVerify} />;
  }

  // Step 2: Guest Authentication Check
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Step 3: Biometric Credential Check
  if (!isBiometricPassed) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />
        <BiometricScanner 
          onSuccess={handleBiometricSuccess} 
          title="Verifying VIP Member Key"
          subtitle={`Securing workspace credentials for guest @${userProfile.username}`}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] bg-[#09090b] text-zinc-100 flex flex-col items-center relative select-none font-sans overflow-hidden">
      
      {/* 🛡️ 1. The subtle ambient background watermark */}
      <WatermarkBackground />
      
      {/* Toast Notification */}
      {toastMessage && (
        <div id="app-global-toast" className="fixed top-5 z-50 bg-zinc-900 border border-pink-500/30 px-4 py-2.5 rounded-xl text-xs text-pink-300 font-mono shadow-xl flex items-center gap-2 animate-bounce">
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* React Hot Toast Notifications Container */}
      <Toaster position="top-center" reverseOrder={false} />

      {/* Main Container */}
      <div className="w-full max-w-5xl flex flex-col h-full overflow-hidden md:py-6 px-0 md:px-4">
        
        {/* ── 📌 GLOBAL STICKY HEADER (Standardized) ── */}
        {activeTab !== 'feed' && (
          <header className="md:hidden sticky top-0 z-50 bg-[#090b0e]/95 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-zinc-900/50 shrink-0">
            {/* ── 🔥 OFFICIAL BRAND LOGO ALIGNMENT MATRIX ── */}
            <LustyGlobalLogo />

            {/* Connected Profile Node Menu */}
            <div className="relative flex items-center gap-3 z-50 pointer-events-auto" ref={mobileProfileDropdownRef}>
              <button 
                type="button"
                onClick={() => setShowProfileDetails(!showProfileDetails)}
                className="flex items-center gap-2 bg-zinc-900/60 pl-2 pr-3 py-1.5 rounded-full border border-zinc-800/40 cursor-pointer active:scale-95 transition relative z-50"
              >
                <div className="w-5 h-5 rounded-full bg-zinc-700 overflow-hidden shrink-0 ring-1 ring-zinc-800">
                  <img 
                    src={userProfile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'} 
                    alt="avatar" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <span className="text-[11px] font-bold text-zinc-300 font-sans">
                  @{userProfile.username || 'companion'}
                </span>
                <span className="text-[9px] text-zinc-500 font-sans select-none">{showProfileDetails ? '▲' : '▼'}</span>
              </button>

              {renderBreakoutDropdown()}
            </div>
          </header>
        )}

        {/* Top Header Controls Bar */}
        <header className="hidden md:flex items-center justify-between bg-zinc-900/40 border border-zinc-850 p-4 rounded-3xl mb-4 relative z-10">
          <LustyGlobalLogo />

          {/* Nav tabs desktop style */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'feed' ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>Lounge Shorts</span>
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'directory' ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Companions</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'map' ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Live Radar</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('chat');
                window.dispatchEvent(new CustomEvent('chat-read-all'));
              }}
              className={`relative px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'chat' ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chats</span>
              <ChatUnreadBadge currentUserId={userProfile?.id || ''} />
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'verification' ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Award className="w-4 h-4 text-sky-400" />
              <span>Host Portal</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'admin' ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Escrow Vault</span>
            </button>
          </div>

          {/* User profile controls right with Breakout Dropdown */}
          <div className="relative flex items-center gap-3 z-50 pointer-events-auto" ref={profileDropdownRef}>
            <NotificationDropdown currentUserId={userProfile.id} />
            <button
              type="button"
              onClick={() => {
                console.log("Header profile chip clicked! Toggling state to:", !showProfileDetails);
                setShowProfileDetails(!showProfileDetails);
              }}
              className="flex items-center gap-2.5 bg-zinc-900/80 border border-zinc-800 hover:border-pink-500/40 active:scale-98 px-3.5 py-2 rounded-full transition cursor-pointer select-none z-50 relative"
            >
              <img 
                src={userProfile.avatar} 
                alt="" 
                className="w-7 h-7 rounded-full object-cover border border-pink-500 bg-zinc-800" 
              />
              <div className="flex items-center gap-1.5 text-left">
                <span className="text-xs font-bold text-zinc-100">@{userProfile.username}</span>
                {isVerified && <VerificationBadge size={13} />}
              </div>
              <span className="text-zinc-500 text-[10px] ml-0.5">{showProfileDetails ? '▲' : '▼'}</span>
            </button>

            {renderBreakoutDropdown()}
          </div>
        </header>

        {/* Viewport Core Frame */}
        <main className="flex-1 overflow-hidden bg-zinc-950 md:rounded-3xl border border-zinc-900 flex justify-center items-center w-full md:h-[75vh]">
          {renderActiveView()}
        </main>

        {/* Mobile Navigation Footer Bar */}
        <footer className="md:hidden w-full h-auto py-[10px] px-[10px] bg-zinc-950 border-t border-zinc-900 flex items-center justify-around z-30 select-none">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'feed' ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Tv className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-[10px] uppercase font-mono">Lounge</span>
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'directory' ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-[10px] uppercase font-mono">Hosts</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'map' ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-[10px] uppercase font-mono">Radar</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('chat');
              window.dispatchEvent(new CustomEvent('chat-read-all'));
            }}
            className={`relative flex flex-col items-center justify-center transition-colors ${
              activeTab === 'chat' ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              <div className="absolute -top-1 -right-2.5">
                <ChatUnreadBadge currentUserId={userProfile?.id || ''} />
              </div>
            </div>
            <span className="text-[9px] font-bold mt-[10px] uppercase font-mono">Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'verification' ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Award className={`w-5 h-5 ${activeTab === 'verification' ? 'text-pink-500' : 'text-sky-400'}`} />
            <span className="text-[9px] font-bold mt-[10px] uppercase font-mono">Portal</span>
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'admin' ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-[10px] uppercase font-mono">Vault</span>
          </button>
        </footer>

      </div>

      {/* 6. Active Overlay Forms */}
      {bookingCompanion && (
        <DirectBookingModal 
          companion={bookingCompanion} 
          onClose={() => setBookingCompanion(null)} 
          onSubmitBooking={handleBookingSubmit} 
        />
      )}

      {pendingPayment && (
        <SecurityPaymentGateway 
          amount={pendingPayment.amount} 
          recipientUsername={pendingPayment.recipientUsername} 
          onPaymentSuccess={handlePaymentSuccess} 
          onPaymentCancel={() => setPendingPayment(null)} 
          title={pendingPayment.type === 'booking' ? "Secure Escrow Authorization" : "Tip Token Checkout"}
        />
      )}

      {viewingPublicProfileId && (
        <PublicCompanionProfileView
          hostId={viewingPublicProfileId}
          defaultTab={publicProfileDefaultTab}
          onClose={() => setViewingPublicProfileId(null)}
          currentUserId={userProfile?.id || ''}
          onStartChat={handleStartChat}
          onAddBooking={handleDirectAddBooking}
        />
      )}

      {userProfile?.id && (
        <UnifiedAlertListener currentUserId={userProfile.id} />
      )}

    </div>
  );
}
