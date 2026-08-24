import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useHostSettlements(userId: string | undefined) {
  const [settlements, setSettlements] = useState({
    pending: 0,
    processing: 0,
    settled: 0
  });

  useEffect(() => {
    if (!userId) return;

    async function fetchSettlements() {
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

      if (!data) return;

      // 2. Aggregate totals based on status categories case-insensitively
      let pendingSum = 0;
      let processingSum = 0;
      let settledSum = 0;

      data.forEach((record: any) => {
        const status = String(record.status || record.escrow_status || record.settlement_status || '').toLowerCase();
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

      setSettlements({
        pending: pendingSum,
        processing: processingSum,
        settled: settledSum
      });
    }

    fetchSettlements();

    // 3. Real-time sync listener for live updates
    const channel = supabase
      .channel(`settlements-realtime-${userId}`)
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
  }, [userId]);

  return settlements;
}
