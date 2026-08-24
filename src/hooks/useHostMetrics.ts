import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useHostMetrics(currentUserId: string) {
  const [metrics, setMetrics] = useState({
    totalViews: 0,
    totalLikes: 0,
    engRate: 0,
    pendingPayouts: 0,
    processingPayouts: 0,
    totalFollowers: 0 // New calculation tracking state
  });

  const getFollowersCountOnly = async () => {
    if (!currentUserId) return;
    try {
      const { count } = await supabase
        .from('user_followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', currentUserId);
      
      setMetrics(prev => ({
        ...prev,
        totalFollowers: count || 0
      }));
    } catch (err) {
      console.warn("Failed to fetch followers count:", err);
    }
  };

  useEffect(() => {
    async function getDashboardStats() {
      if (!currentUserId) return;

      try {
        // 1. Fetch payout rows from booking_ledgers or bookings or platform_ledger
        let { data: ledgerData } = await supabase
          .from('booking_ledgers')
          .select('*')
          .or(`companion_id.eq.${currentUserId},client_id.eq.${currentUserId}`);

        if (!ledgerData || ledgerData.length === 0) {
          const fallback = await supabase
            .from('bookings')
            .select('*')
            .or(`companion_id.eq.${currentUserId},client_id.eq.${currentUserId}`);
          if (fallback.data && fallback.data.length > 0) {
            ledgerData = fallback.data;
          }
        }

        if (!ledgerData || ledgerData.length === 0) {
          const platLedger = await supabase
            .from('platform_ledger')
            .select('*')
            .eq('recipient_id', currentUserId);
          if (platLedger.data && platLedger.data.length > 0) {
            ledgerData = platLedger.data.map((p: any) => ({
              ...p,
              status: p.settlement_status || p.status,
              gross_amount: p.amount || p.gross_amount
            }));
          }
        }

        let pendingSum = 0;
        let processingSum = 0;
        
        ledgerData?.forEach((row: any) => {
          const amt = Number(row.gross_amount || row.amount || row.net_payout || 0);
          const status = String(row.status || row.escrow_status || row.settlement_status || '').toLowerCase();
          if (['pending', 'escrowed', 'paid_escrow', 'funded', 'held'].includes(status)) {
            pendingSum += amt;
          } else if (['processing', 'pending_transfer', 'active'].includes(status)) {
            processingSum += amt;
          }
        });

        // 2. Fetch unique followers count matching this user profile
        const { count } = await supabase
          .from('user_followers')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', currentUserId);

        // 3. Hydrate state values
        setMetrics(prev => ({
          ...prev,
          pendingPayouts: pendingSum,
          processingPayouts: processingSum,
          totalFollowers: count || 0
        }));
      } catch (err) {
        console.warn("Error gathering host metrics:", err);
      }
    }

    getDashboardStats();

    if (!currentUserId) return;

    // Subscribe to live changes on the user_followers table
    const followerChannel = supabase
      .channel(`host-followers-live-${currentUserId}-${Math.random().toString(36).substring(2, 11)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_followers',
          filter: `following_id=eq.${currentUserId}`
        },
        () => {
          console.log('🔄 Follower change detected on host dashboard! Re-fetching count...');
          getFollowersCountOnly();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(followerChannel);
    };
  }, [currentUserId]);

  return { metrics };
}
