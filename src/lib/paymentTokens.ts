import { supabase } from './supabase';
import { loadFlutterwaveScript } from './flutterwave';

// Open Flutterwave modal to link a new card
export const linkNewCard = async (userId: string, userEmail: string, userName: string) => {
  const loaded = await loadFlutterwaveScript();
  if (!loaded) {
    alert('⚠️ Failed to load Flutterwave checkout script.');
    return;
  }

  const publicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK-0b7a5318b3a387ddb8b414f97502ac76-X';
  const isTestKey = publicKey.includes('TEST') || publicKey.startsWith('FLWPUBK_TEST');

  // Sanitize email
  let sanitizedEmail = (userEmail || '').replace(/\s+/g, '').toLowerCase();
  if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(sanitizedEmail)) {
    sanitizedEmail = 'vipmember@gmail.com';
  }

  const paymentData = {
    public_key: publicKey,
    tx_ref: `LINK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    amount: isTestKey ? 100 : 1, // Nominal test/authorization charge
    currency: isTestKey ? 'NGN' : 'USD',
    payment_options: 'card',
    customer: {
      email: sanitizedEmail,
      name: userName || 'Platform User',
    },
    customizations: {
      title: 'Link Payment Card',
      description: 'Card verification and tokenization',
    },
    callback: async (response: any) => {
      if ((response.status === 'successful' || response.status === 'completed') && response.card?.token) {
        try {
          // Save the reusable token to Supabase
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
            console.error('Error saving card token:', error.message);
            alert(`Card tokenized but database save notice: ${error.message}`);
          } else {
            alert('💳 Card linked successfully!');
          }
        } catch (dbErr: any) {
          console.error('Exception saving card token:', dbErr);
          alert('💳 Card tokenized successfully!');
        }
      } else {
        alert('Card authorization completed or finished without token payload.');
      }
    },
  };

  if (typeof (window as any).FlutterwaveCheckout === 'function') {
    (window as any).FlutterwaveCheckout(paymentData);
  } else {
    alert('Flutterwave SDK not ready.');
  }
};

// Execute payment in Frontend using linked card token
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
  // 1. Fetch user's default saved card token
  const { data: cardData, error } = await supabase
    .from('user_payment_methods')
    .select('card_token')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error || !cardData?.card_token) {
    throw new Error('No linked card found. Please link a card first.');
  }

  // 2. Invoke Edge Function to charge the saved token
  const { data: chargeResult, error: chargeError } = await supabase.functions.invoke(
    'charge-card-token',
    {
      body: {
        token: cardData.card_token,
        amount: amount,
        currency: currency,
        email: userEmail,
        txRef: `BOOST-${Date.now()}`,
      },
    }
  );

  if (chargeError || !chargeResult?.success) {
    throw new Error(chargeResult?.message || chargeError?.message || 'Token debit failed.');
  }

  return chargeResult;
};
