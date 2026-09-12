import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useHostSettlements(userId: string | undefined) {
  const [settlements, setSettlements] = useState({
    pending: 0,
    processing: 0,
    settled: 0
  });

  const fetchSettlements = useCallback(async () => {
    if (!userId) return;

    try {
      // 0. Check profile settled_balance first
      let profileSettledBalance: number | null = null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('settled_balance, earnings')
        .eq('id', userId)
        .single();

      if (profile && (profile.settled_balance !== null && profile.settled_balance !== undefined)) {
        profileSettledBalance = Number(profile.settled_balance);
      } else if (profile && (profile.earnings !== null && profile.earnings !== undefined)) {
        profileSettledBalance = Number(profile.earnings);
      }

      // 1. Query booking_ledgers scoped to the active user as a companion or client
      let { data, error } = await supabase
        .from('booking_ledgers')
        .select('*')
        .or(`companion_id.eq.${userId},client_id.eq.${userId}`);

      // Fallback to bookings table if empty
      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from('bookings')
          .select('*')
          .or(`companion_id.eq.${userId},client_id.eq.${userId}`);
        
        if (!fallback.error && fallback.data) {
          data = fallback.data;
        }
      }

      // Fallback to platform_ledger if empty
      if (!data || data.length === 0) {
        const platLedger = await supabase
          .from('platform_ledger')
          .select('*')
          .eq('recipient_id', userId);

        if (!platLedger.error && platLedger.data && platLedger.data.length > 0) {
          data = platLedger.data.map((p: any) => ({
            ...p,
            status: p.settlement_status || p.status,
            gross_amount: p.amount || p.gross_amount
          }));
        }
      }

      // Fallback to transaction_history if empty
      if (!data || data.length === 0) {
        const txHist = await supabase
          .from('transaction_history')
          .select('*')
          .or(`receiver_id.eq.${userId},sender_id.eq.${userId}`);

        if (!txHist.error && txHist.data && txHist.data.length > 0) {
          data = txHist.data;
        }
      }

      let pendingSum = 0;
      let processingSum = 0;
      let settledSum = 0;

      if (data && data.length > 0) {
        data.forEach((record: any) => {
          const status = String(record.status || record.escrow_status || record.settlement_status || '').toLowerCase();
          
          // Ignore records that have already been withdrawn / paid out
          if (['withdrawn', 'paid_out', 'disbursed', 'archived', 'payout'].includes(status)) {
            return;
          }

          const rawAmt = 
            record.gross_amount ?? 
            record.net_payout ?? 
            record.amount ?? 
            (record.hourly_rate_at_booking ? record.hourly_rate_at_booking * (record.duration_hours || 1) : null) ?? 
            (record.rate ? record.rate * (record.duration || 1) : null) ?? 
            0;
          const amount = Number(rawAmt || 0);

          if (['pending', 'escrowed', 'paid_escrow', 'funded', 'held'].includes(status)) {
            pendingSum += amount;
          } else if (['processing', 'pending_transfer', 'active', 'pending_confirmation'].includes(status)) {
            processingSum += amount;
          } else if (['settled', 'completed', 'released'].includes(status)) {
            settledSum += amount;
          } else if (status) {
            if (status.includes('pend') || status.includes('hold') || status.includes('escrow')) {
              pendingSum += amount;
            } else if (status.includes('process') || status.includes('transf')) {
              processingSum += amount;
            } else if (status.includes('settle') || status.includes('complete') || status.includes('release') || status.includes('success')) {
              settledSum += amount;
            } else {
              pendingSum += amount;
            }
          }
        });
      }

      // If user profile explicitly defines settled_balance (e.g. 0 after payout), prioritize it
      const finalSettled = profileSettledBalance !== null ? profileSettledBalance : settledSum;

      setSettlements({
        pending: pendingSum,
        processing: processingSum,
        settled: Math.max(0, finalSettled)
      });
    } catch (err) {
      console.warn("Error fetching settlements:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    fetchSettlements();

    // Real-time sync listener for live updates
    const channel = supabase
      .channel(`settlements-realtime-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchSettlements();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchSettlements();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_ledgers' }, () => {
        fetchSettlements();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_history' }, () => {
        fetchSettlements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSettlements]);

  return {
    ...settlements,
    refetch: fetchSettlements
  };
}
