import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useRealtimeWallet = (userId: string | undefined) => {
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!userId) return;

    // 1. Initial Fetch
    const fetchBalance = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('wallet_balance, current_balance')
        .eq('id', userId)
        .single();
      
      if (data) {
        const val = data.wallet_balance !== undefined && data.wallet_balance !== null
          ? Number(data.wallet_balance)
          : Number(data.current_balance || 0);
        setBalance(val);
      }
    };

    fetchBalance();

    // 2. Subscribe to Real-Time Updates
    const channel = supabase
      .channel(`profile-wallet-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          if (payload.new) {
            if (payload.new.wallet_balance !== undefined && payload.new.wallet_balance !== null) {
              setBalance(Number(payload.new.wallet_balance));
            } else if (payload.new.current_balance !== undefined && payload.new.current_balance !== null) {
              setBalance(Number(payload.new.current_balance));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return balance;
};
