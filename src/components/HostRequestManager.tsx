import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface BookingRequest {
  id: string;
  created_at: string;
  duration_hours: number;
  hourly_rate_at_booking: number;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'paid_escrow' | 'pending_confirmation' | 'pending_transfer' | 'funded';
  escrow_status: 'held' | 'released' | 'refunded';
  client_id: string;
  location: string;
}

interface RequestManagerProps {
  currentUserId: string;
  isPayoutVerified: boolean;
}

export function HostRequestManager({ currentUserId, isPayoutVerified: _isPayoutVerified }: RequestManagerProps) {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // 1. Fetch live booking inquiries tied to client or companion ID from booking_ledgers
  const fetchActiveBookings = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const activeId = currentUserId || user?.id;

      // Strict safeguard: Clear records and stop if no user is signed in
      if (!activeId) {
        setBookings([]);
        setIsLoading(false);
        return;
      }

      const [ledgersRes, bookingsRes] = await Promise.all([
        supabase
          .from('booking_ledgers')
          .select('*')
          .or(`client_id.eq.${activeId},companion_id.eq.${activeId}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('*')
          .or(`client_id.eq.${activeId},companion_id.eq.${activeId}`)
          .order('created_at', { ascending: false })
      ]);

      const rawData = [
        ...(ledgersRes.data || []),
        ...(bookingsRes.data || [])
      ];

      const seen = new Set<string>();
      const combinedData = rawData.filter(item => {
        const key = item.id || item.tx_ref;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      console.log("Fetched Bookings Raw Data (HostRequestManager):", combinedData);
      setBookings(combinedData);
    } catch (err: any) {
      console.error('Error fetching host ledger:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveBookings();

    const channel = supabase
      .channel(`host_request_manager_realtime_${currentUserId || 'active'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_ledgers' },
        (payload) => {
          console.log('🔄 Real-time database change detected (booking_ledgers)! Syncing host requests...', payload);
          fetchActiveBookings();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          console.log('🔄 Real-time database change detected (bookings)! Syncing host requests...', payload);
          fetchActiveBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // 2. Action: Accept incoming appointment
  const handleAcceptBooking = async (id: string) => {
    setActionLoadingId(id);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', id);

      if (error) throw error;
      await fetchActiveBookings(); // Refresh single source of truth
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Action: Host marks the rendezvous as completed (initiates escrow confirmation flow)
  const handleMarkCompleted = async (id: string) => {
    setActionLoadingId(id);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'pending_confirmation' })
        .eq('id', id);

      if (error) throw error;
      await fetchActiveBookings();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 4. Action: Simulate the 24-hour safety timer bypass / auto-release trigger
  const handleSimulateAutoRelease = async (id: string) => {
    setActionLoadingId(id);
    try {
      const response = await fetch("https://vtmaffcyvhnnmfibfswm.supabase.co/functions/v1/release-booking-funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId: id })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert("🚨 [Auto-Release Sandbox] 24-Hour safety window expired without dispute. Escrow released automatically to your linked bank account!");
        await fetchActiveBookings();
      } else {
        alert(`❌ Failed to release escrow: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      console.error("Error running auto-release simulation:", err);
      alert(`❌ Connection error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800/60">
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-tight">Rendezvous Request Manager</h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">Approve incoming requests, complete rendezvous, and track secure escrow releases.</p>
        </div>
        <button 
          onClick={fetchActiveBookings}
          className="p-1.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 rounded-lg text-[10px] font-mono border border-zinc-850 transition cursor-pointer font-black"
        >
          🔄 Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-xs font-mono text-zinc-500 animate-pulse">Syncing transaction registry...</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl font-mono">
          No rendezvous requests filed yet.
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const totalCost = (booking.duration_hours || 1) * (booking.hourly_rate_at_booking || 250);
            return (
              <div key={booking.id} className="bg-zinc-950/80 border border-zinc-850 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Core Information Block */}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-white">ID: ...{booking.id.slice(-6)}</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                      booking.status === 'pending' || booking.status === 'paid_escrow' || booking.status === 'funded' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      booking.status === 'pending_transfer' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      booking.status === 'confirmed' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      booking.status === 'pending_confirmation' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                      booking.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>
                      {booking.status === 'paid_escrow' || booking.status === 'funded' ? 'funded (escrow)' : booking.status === 'pending_transfer' ? 'pending bank transfer' : booking.status === 'pending_confirmation' ? 'rendered' : booking.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 font-mono">
                    ⏱️ {booking.duration_hours} {booking.duration_hours === 1 ? 'Hour' : 'Hours'} @ ${booking.hourly_rate_at_booking}/hr
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    Secure Hold: <span className="text-emerald-400 font-bold">${totalCost}</span> ({booking.status === 'completed' ? 'released' : 'held'} in platform escrow)
                  </p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                    📍 {booking.location || 'London, Mayfair'}
                  </p>
                </div>

                {/* Dynamic Action Trigger Blocks */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('lounge-start-video-call', {
                        detail: {
                          booking: {
                            id: booking.id,
                            duration: booking.duration_hours || 1,
                            rate: booking.hourly_rate_at_booking || 250,
                            location: booking.location || 'London, Mayfair',
                            escrowDeposit: (booking.duration_hours || 1) * (booking.hourly_rate_at_booking || 250)
                          }
                        }
                      }));
                    }}
                    className="bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                    title="Start 1-on-1 WebRTC Video Session"
                  >
                    🎥 Start Video Call
                  </button>

                  {(booking.status === 'pending' || booking.status === 'paid_escrow' || booking.status === 'pending_transfer') && (
                    <button
                      type="button"
                      onClick={() => handleAcceptBooking(booking.id)}
                      disabled={actionLoadingId === booking.id}
                      className="bg-zinc-900 hover:bg-zinc-850 text-white font-black text-[10px] uppercase px-3 py-2 rounded-xl border border-zinc-800 cursor-pointer active:scale-98 transition shrink-0"
                    >
                      Accept Booking
                    </button>
                  )}

                  {booking.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => handleMarkCompleted(booking.id)}
                      disabled={actionLoadingId === booking.id}
                      className="bg-pink-600 hover:bg-pink-700 text-white font-black text-[10px] uppercase px-3 py-2 rounded-xl tracking-wider shadow-lg shadow-pink-950/20 cursor-pointer active:scale-98 transition shrink-0"
                    >
                      {actionLoadingId === booking.id ? 'Updating...' : 'Mark Completed (Send request)'}
                    </button>
                  )}

                  {booking.status === 'pending_confirmation' && (
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      <span className="text-[10px] text-amber-400 font-semibold italic bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 shrink-0">
                        ⏳ Awaiting Client Release
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSimulateAutoRelease(booking.id)}
                        disabled={actionLoadingId === booking.id}
                        className="bg-zinc-900 hover:bg-zinc-850 text-amber-500 hover:text-amber-400 border border-zinc-800 font-black text-[9px] uppercase px-2.5 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
                        title="In sandbox testing, click to bypass the 24-hour wait and auto-release the payout instantly."
                      >
                        {actionLoadingId === booking.id ? 'Processing...' : 'Simulate 24h Auto-Release'}
                      </button>
                    </div>
                  )}

                  {booking.status === 'completed' && (
                    <span className="text-[10px] text-emerald-400 font-black tracking-wider uppercase border border-emerald-950/40 bg-emerald-950/10 px-3 py-1.5 rounded-lg font-mono shrink-0">
                      💰 Payout Disbursed
                    </span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
