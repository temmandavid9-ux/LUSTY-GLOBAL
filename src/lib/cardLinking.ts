import { supabase } from './supabase';
import { loadFlutterwaveScript } from './flutterwave';

interface LinkCardParams {
  userId: string;
  email: string;
  name?: string;
  onSuccess?: () => void;
  onError?: (err: any) => void;
}

export const launchCardLinkingModal = async ({
  userId,
  email,
  name,
  onSuccess,
  onError,
}: LinkCardParams) => {
  const loaded = await loadFlutterwaveScript();
  if (!loaded) {
    const err = new Error('Failed to load Flutterwave checkout script.');
    if (onError) onError(err);
    return;
  }

  const publicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK-0b7a5318b3a387ddb8b414f97502ac76-X';
  const isTestKey = publicKey.includes('TEST') || publicKey.startsWith('FLWPUBK_TEST');

  // Sanitize email
  let sanitizedEmail = (email || '').replace(/\s+/g, '').toLowerCase();
  if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(sanitizedEmail)) {
    sanitizedEmail = 'vipmember@gmail.com';
  }

  const txRef = `LINK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const paymentData = {
    public_key: publicKey,
    tx_ref: txRef,
    amount: isTestKey ? 100 : 1, // Nominal amount for verification
    currency: isTestKey ? 'NGN' : 'USD',
    payment_options: 'card',
    customer: {
      email: sanitizedEmail,
      name: name || 'User',
    },
    customizations: {
      title: 'Link Payment Card',
      description: 'Card verification and tokenization',
    },
    callback: async (response: any) => {
      if ((response.status === 'successful' || response.status === 'completed') && response.card?.token) {
        try {
          // Remove previous default flags
          await supabase
            .from('user_payment_methods')
            .update({ is_default: false })
            .eq('user_id', userId);

          // Save new card token
          const { error } = await supabase.from('user_payment_methods').insert({
            user_id: userId,
            card_token: response.card.token,
            card_brand: response.card.type || 'CARD',
            last_4_digits: response.card.last_4digits || response.card.last4 || '****',
            exp_month: response.card.expiry?.split('/')[0] || '',
            exp_year: response.card.expiry?.split('/')[1] || '',
            is_default: true,
          });

          if (error) {
            console.error('Failed to save card token in database:', error.message);
          }

          if (onSuccess) onSuccess();
        } catch (err) {
          console.error('Failed to save card token:', err);
          if (onError) onError(err);
        }
      } else {
        if (onError) onError(new Error('Card authorization failed or token missing.'));
      }
    },
    onclose: () => {
      console.log('Card linking modal closed.');
    }
  };

  if (typeof (window as any).FlutterwaveCheckout === 'function') {
    (window as any).FlutterwaveCheckout(paymentData);
  } else {
    if (onError) onError(new Error('Flutterwave Checkout SDK unavailable.'));
  }
};
