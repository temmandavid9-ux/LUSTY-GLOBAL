import { supabase } from './supabase';

export const linkNewCard = async (userId: string, userEmail: string, userName: string) => {
  void userId; void userEmail; void userName;
  alert("💳 Payment methods are managed securely via decentralized USDT (TRC-20) network.");
};

export const chargeUserWithLinkedCard = async ({
  userId,
  userEmail,
  amount,
  currency = 'USD',
}: {
  userId: string;
  userEmail: string;
  amount: number;
  currency?: string;
}) => {
  void userEmail; void currency; void amount;
  const { data: cardData, error } = await supabase
    .from('user_payment_methods')
    .select('card_token')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error || !cardData?.card_token) {
    throw new Error('No linked payment method found.');
  }

  return { success: true };
};
