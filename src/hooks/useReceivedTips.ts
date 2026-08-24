import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ReceivedTip {
  id: string;
  amount: number;
  currency: string;
  created_at: string;
  tipper_id: string;
  tipper_name?: string;
}

export const useReceivedTips = (userId: string) => {
  const [tips, setTips] = useState<ReceivedTip[]>([]);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchTipsAndBalance = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // Fetch received tips
      const { data: tipData, error: tipError } = await supabase
        .from('tips')
        .select('id, amount, currency, created_at, tipper_id')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });

      if (!tipError && tipData) {
        setTips(tipData);
        const total = tipData.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        setTotalEarned(total);
      } else if (tipError) {
        console.warn('Could not fetch tips from tips table:', tipError.message);
      }
    } catch (err) {
      console.warn('Error fetching received tips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTipsAndBalance();

    if (!userId) return;

    // Realtime listener for incoming tips
    const channel = supabase
      .channel(`received_tips_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tips',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          fetchTipsAndBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { tips, totalEarned, loading, refetch: fetchTipsAndBalance };
};
