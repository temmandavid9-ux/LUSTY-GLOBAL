import { COMPANIONS } from '../data';
import { BarChart3, TrendingUp, AlertCircle, ShieldAlert } from 'lucide-react';
import { Booking } from '../types';
import { EscrowBillingPortal } from './EscrowBillingPortal';
import { EscrowHistoryLog } from './EscrowHistoryLog';
import EscrowStatusBox from './EscrowStatusBox';
import ClickableBookingCard from './ClickableBookingCard';

interface AdminDashboardViewProps {
  bookings: Booking[];
  escrowBalance: number;
  currentUserProfile?: any;
  onRefreshProfile?: () => void;
}

export default function AdminDashboardView({ 
  bookings, 
  escrowBalance, 
  currentUserProfile, 
  onRefreshProfile
}: AdminDashboardViewProps) {
  // Compute analytics
  const totalBookingsCount = bookings.length;
  const activeEscrowsCount = bookings.filter(b => {
    const rawStatus = (b.status || '').toLowerCase();
    return ['escrowed', 'paid_escrow', 'funded', 'pending', 'pending_transfer', 'active'].includes(rawStatus);
  }).length;
  const completedBookings = bookings.filter(b => (b.status || '').toLowerCase() === 'completed').length;

  return (
    <div id="admin-dashboard-container" className="w-full h-full bg-zinc-950 p-4 md:p-6 overflow-y-auto no-scrollbar text-zinc-100">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          VIP Escrow &amp; Lounge Admin Panel
          <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-widest font-bold">Secure Guard</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Monitor your active bookings, verify host companion checkouts, and review secure escrow payment balances.
        </p>
      </div>

      {/* 💳 Step 2: Display the Active Card Inside the Vault Status Display */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <EscrowStatusBox />

          {/* Render USDT Crypto Billing Portal underneath */}
          <div className="w-full">
            <EscrowBillingPortal 
              userId={currentUserProfile?.id || ""}
              userEmail={currentUserProfile?.email || "client@lustyglobal.com"}
              userName={currentUserProfile?.username || "Valued Client"}
              onCardLinked={() => {
                if (onRefreshProfile) onRefreshProfile();
              }} 
            />
          </div>
        </div>

        {/* 📋 Step 2's Chronological Ledger Log */}
        <div className="lg:col-span-1">
          <EscrowHistoryLog currentUserId={currentUserProfile?.id || ""} />
        </div>
      </div>

      {/* Analytics bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Durable Escrow Vault</span>
          <span className="text-3xl font-black text-emerald-400 font-mono">${escrowBalance}</span>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Held in premium custody</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Rendezvous Scheduled</span>
          <span className="text-3xl font-black text-white font-mono">{totalBookingsCount}</span>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            <span>{activeEscrowsCount} Escrowed • {completedBookings} Completed</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden col-span-1">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Host Verification SLA</span>
          <span className="text-3xl font-black text-pink-500 font-mono">100%</span>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            <span>Biometric Scanner Certified</span>
          </div>
        </div>
      </div>

      {/* Main ledger list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-pink-500" />
            <h3 className="font-extrabold text-white text-sm">Active Booking Ledgers</h3>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">UPDATED REAL-TIME</span>
        </div>

        {bookings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {bookings.map(booking => {
              const companion = COMPANIONS.find(c => c.id === booking.companionId || c.id === booking.receiverId);
              
              const senderUsername = booking.senderUsername || 'black';
              const senderAvatar = booking.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
              const receiverUsername = booking.receiverUsername || companion?.username || 'Elena_VIP';
              const scheduledDate = booking.date || '2026-06-28';
              const scheduledTime = booking.time || '20:00';
              const durationHours = booking.duration || 2;
              const depositAmount = Number(booking.escrowDeposit || (booking.rate ? booking.rate * durationHours : 0));
              const location = booking.location || 'VIP Lounge Room 1 - London Mayfair';
              const statusStr = (booking.status || 'escrowed').toUpperCase();

              return (
                <ClickableBookingCard 
                  key={booking.id}
                  booking={{
                    id: booking.id,
                    clientUsername: senderUsername,
                    clientAvatar: senderAvatar,
                    hostUsername: receiverUsername,
                    date: `${scheduledDate} at ${scheduledTime}`,
                    duration: `${durationHours} hrs`,
                    location: location,
                    hotelAddress: (booking as any).hotelAddress || (booking as any).hotel_address,
                    roomNumber: (booking as any).roomNumber || (booking as any).room_number,
                    grossAmount: depositAmount,
                    status: statusStr,
                    txRef: booking.id
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="w-8 h-8 text-zinc-700 mb-2" />
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No Active Bookings</h4>
            <p className="text-[11px] text-zinc-500 max-w-sm mt-1">
              Once you confirm and fund booking rendezvous proposals with verified companions, your active vault contracts will display here.
            </p>
          </div>
        )}
      </div>

      {/* 🔒 Footer Section */}
      <div className="mt-[10px] pt-[10px] border-t border-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-[10px] text-[10px] text-zinc-500 font-mono">
        <div className="flex items-center gap-[10px]">
          <ShieldAlert className="w-3.5 h-3.5 text-pink-500" />
          <span>Security Protocol: <span className="text-zinc-400">Secure Custody E2EE</span></span>
        </div>
        <div className="flex items-center gap-[10px]">
          <span>© 2026 LUSTY GLOBAL VIP Platform</span>
          <span className="h-1 w-1 bg-zinc-700 rounded-full" />
          <span>Transactions direct to multi-network bank nodes</span>
        </div>
      </div>

    </div>
  );
}
