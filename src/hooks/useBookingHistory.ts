import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useBookingHistory = (userId: string) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveBookings = async () => {
    const activeUserId = userId;
    if (!activeUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const [ledgersRes, bookingsRes] = await Promise.all([
        supabase
          .from('booking_ledgers')
          .select('*')
          .or(`client_id.eq.${activeUserId},companion_id.eq.${activeUserId}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('*')
          .or(`client_id.eq.${activeUserId},companion_id.eq.${activeUserId}`)
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

      console.log("Fetched Bookings Raw Data (useBookingHistory):", combinedData);
      setBookings(combinedData);
    } catch (err: any) {
      console.warn('Exception in useBookingHistory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveBookings();

    if (!userId) return;

    // Realtime channel for instant booking status updates
    const channel = supabase
      .channel(`booking_history_realtime_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_ledgers' },
        (payload) => {
          console.log('🔄 Real-time database change detected (booking_ledgers)! Syncing history...', payload);
          fetchActiveBookings();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          console.log('🔄 Real-time database change detected (bookings)! Syncing history...', payload);
          fetchActiveBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { bookings, loading, refetch: fetchActiveBookings };
};
