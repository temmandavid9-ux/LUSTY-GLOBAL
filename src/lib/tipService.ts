import { supabase } from './supabase';

interface RecordTipParams {
  tipperId: string;
  recipientId: string;
  amount: number;
  currency?: string;
  txRef?: string;
  tipperName?: string;
}

export const recordCompletedTip = async ({
  tipperId,
  recipientId,
  amount,
  currency = 'USD',
  txRef = '',
  tipperName = 'A user'
}: RecordTipParams) => {
  try {
    // A. Record tip in the tips table
    const { error: tipError } = await supabase.from('tips').insert({
      tipper_id: tipperId,
      recipient_id: recipientId,
      amount: amount,
      currency: currency,
      tx_ref: txRef,
    });

    if (tipError) {
      console.warn('Tip insert warning:', tipError.message);
    }

    // B. Credit recipient wallet balance via RPC if available
    try {
      const { error: walletError } = await supabase.rpc('credit_user_wallet', {
        target_user_id: recipientId,
        credit_amount: amount,
      });

      if (walletError) {
        console.warn('RPC credit_user_wallet fallback notice:', walletError.message);
      }
    } catch (rpcErr) {
      console.warn('credit_user_wallet RPC missing or failed:', rpcErr);
    }

    // C. Insert tip receipt message into chat_messages
    const formattedAmount = `${currency === 'USD' ? '$' : '₦'}${Number(amount).toFixed(2)}`;
    try {
      const { error: messageError } = await supabase.from('chat_messages').insert({
        sender_id: tipperId,
        receiver_id: recipientId,
        message_text: JSON.stringify({
          text: `💸 Sent a tip of ${formattedAmount}!`,
          type: 'tip',
          amount: amount
        }),
        is_read: false
      });

      if (messageError) {
        console.warn('Chat message log failed:', messageError.message);
      }
    } catch (msgErr) {
      console.warn('Chat message log exception:', msgErr);
    }

    // D. Insert in-app notification for recipient
    try {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: recipientId,
        title: 'Tip Received!',
        message: `${tipperName} sent you a tip of ${formattedAmount}.`,
      });

      if (notifError) {
        console.warn('Notification log warning:', notifError.message);
      }
    } catch (notifErr) {
      console.warn('Notification log exception:', notifErr);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error recording completed tip:', error);
    return { success: false, error };
  }
};
