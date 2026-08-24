import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { initiateFlutterwavePayment } from '../lib/flutterwave';
import { chargeSavedCardToken } from '../lib/chargeLinkedCard';

export interface PaymentOptions {
  userId?: string;
  email?: string;
  name?: string;
  amountInCents?: number;
  amount?: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
  onSuccess: (response?: any) => Promise<void> | void;
  onClose?: () => void;
}

export async function executeCardPayment(options: PaymentOptions): Promise<void> {
  const {
    userId,
    amountInCents,
    amount: rawAmount,
    currency = 'USD',
    description = 'Card Payment',
    onSuccess,
    onClose
  } = options;

  let email = options.email;
  let name = options.name;

  // Resolve amount in dollars/main currency unit
  const finalAmount = rawAmount !== undefined
    ? rawAmount
    : (amountInCents !== undefined ? amountInCents / 100 : 0);

  if (finalAmount <= 0) {
    toast.error('Invalid payment amount');
    throw new Error('Invalid payment amount');
  }

  // Fetch user profile or auth info if email/name is missing
  if ((!email || !name) && userId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        email = email || user.email;
        name = name || user.user_metadata?.full_name || user.user_metadata?.name;
      }
      if (!email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name, username')
          .eq('id', userId)
          .maybeSingle();
        if (profile) {
          email = email || profile.email;
          name = name || profile.full_name || profile.username;
        }
      }
    } catch (err) {
      console.warn('Could not fetch user details for checkout:', err);
    }
  }

  const finalEmail = email || 'customer@gmail.com';
  const finalName = name || 'VIP Member';

  // 1. AUTOMATIC DEBIT CHECK: If user is logged in, check for a saved card token first
  if (userId) {
    try {
      const tokenCharge = await chargeSavedCardToken({
        userId,
        amountUSD: finalAmount,
        email: finalEmail,
        description
      });

      if (tokenCharge.success) {
        toast.success(`✓ Automatically debited ${finalAmount.toFixed(2)} from linked ${tokenCharge.cardBrand || 'Card'} •••• ${tokenCharge.last4 || '4242'}`);
        await onSuccess({
          status: 'successful',
          transaction_id: `FLW-TOK-${Date.now()}`,
          tx_ref: `TOK-${Date.now()}`,
          card: {
            last_4digits: tokenCharge.last4,
            type: tokenCharge.cardBrand
          },
          autoDebited: true
        });
        return;
      }
    } catch (err) {
      console.warn('Automatic token charge bypassed, falling back to manual checkout modal:', err);
    }
  }

  // 2. FALLBACK: If no linked card token exists, open standard manual Flutterwave checkout modal
  return new Promise<void>((resolve, reject) => {
    initiateFlutterwavePayment({
      amount: finalAmount,
      currency,
      email: finalEmail,
      name: finalName,
      description,
      meta: options.metadata,
      callback: async (response: any) => {
        if (response.status === 'successful' || response.status === 'completed') {
          try {
            await onSuccess(response);
            resolve();
          } catch (err) {
            console.error('Error executing onSuccess payment callback:', err);
            reject(err);
          }
        } else {
          toast.error('Payment was not successful or was declined.');
          reject(new Error('Payment was not successful'));
        }
      },
      onClose: () => {
        if (onClose) onClose();
        resolve();
      }
    });
  });
}

