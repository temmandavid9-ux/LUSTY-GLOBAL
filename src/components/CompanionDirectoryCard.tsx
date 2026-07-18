import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Clock, Heart, Flame, Eye } from 'lucide-react';
import { Companion, Booking } from '../types';
import { motion } from 'motion/react';
import { initiateFlutterwavePayment } from '../lib/flutterwave';

interface CompanionDirectoryCardProps {
  companion: Companion;
  currentUserId: string;
  onStartChat: (companionId: string) => void;
  onWalletDeduction?: (amount: number) => void;
  onAddBooking: (booking: Booking) => void;
  isFavorited: boolean;
  onToggleFavorite: (companionId: string, e: React.MouseEvent) => void;
}

export function CompanionDirectoryCard({ 
  companion, 
  currentUserId, 
  onStartChat, 
  onWalletDeduction: _onWalletDeduction,
  onAddBooking,
  isFavorited,
  onToggleFavorite
}: CompanionDirectoryCardProps) {
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingHours, setBookingHours] = useState(1);
  const [bookingFeedback, setBookingFeedback] = useState<{ type: 'success' | 'error' | 'card_required'; message: string } | null>(null);

  const handleExecuteBooking = async () => {
    if (isBooking) return;
    setIsBooking(true);
    setBookingFeedback(null);

    const basePrice = companion.ratePerHour * bookingHours;
    const bookerFee = 1.00;
    const totalCost = basePrice + bookerFee;

    try {
      if (!currentUserId) {
        throw new Error("Please log in or register to establish secure escrow channels.");
      }

      // 1. Fetch user's profile to verify a physical debit card is attached
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('has_payment_method, card_brand_last4')
        .eq('id', currentUserId)
        .maybeSingle();

      if (profileError) throw profileError;

      // 🔍 Card Requirement Interceptor Check
      if (!userProfile?.has_payment_method) {
        setBookingFeedback({
          type: 'card_required',
          message: "A valid credit/debit card is required to secure escrow before booking. Please link a card in your Escrow Vault or Profile billing tab."
        });
        setIsBooking(false);
        return;
      }

      console.log(`Spinning up secure Flutterwave checkout for $${totalCost.toFixed(2)} to main platform wallet...`);

      // 🎯 FLUTTERWAVE GATEWAY EXECUTION
      await initiateFlutterwavePayment({
        amount: totalCost,
        currency: "USD",
        email: "user@lustyglobal.vip",
        name: "VIP Member",
        description: `Booking escrow of ${bookingHours} hours with @${companion.username}`,
        callback: async (response: any) => {
          if (response.status === "successful" || response.status === "completed" || response.success) {
            const paymentGatewayRef = response.transaction_id || response.tx_ref || `TRX-${Date.now()}`;
            const grossAmount = basePrice;

            // 1. Instantly show success UI and update frontend booking state (non-blocking)
            const tempBookingId = `booking_${companion.id}_${Date.now()}`;
            const createdBooking: Booking = {
              id: tempBookingId,
              companionId: companion.id,
              date: new Date().toLocaleDateString(),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              duration: bookingHours,
              rate: companion.ratePerHour,
              location: companion.location,
              status: 'paid_escrow',
              notes: 'Secure platform-managed escrow custody hold'
            };

            onAddBooking(createdBooking);

            setBookingFeedback({
              type: 'success',
              message: `Payment Confirmed! $${totalCost.toFixed(2)} is held in Platform Escrow. The booking request has been sent to @${companion.username} (Status: paid_escrow).`
            });

            setIsBooking(false);

            // Auto collapse panel after success delay
            setTimeout(() => {
              setShowBookingPanel(false);
              setBookingFeedback(null);
            }, 5000);

            // 2. Perform DB write with a 5-second timeout safety net in the background
            const insertPromise = (async () => {
              const { data: bookingData, error: bookingError } = await supabase
                .from('bookings')
                .insert([
                  {
                    companion_id: companion.id,
                    client_id: currentUserId,
                    duration_hours: bookingHours,
                    hourly_rate_at_booking: companion.ratePerHour,
                    gross_amount: grossAmount,
                    status: 'paid_escrow',
                    escrow_status: 'held', // Secured instantly in the platform's custody wallet
                    location: companion.location
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
                  receiver_id: companion.id,
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
              // Log to administrative alert table for manual review
              try {
                await supabase.from('payment_errors').insert([{
                  tx_ref: paymentGatewayRef,
                  amount: grossAmount,
                  error_msg: `Booking Ledger Error: ${err.message || 'Timeout'}`
                }]);
              } catch (logErr) {
                console.warn("Failed to log to payment_errors table (likely missing, logging to console):", logErr);
              }
            }
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
        }
      });

    } catch (error: any) {
      console.error("Booking transaction execution error:", error);
      setBookingFeedback({
        type: 'error',
        message: error.message || "Failed to establish secure escrow booking channel."
      });
      setIsBooking(false);
    }
  };

  const isOfflineOver24Hours = () => {
    if (companion.isOnline) return false;
    if (!companion.lastSeen) {
      const seed = companion.id ? companion.id.charCodeAt(companion.id.length - 1) % 12 : 3;
      const hours = seed + 1;
      return hours >= 24;
    }
    try {
      const lastSeenDate = new Date(companion.lastSeen);
      const diffMs = Date.now() - lastSeenDate.getTime();
      if (isNaN(diffMs)) return false;
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      return diffHours >= 24;
    } catch (e) {
      return false;
    }
  };

  const getLastOnlineText = () => {
    if (companion.isOnline) return 'Active now';
    if (!companion.lastSeen) {
      // Consistent time representation using the ID char code seed
      const seed = companion.id ? companion.id.charCodeAt(companion.id.length - 1) % 12 : 3;
      const hours = seed + 1;
      return `${hours}h ago`;
    }
    
    try {
      const lastSeenDate = new Date(companion.lastSeen);
      const diffMs = Date.now() - lastSeenDate.getTime();
      if (isNaN(diffMs) || diffMs < 0) return 'Recent';
      
      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 60) {
        return `${Math.max(1, diffMins)}m ago`;
      }
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      }
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) {
        return `${diffDays}d ago`;
      }
      
      return lastSeenDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return '1d ago';
    }
  };

  const getViewCountText = () => {
    // Generate static stable view count based on username seed, hourly rate, and reviewsCount
    const nameSeed = companion.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const baseViews = (companion.reviewsCount || 10) * 195 + (companion.ratePerHour || 150) * 4 + nameSeed * 3;
    if (baseViews > 1000) {
      return `${(baseViews / 1000).toFixed(1)}k`;
    }
    return `${baseViews}`;
  };

  const isTrending = companion.reviewsCount > 25 || companion.isOnline || companion.isVIP;

  return (
    <motion.div 
      id={`companion-card-${companion.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.025, y: -4 }}
      transition={{ 
        opacity: { duration: 0.35, ease: "easeOut" },
        y: { duration: 0.35, ease: "easeOut" },
        scale: { type: "spring", stiffness: 350, damping: 20 },
        default: { ease: "linear" }
      }}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-[#120d1a] border border-zinc-900 transition-colors duration-300 hover:border-zinc-700 cursor-pointer flex-grow"
    >
      {/* 📸 Host Image & Top Badges Layer */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-950">
        <img 
          src={companion.images[0]} 
          alt={companion.name} 
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Top Floating Status Badges */}
        <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1 items-center justify-between pointer-events-none">
          {companion.isVIP && (
            <span className="bg-[#ff2d55] text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm tracking-wide uppercase scale-90 origin-left shadow">
              VIP SELECT
            </span>
          )}
          {companion.isOnline ? (
            <span className="bg-[#00cc76] text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm scale-90 origin-right flex items-center gap-1 shadow ml-auto">
              <span className="w-1 h-1 bg-white rounded-full animate-ping" />
              ONLINE
            </span>
          ) : isOfflineOver24Hours() ? (
            <span className="bg-red-500/15 border border-red-500/25 text-red-400 text-[8px] font-black px-1.5 py-0.5 rounded-sm scale-90 origin-right ml-auto shadow flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              OFFLINE ({getLastOnlineText().toUpperCase()})
            </span>
          ) : (
            <span className="bg-zinc-800/90 text-zinc-300 text-[8px] font-black px-1.5 py-0.5 rounded-sm scale-90 origin-right ml-auto shadow flex items-center gap-1 font-mono">
              <span className="w-1 h-1 bg-zinc-500 rounded-full" />
              {getLastOnlineText().toUpperCase()}
            </span>
          )}
        </div>

        {/* Bottom Floating Hourly Rate */}
        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-zinc-850/80 text-center">
          <p className="text-[7px] uppercase tracking-wider text-zinc-400 font-bold leading-none">Hourly Rate</p>
          <p className="text-emerald-400 text-[11px] font-black mt-0.5">${companion.ratePerHour}</p>
        </div>

        {/* ❤️ Interactive Favorite Toggle Button overlay */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(companion.id, e);
          }}
          className={`absolute bottom-2 left-2 p-1.5 rounded-full backdrop-blur-sm border transition-all duration-200 active:scale-95 flex items-center justify-center cursor-pointer z-10 ${
            isFavorited 
              ? 'bg-pink-500/90 border-pink-500 text-white shadow-[0_0_8px_rgba(236,72,153,0.6)]' 
              : 'bg-black/60 border-zinc-800 text-zinc-400 hover:text-pink-400 hover:bg-black/80'
          }`}
          title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current text-white' : ''}`} />
        </button>
      </div>

      {/* 📝 Info & Details Section */}
      <div className="p-3 flex flex-col flex-grow text-left justify-between">
        <div>
          {/* Name & Verification Badge */}
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-white font-bold text-xs truncate">
              @{companion.username}
            </h3>
            {companion.isVIP && (
              <svg 
                viewBox="0 0 24 24" 
                className="w-3.5 h-3.5 text-[#1d9bf0] fill-current drop-shadow-[0_0_6px_rgba(29,155,240,0.4)] shrink-0"
                aria-label="Verified creator"
              >
                <path d="M22.25 12c0-1.43-.88-2.67-2.15-3.21.15-.44.24-.91.24-1.4 0-2.2-1.72-4-3.83-4-.48 0-.94.1-1.35.27C14.56 2.39 13.38 1.5 12 1.5s-2.56.89-3.16 2.16c-.41-.17-.87-.27-1.35-.27-2.11 0-3.83 1.8-3.83 4 0 .49.09.96.24 1.4-1.27.54-2.15 1.78-2.15 3.21 0 1.43.88 2.67 2.15 3.21-.15.44-.24.91-.24 1.4 0 2.2 1.72 4 3.83 4 .48 0 .94-.1 1.35-.27.6 1.27 1.78 2.16 3.16 2.16s2.56-.89 3.16-2.16c.41.17.87.27 1.35.27 2.11 0 3.83-1.8 3.83-4 0-.49-.09-.96-.24-1.4 1.27-.54 2.15-1.78 2.15-3.21zm-12.5 4L6 12.25l1.5-1.5 2.25 2.25L16.25 6.5l1.5 1.5-8 8z" />
              </svg>
            )}
          </div>

          {/* Rating & Popularity Info Row */}
          <div className="flex items-center justify-between gap-1.5 mt-1 select-none">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-amber-400 text-[10px]">⭐</span>
              <span className="text-white text-[10px] font-bold">
                {(companion.isVIP || companion.is_verified || companion.isVerified) ? "5.0" : (companion.avg_rating ? companion.avg_rating.toFixed(1) : (companion.rating ? companion.rating.toFixed(1) : "5.0"))}
              </span>
              <span className="text-zinc-500 text-[9px]">({companion.reviewsCount})</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <div className="flex items-center gap-0.5 bg-zinc-950/85 border border-zinc-900 px-1.5 py-0.5 rounded-md text-zinc-400">
                <Eye className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                <span className="text-[8.5px] font-bold">{getViewCountText()}</span>
              </div>
              {isTrending && (
                <div className="flex items-center gap-0.5 bg-pink-500/10 border border-pink-500/20 text-[#ff2d55] text-[7px] font-extrabold px-1 py-0.5 rounded-md uppercase tracking-wider animate-pulse shrink-0">
                  <Flame className="w-2 h-2 fill-current shrink-0" />
                  <span>TRENDING</span>
                </div>
              )}
            </div>
          </div>

          {/* Location Info */}
          <div className="flex items-center gap-1 text-zinc-400 text-[10px] truncate mt-1">
            <span className="truncate">📍 {companion.location}</span>
            <span className="text-zinc-600">•</span>
            <span className="shrink-0">{companion.distance}</span>
          </div>

          {/* 1. Display the Companion Biography */}
          <p className="text-zinc-300 text-[11px] mt-2 line-clamp-2 leading-relaxed">
            {companion.bio || "No biography provided."}
          </p>

          {/* 2. Display the Age and Height */}
          <div className="flex gap-3 mt-1.5 text-[10px] text-zinc-400 font-medium">
            {companion.age && (
              <span>Age: {companion.age}</span>
            )}
            {companion.height && (
              <span>• Height: {companion.height}</span>
            )}
          </div>

          {/* Last Online Row */}
          <div className="flex items-center gap-1 text-zinc-500 text-[10px] mt-1 font-medium">
            <Clock className="w-3 h-3 text-zinc-600 shrink-0" />
            <span className="text-zinc-500 text-[8.5px] font-bold uppercase tracking-wider">Last Online:</span>
            <span className={companion.isOnline ? "text-emerald-400 font-bold" : "text-zinc-300 font-semibold"}>
              {getLastOnlineText()}
            </span>
          </div>
          
          <p className="text-[#ff2d55] text-[9px] font-medium truncate mt-1">
            Lounge Live Broadcaster
          </p>

          {/* Optional: Compact compact tags line */}
          {companion.tags && companion.tags.length > 0 && (
            <p className="text-zinc-500 text-[9px] line-clamp-1 mt-1 font-mono uppercase">
              #{companion.tags.slice(0, 2).join(' #')}
            </p>
          )}
        </div>

        {/* Dynamic Booking Expansion Panel */}
        {showBookingPanel && (
          <div className="mt-3 p-2 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2.5 animate-fade-in text-sans text-[10px]">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-900/60">
              <div>
                <label className="text-[8px] uppercase text-zinc-500 font-bold block mb-0.5 font-mono tracking-wider flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5 text-pink-400" />
                  <span>Duration</span>
                </label>
                <select 
                  value={bookingHours} 
                  onChange={(e) => setBookingHours(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-800 rounded-md text-[9px] text-white px-1 py-0.5 font-mono focus:outline-none focus:border-pink-500 cursor-pointer pointer-events-auto"
                  disabled={isBooking}
                >
                  {[1, 2, 3, 4, 6, 8, 12, 24].map((hr) => (
                    <option key={hr} value={hr}>{hr} {hr === 1 ? 'Hour' : 'Hours'}</option>
                  ))}
                </select>
              </div>

              <div className="text-right">
                <span className="text-[8px] uppercase text-zinc-500 font-bold block mb-0.5 font-mono tracking-wider">
                  Hourly Rate
                </span>
                <span className="text-zinc-300 font-mono text-[9px]">${companion.ratePerHour}/hr</span>
              </div>
            </div>

            {/* Booking Summary Invoice Details */}
            <div className="space-y-1 border-b border-zinc-900/60 pb-2 text-[9px] font-sans">
              <div className="flex justify-between text-zinc-400">
                <span>Rate ({bookingHours}h)</span>
                <span className="font-mono text-zinc-200">${(companion.ratePerHour * bookingHours).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Booker Fee</span>
                <span className="font-mono text-zinc-300">+$1.00</span>
              </div>
            </div>

            <div className="flex justify-between items-center pb-0.5">
              <span className="text-[9px] font-bold text-white uppercase tracking-tight">Total</span>
              <span className="text-xs font-mono font-black text-emerald-400">
                ${(companion.ratePerHour * bookingHours + 1.00).toFixed(2)}
              </span>
            </div>

             {/* 🚀 Confirm Secure Booking Trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExecuteBooking();
              }}
              disabled={isBooking}
              className={`w-full py-1.5 rounded-lg font-black text-[8px] uppercase tracking-wider transition-all duration-200 pointer-events-auto flex items-center justify-center gap-1 ${
                isBooking 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-pink-600 hover:bg-pink-700 text-white active:scale-[0.98]'
              }`}
            >
              {isBooking ? (
                <>
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-zinc-500" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Authorize Escrow</span>
              )}
            </button>

            {/* Dynamic Stripe / Card Error Fallbacks */}
            {bookingFeedback?.type === 'card_required' && (
              <div className="mt-2 p-2 rounded-lg text-[9px] bg-amber-950/40 border border-amber-800 text-amber-400">
                <p className="font-bold">💳 Card Required</p>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.hash = '#escrow-vault';
                  }}
                  className="mt-1 text-[9px] font-black text-pink-400 hover:underline block text-left"
                >
                  Link Card in Vault →
                </button>
              </div>
            )}

            {/* Processing Feedback Alert for regular success/error */}
            {bookingFeedback && bookingFeedback.type !== 'card_required' && (
              <div className={`p-1.5 rounded-lg text-[8px] font-mono leading-relaxed border ${
                bookingFeedback.type === 'success' 
                  ? 'bg-emerald-950/40 border-emerald-850 text-emerald-400' 
                  : 'bg-red-950/40 border-red-850 text-red-400'
              }`}>
                {bookingFeedback.message}
              </div>
            )}
          </div>
        )}

        {/* 🔘 Action Buttons: Stacked cleanly for small column widths */}
        <div className="flex flex-col gap-1.5 mt-3 w-full">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onStartChat(companion.id);
            }}
            className="w-full bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-white font-bold text-[10px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer pointer-events-auto"
          >
            💬 Chat
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowBookingPanel(!showBookingPanel);
            }}
            className={`w-full font-bold text-[10px] py-1.5 rounded-lg transition-all shadow-md cursor-pointer pointer-events-auto ${
              showBookingPanel 
                ? 'bg-zinc-950 border border-zinc-800 text-zinc-400'
                : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg shadow-pink-500/10'
            }`}
          >
            📅 {showBookingPanel ? 'Cancel' : 'Book'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
