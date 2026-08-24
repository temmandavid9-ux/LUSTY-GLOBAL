import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreatorVideoCatalog } from './CreatorVideoCatalog';
import { 
  X, MapPin, MessageSquare, Calendar, 
  Info, Film, Star, Languages, Clock, ShieldCheck, Heart 
} from 'lucide-react';
import { Booking } from '../types';
import { initiateFlutterwavePayment } from '../lib/flutterwave';
import { chargeLinkedCard } from '../lib/chargeLinkedCard';

interface PublicCompanionProfileViewProps {
  hostId: string;
  defaultTab?: 'about' | 'media';
  onClose: () => void;
  currentUserId: string;
  onStartChat: (companionId: string) => void;
  onAddBooking: (booking: Booking) => void;
}

export function PublicCompanionProfileView({
  hostId,
  defaultTab = 'about',
  onClose,
  currentUserId,
  onStartChat,
  onAddBooking
}: PublicCompanionProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'about' | 'media'>(defaultTab);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isProcessingFollow, setIsProcessingFollow] = useState<boolean>(false);
  const [followersCount, setFollowersCount] = useState<number>(45);

  // Booking states
  const [showBooking, setShowBooking] = useState<boolean>(false);
  const [bookingHours, setBookingHours] = useState<number>(1);
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [bookingFeedback, setBookingFeedback] = useState<{ type: 'success' | 'error' | 'card_required'; message: string } | null>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, hostId]);

  useEffect(() => {
    if (!hostId) return;

    async function loadFullProfile() {
      try {
        setIsLoading(true);
        // Load profile
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', hostId)
          .maybeSingle();

        if (error) throw error;
        setProfile(data);

        // Check if current user is following this companion
        if (currentUserId && currentUserId !== hostId) {
          const { data: followData } = await supabase
            .from('followers')
            .select('*')
            .eq('follower_id', currentUserId)
            .eq('following_id', hostId)
            .maybeSingle();

          setIsFollowing(!!followData);
        }

        // Get followers count
        const { count, error: countError } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', hostId);

        if (!countError && count !== null) {
          setFollowersCount(count + 42); // base seed for UI polish
        }
      } catch (err) {
        console.error("Error loading companion public profile:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadFullProfile();
  }, [hostId, currentUserId]);

  const handleFollowToggle = async () => {
    if (!currentUserId || isProcessingFollow) return;
    try {
      setIsProcessingFollow(true);
      if (isFollowing) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', hostId);
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('followers')
          .insert([{ follower_id: currentUserId, following_id: hostId }]);
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
    } finally {
      setIsProcessingFollow(false);
    }
  };

  const handleExecuteBooking = async () => {
    if (isBooking || !profile) return;
    setIsBooking(true);
    setBookingFeedback(null);

    const basePrice = (profile.hourly_rate || 250) * bookingHours;
    const bookerFee = 1.00;
    const totalCost = basePrice + bookerFee;

    try {
      if (!currentUserId) {
        throw new Error("Please log in to establish secure escrow channels.");
      }

      // 1. Fetch user's profile to verify card linked
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('has_payment_method, card_brand_last4')
        .eq('id', currentUserId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!userProfile?.has_payment_method) {
        setBookingFeedback({
          type: 'card_required',
          message: "A valid credit/debit card is required to secure escrow before booking. Please link a card in your Escrow Vault."
        });
        setIsBooking(false);
        return;
      }

      // Get current user email
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = currentUser?.email || "vipmember@gmail.com";

      const processBookingSuccess = async (paymentGatewayRef: string) => {
        const grossAmount = basePrice;

        // 1. Instantly show success UI and update frontend booking state (non-blocking)
        const tempBookingId = crypto.randomUUID();
        const createdBooking: Booking = {
          id: tempBookingId,
          companionId: hostId,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: bookingHours,
          rate: profile.hourly_rate || 250,
          location: profile.location || 'London, Mayfair',
          status: 'paid_escrow',
          notes: 'Secure platform-managed escrow custody hold',
          senderId: currentUserId,
          senderUsername: 'black',
          senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          receiverId: hostId,
          receiverUsername: profile.username || profile.name || 'Elena_VIP',
          receiverAvatar: profile.avatar_url || profile.avatar || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
          isVerified: !!(profile.is_verified || profile.tier_badge === 'VIP SELECT'),
          escrowDeposit: Math.round((profile.hourly_rate || 250) * bookingHours * 0.3)
        };

        onAddBooking(createdBooking);

        setBookingFeedback({
          type: 'success',
          message: `Payment Confirmed! $${totalCost.toFixed(2)} is held in Platform Escrow. The booking request has been sent to @${profile.username} (Status: paid_escrow).`
        });

        setIsBooking(false);

        setTimeout(() => {
          setShowBooking(false);
          setBookingFeedback(null);
        }, 5000);

        // 2. Insert secure escrow booking with status 'paid_escrow' in background with a 5s safety net
        const insertPromise = (async () => {
          const { data: bookingData, error: bookingError } = await supabase
            .from('bookings')
            .insert([
              {
                id: tempBookingId,
                companion_id: hostId,
                client_id: currentUserId,
                booking_date: new Date().toISOString(),
                duration_hours: bookingHours,
                hourly_rate_at_booking: profile.hourly_rate || 250,
                gross_amount: grossAmount,
                status: 'paid_escrow',
                escrow_status: 'held'
              }
            ])
            .select()
            .maybeSingle();

          if (bookingError) throw bookingError;
          console.log("Successfully logged escrow booking to ledger database:", bookingData);

          // Log unified audit history
          try {
            await supabase.from('transaction_history').insert([{
              sender_id: currentUserId,
              receiver_id: hostId,
              transaction_type: 'booking',
              status: 'paid_escrow',
              gross_amount: grossAmount,
              platform_fee: grossAmount * 0.15,
              net_payout: grossAmount * 0.85,
              tx_ref: paymentGatewayRef
            }]);
          } catch (histErr) {
            console.warn("Unified transaction log error (ignored):", histErr);
          }
        })();

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ledger write timed out')), 5000)
        );

        try {
          await Promise.race([insertPromise, timeoutPromise]);
        } catch (err: any) {
          console.error("Ledger write timed out, but payment was captured:", err);
          try {
            await supabase.from('payment_errors').insert([{
              tx_ref: paymentGatewayRef,
              amount: grossAmount,
              error_msg: `Booking (Profile) Ledger Error: ${err.message || 'Timeout'}`
            }]);
          } catch (logErr) {
            console.warn("Failed to log to payment_errors table:", logErr);
          }
        }
      };

      // 🎯 Attempt 1-Click Debit with Linked Card Token First
      try {
        const tokenChargeResult = await chargeLinkedCard({
          userId: currentUserId,
          userEmail,
          amount: totalCost,
          currency: 'USD'
        });

        if (tokenChargeResult?.success) {
          console.log("⚡ 1-Click Linked Card Debit Succeeded!", tokenChargeResult);
          await processBookingSuccess(tokenChargeResult.data?.txRef || tokenChargeResult.data?.tx_ref || `TOK-${Date.now()}`);
          return;
        }
      } catch (tokenErr: any) {
        console.log("1-Click linked card debit unavailable or deferred:", tokenErr?.message);
      }

      // 🎯 Fallback: Launch Flutterwave Gateway Checkout Modal
      console.log(`Spinning up secure Flutterwave checkout for $${totalCost.toFixed(2)} to main platform wallet...`);

      const generatedTxRef = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const grossAmount = basePrice;

      // STEP ONE: Pre-create pending booking record in Supabase IN ADVANCE
      const bookingUuid = crypto.randomUUID();
      const { data: preBooking } = await supabase
        .from('bookings')
        .insert([
          {
            id: bookingUuid,
            companion_id: hostId,
            client_id: currentUserId,
            booking_date: new Date().toISOString(),
            duration_hours: bookingHours,
            hourly_rate_at_booking: profile.hourly_rate || 250,
            gross_amount: grossAmount,
            status: 'pending_transfer',
            escrow_status: 'held',
            payment_method: 'bank_transfer',
            tx_ref: generatedTxRef
          }
        ])
        .select()
        .maybeSingle();

      // Log to transaction_history
      try {
        await supabase.from('transaction_history').insert([{
          sender_id: currentUserId,
          receiver_id: hostId,
          transaction_type: 'booking',
          status: 'pending_transfer',
          gross_amount: grossAmount,
          platform_fee: grossAmount * 0.15,
          net_payout: grossAmount * 0.85,
          tx_ref: generatedTxRef
        }]);
      } catch (histErr) {
        console.warn("Pre-booking audit log notice:", histErr);
      }

      // Show immediately in frontend UI state
      const preBookingId = preBooking?.id || bookingUuid;
      const pendingBooking: Booking = {
        id: preBookingId,
        companionId: hostId,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: bookingHours,
        rate: profile.hourly_rate || 250,
        location: profile.location || 'London, Mayfair',
        status: 'pending_transfer',
        notes: 'Pending bank transfer settlement / Escrow processing',
        senderId: currentUserId,
        senderUsername: 'black',
        senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        receiverId: hostId,
        receiverUsername: profile.username || profile.name || 'Elena_VIP',
        receiverAvatar: profile.avatar_url || profile.avatar || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
        isVerified: !!(profile.is_verified || profile.tier_badge === 'VIP SELECT'),
        escrowDeposit: Math.round((profile.hourly_rate || 250) * bookingHours * 0.3)
      };
      onAddBooking(pendingBooking);

      await initiateFlutterwavePayment({
        amount: totalCost,
        currency: "USD",
        email: userEmail,
        name: currentUser?.user_metadata?.full_name || "VIP Member",
        description: `Booking escrow of ${bookingHours} hours with @${profile.username || 'VIP'}`,
        txRef: generatedTxRef,
        meta: {
          client_id: currentUserId,
          companion_id: hostId,
          booking_amount_usd: grossAmount,
        },
        callback: async (response: any) => {
          if (response.status === "successful" || response.status === "completed" || response.success) {
            const paymentGatewayRef = response.transaction_id || response.tx_ref || generatedTxRef;
            
            // Update booking status on successful payment
            const targetTxRef = response.tx_ref || generatedTxRef;
            const { error: bookingUpdateErr } = await supabase
              .from('bookings')
              .update({
                status: 'funded',
                escrow_status: 'held'
              })
              .eq('tx_ref', targetTxRef);

            if (bookingUpdateErr) {
              console.error('Failed to update booking status:', bookingUpdateErr.message);
            }

            try {
              await supabase
                .from('transaction_history')
                .update({ status: 'paid_escrow', tx_ref: paymentGatewayRef })
                .eq('tx_ref', generatedTxRef);
            } catch (histErr) {
              console.warn("Transaction history update notice:", histErr);
            }

            setBookingFeedback({
              type: 'success',
              message: `Payment Confirmed! $${totalCost.toFixed(2)} is held in Platform Escrow. The booking request has been sent to @${profile.username} (Status: paid_escrow).`
            });

            setIsBooking(false);

            setTimeout(() => {
              setShowBooking(false);
              setBookingFeedback(null);
            }, 5000);
          } else {
            setBookingFeedback({
              type: 'error',
              message: "Flutterwave booking authorization failed or was declined."
            });
            setIsBooking(false);
          }
        },
        onClose: () => {
          setIsBooking(false);
          console.log("Flutterwave booking modal closed.");
          setBookingFeedback({
            type: 'success',
            message: `Bank transfer booking submitted! Status: pending_transfer. You can view it in your Booking History.`
          });
          setTimeout(() => {
            setShowBooking(false);
            setBookingFeedback(null);
          }, 4000);
        }
      });

    } catch (err: any) {
      console.error("Booking error:", err);
      setBookingFeedback({
        type: 'error',
        message: err.message || "Failed to establish secure escrow booking channel."
      });
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex flex-col items-center justify-center text-zinc-500 text-xs font-mono">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span>Syncing companion profile details...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/95 z-[110] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-zinc-400 font-mono text-xs mb-4">Host profile could not be loaded or is offline.</p>
        <button 
          onClick={onClose} 
          className="bg-zinc-900 border border-zinc-850 px-4 py-2 rounded-xl text-xs text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  const bioText = profile.bio || profile.default_caption || 'Verified VIP companion. Rates available on demand 🔒';
  const displayRate = profile.hourly_rate || 250;
  const isOnline = profile.is_online === true || (profile.last_seen && new Date(profile.last_seen).getTime() > Date.now() - 5 * 60 * 1000);

  return (
    <div className="fixed inset-0 bg-black/95 md:bg-zinc-950/98 z-[110] overflow-y-auto no-scrollbar flex justify-center">
      <div className="w-full max-w-lg min-h-screen bg-zinc-950 border-x border-zinc-900 flex flex-col relative text-white">
        
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/60 hover:bg-zinc-800 text-zinc-300 hover:text-white p-2 rounded-full transition duration-150 z-20 backdrop-blur-md cursor-pointer"
          title="Close Profile"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cover image & avatar header block */}
        <div className="relative h-56 shrink-0 bg-zinc-900">
          <img 
            src={profile.cover_image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'} 
            alt="Cover" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-black/40" />

          {/* User profile identifier */}
          <div className="absolute bottom-4 left-4 flex items-end gap-3.5">
            <div className="w-18 h-18 rounded-full border-2 border-pink-500 p-0.5 bg-zinc-950 overflow-hidden aspect-square flex items-center justify-center relative">
              <img 
                src={profile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                alt={profile.username} 
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover"
              />
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-zinc-950 rounded-full" />
              )}
            </div>

            <div className="pb-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-black text-white">@{profile.username}</h2>
                {profile.is_verified && (
                  <svg 
                    viewBox="0 0 24 24" 
                    className="w-4 h-4 text-[#1d9bf0] fill-current drop-shadow-[0_0_6px_rgba(29,155,240,0.4)] shrink-0"
                    aria-label="Verified creator"
                  >
                    <path d="M22.25 12c0-1.43-.88-2.67-2.15-3.21.15-.44.24-.91.24-1.4 0-2.2-1.72-4-3.83-4-.48 0-.94.1-1.35.27C14.56 2.39 13.38 1.5 12 1.5s-2.56.89-3.16 2.16c-.41-.17-.87-.27-1.35-.27-2.11 0-3.83 1.8-3.83 4 0 .49.09.96.24 1.4-1.27.54-2.15 1.78-2.15 3.21 0 1.43.88 2.67 2.15 3.21-.15.44-.24.91-.24 1.4 0 2.2 1.72 4 3.83 4 .48 0 .94-.1 1.35-.27.6 1.27 1.78 2.16 3.16 2.16s2.56-.89 3.16-2.16c.41.17.87.27 1.35.27 2.11 0 3.83-1.8 3.83-4 0-.49-.09-.96-.24-1.4 1.27-.54 2.15-1.78 2.15-3.21zm-12.5 4L6 12.25l1.5-1.5 2.25 2.25L16.25 6.5l1.5 1.5-8 8z" />
                  </svg>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest mt-0.5">
                {profile.tier_badge || 'VERIFIED COMPANION'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Follow and stats bar */}
        <div className="px-4 py-3 bg-zinc-900/30 border-b border-zinc-900 flex items-center justify-between gap-4 font-mono">
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-zinc-400 text-[10px] block uppercase">Followers</span>
              <span className="text-white font-bold">{followersCount}</span>
            </div>
            <div>
              <span className="text-zinc-400 text-[10px] block uppercase">Escrow Rate</span>
              <span className="text-emerald-400 font-bold">${displayRate}/hr</span>
            </div>
          </div>

          <div className="flex gap-2">
            {currentUserId !== hostId && (
              <button
                type="button"
                disabled={isProcessingFollow}
                onClick={handleFollowToggle}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition duration-150 flex items-center gap-1 cursor-pointer ${
                  isFollowing
                    ? 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                    : 'bg-pink-500 hover:bg-pink-600 border-pink-500 text-white'
                }`}
              >
                <Heart className={`w-3 h-3 ${isFollowing ? 'fill-current text-pink-500' : ''}`} />
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex border-b border-zinc-900 font-mono">
          <button 
            type="button"
            onClick={() => { setActiveTab('about'); setShowBooking(false); }}
            className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-1.5 transition ${
              activeTab === 'about' 
                ? 'text-pink-500 border-b-2 border-pink-500' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>About Profile</span>
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('media'); setShowBooking(false); }}
            className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-1.5 transition ${
              activeTab === 'media' 
                ? 'text-pink-500 border-b-2 border-pink-500' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Video Archive</span>
          </button>
        </div>

        {/* Content View Container */}
        <div className="flex-1 p-4 overflow-y-auto no-scrollbar">
          {activeTab === 'about' ? (
            <div className="space-y-6">
              
              {/* Bio block */}
              <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 space-y-2">
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold font-mono">Bio Overview</span>
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{bioText}</p>
              </div>

              {/* Physical Details & Meta specs */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3 text-xs">
                  <span className="text-[9px] text-zinc-500 uppercase block mb-0.5">Rating</span>
                  <div className="flex items-center gap-1 text-yellow-500 font-bold">
                    <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>{(profile.is_verified || profile.tier_badge === 'VIP SELECT') ? "5.0" : (profile.avg_rating || profile.rating || 4.9)}</span>
                    <span className="text-[10px] text-zinc-500 font-normal">({profile.reviews_count || 42} reviews)</span>
                  </div>
                </div>
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3 text-xs">
                  <span className="text-[9px] text-zinc-500 uppercase block mb-0.5">Location</span>
                  <div className="flex items-center gap-1 text-zinc-300 truncate font-bold">
                    <MapPin className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>{profile.location || 'London'}</span>
                  </div>
                </div>
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3 text-xs">
                  <span className="text-[9px] text-zinc-500 uppercase block mb-0.5">Verification Age</span>
                  <div className="text-zinc-300 font-bold">
                    <span>{profile.age || 24} Years Old</span>
                  </div>
                </div>
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3 text-xs">
                  <span className="text-[9px] text-zinc-500 uppercase block mb-0.5">Languages Spoken</span>
                  <div className="flex items-center gap-1 text-zinc-300 font-bold">
                    <Languages className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="truncate">{(profile.languages || ['English']).join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* Sub-Tags */}
              {Array.isArray(profile.tags) && profile.tags.length > 0 && (
                <div className="space-y-1.5 font-mono">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Category Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tags.map((tag: string) => {
                      const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                      return (
                        <span key={cleanTag} className="text-[9px] bg-zinc-900 text-zinc-400 border border-zinc-850 px-2.5 py-1 rounded-lg uppercase">
                          #{cleanTag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic Escrow Booking Form embedded */}
              {showBooking ? (
                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 space-y-3.5 animate-fade-in text-sans">
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-zinc-900">
                    <div>
                      <label className="text-[9px] uppercase text-zinc-500 font-bold block mb-1 font-mono tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3 text-pink-400" />
                        <span>Booking Duration</span>
                      </label>
                      <select 
                        value={bookingHours} 
                        onChange={(e) => setBookingHours(Number(e.target.value))}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white px-2 py-1.5 font-mono focus:outline-none focus:border-pink-500 cursor-pointer"
                        disabled={isBooking}
                      >
                        {[1, 2, 3, 4, 6, 8, 12, 24].map((hr) => (
                          <option key={hr} value={hr}>{hr} {hr === 1 ? 'Hour' : 'Hours'}</option>
                        ))}
                      </select>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase text-zinc-500 font-bold block mb-1 font-mono tracking-wider">
                        Hourly Rate
                      </span>
                      <span className="text-zinc-300 font-mono text-xs">${displayRate}/hr</span>
                    </div>
                  </div>

                  <div className="space-y-2 border-b border-zinc-900 pb-3 text-[11px] font-sans">
                    <div className="flex justify-between text-zinc-400">
                      <span>Host Session Rate ({bookingHours}h)</span>
                      <span className="font-mono text-zinc-200">${(displayRate * bookingHours).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Platform Secure Booker Fee</span>
                      <span className="font-mono text-zinc-300">+$1.00</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pb-1">
                    <span className="text-[10px] font-bold text-white uppercase tracking-tight">Total Escrow Charged</span>
                    <span className="text-sm font-mono font-black text-emerald-400">
                      ${(displayRate * bookingHours + 1.00).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleExecuteBooking}
                    disabled={isBooking}
                    className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
                      isBooking 
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                        : 'bg-pink-600 hover:bg-pink-700 text-white'
                    }`}
                  >
                    <span>Authorize Escrow hold</span>
                  </button>

                  {bookingFeedback?.type === 'card_required' && (
                    <div className="p-3 rounded-xl text-xs bg-amber-950/40 border border-amber-800 text-amber-400">
                      <p className="font-bold">💳 No Active Payment Method Found</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{bookingFeedback.message}</p>
                    </div>
                  )}

                  {bookingFeedback && bookingFeedback.type !== 'card_required' && (
                    <div className={`p-2.5 rounded-xl text-[10px] font-mono border ${
                      bookingFeedback.type === 'success' 
                        ? 'bg-emerald-950/40 border-emerald-850 text-emerald-400' 
                        : 'bg-red-950/40 border-red-850 text-red-400'
                    }`}>
                      {bookingFeedback.type === 'success' ? '✓ ' : '⚠️ '}
                      {bookingFeedback.message}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-zinc-900/10 border border-zinc-900/60 rounded-xl p-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 font-mono">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase">Advanced Escrow protection</span>
                      <span className="text-[11px] text-zinc-300">Funds released only after session completion.</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* Paste Media archive loops */
            <div className="space-y-4">
              <CreatorVideoCatalog currentUserId={hostId} readOnly={true} />
            </div>
          )}
        </div>

        {/* Bottom Interactive sticky controls bar */}
        {currentUserId !== hostId && (
          <div className="p-4 border-t border-zinc-900 bg-zinc-950/90 backdrop-blur-md flex gap-3 shrink-0">
            <button
              onClick={() => {
                onStartChat(hostId);
                onClose();
              }}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4 text-pink-400" />
              <span>Send Chat</span>
            </button>
            <button
              onClick={() => {
                if (activeTab !== 'about') {
                  setActiveTab('about');
                }
                setShowBooking(true);
              }}
              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Rendezvous</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
