import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useSharedBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch current authenticated session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const userId = user.id;

      // 2. Query BOTH 'booking_ledgers' and 'bookings' concurrently to guarantee complete coverage
      const [ledgersRes, bookingsRes] = await Promise.all([
        supabase
          .from('booking_ledgers')
          .select('*')
          .or(`client_id.eq.${userId},companion_id.eq.${userId}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('*')
          .or(`client_id.eq.${userId},companion_id.eq.${userId}`)
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

      console.log("Fetched Bookings Raw Data (useSharedBookings):", combinedData);
      setBookings(combinedData);
    } catch (err: any) {
      console.error("Error in useSharedBookings:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();

    // Setup global real-time listeners for instant synchronization
    const channel = supabase
      .channel('shared_bookings_global_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_ledgers' },
        () => fetchBookings()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => fetchBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings]);

  return { bookings, loading, error, refetch: fetchBookings };
};
