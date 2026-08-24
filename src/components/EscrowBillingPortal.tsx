import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface BillingPortalProps {
  userId: string;
  userEmail?: string;
  userName?: string;
  onCardLinked?: () => void;
}

declare global {
  interface Window {
    FlutterwaveCheckout: any;
  }
}

export const EscrowBillingPortal: React.FC<BillingPortalProps> = ({
  userId,
  userEmail = 'client@example.com',
  userName = 'Valued Client',
  onCardLinked
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load Flutterwave inline script dynamically if not present
  const loadFlutterwaveScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.FlutterwaveCheckout) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.flutterwave.com/v3.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleLinkCardWithFlutterwave = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const scriptLoaded = await loadFlutterwaveScript();
    if (!scriptLoaded) {
      setErrorMsg('Failed to load Flutterwave SDK. Please check your internet connection.');
      setLoading(false);
      return;
    }

    const publicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK-0b7a5318b3a387ddb8b414f97502ac76-X';
    const txRef = `CARD-AUTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    window.FlutterwaveCheckout({
      public_key: publicKey,
      tx_ref: txRef,
      amount: 1, // $1 USD verification charge
      currency: 'USD',
      payment_options: 'card',
      customer: {
        email: userEmail,
        name: userName,
      },
      customizations: {
        title: 'LUSTY GLOBAL VIP Portal',
        description: 'Authorize Primary Card for Escrow Holds',
        logo: 'https://checkout.flutterwave.com/assets/img/logo-single.png',
      },
      callback: async (response: any) => {
        console.log('Flutterwave Auth Response:', response);

        // Check if transaction was successful
        if (response.status === 'successful' || response.status === 'completed') {
          try {
            const cardDetails = response.card || {};
            const lastFour = cardDetails.last_4digits || response.tx_ref.slice(-4) || '4242';
            const cardBrand = cardDetails.type || 'Visa/Mastercard';
            const authCode = response.token?.token || response.flw_ref || response.transaction_id;

            // 1. Store payment token securely in Supabase
            const { error: dbError } = await supabase
              .from('user_payment_methods')
              .insert({
                user_id: userId,
                card_brand: cardBrand,
                last_four: lastFour,
                exp_month: cardDetails.expiry?.split('/')[0] || '12',
                exp_year: cardDetails.expiry?.split('/')[1] || '28',
                flw_token: String(authCode),
                is_primary: true,
                status: 'active'
              });

            if (dbError) {
              console.warn('user_payment_methods table insert notice:', dbError.message);
            }

            // 2. Mark profile as card_linked / has_payment_method
            await supabase
              .from('profiles')
              .update({ card_linked: true, has_payment_method: true })
              .eq('id', userId);

            setSuccessMsg(`✓ Primary ${cardBrand} (•••• ${lastFour}) verified & saved for Escrow Holds!`);

            if (typeof window !== 'undefined') {
              localStorage.setItem(`card_linked_${userId}`, 'true');
              window.dispatchEvent(new Event('cardLinked'));
            }
            
            if (onCardLinked) onCardLinked();
          } catch (err: any) {
            console.error('Failed to record linked card token:', err);
            setErrorMsg(`Card authorized, but saving token failed: ${err.message}`);
          }
        } else {
          setErrorMsg('Card verification was declined or cancelled.');
        }

        setLoading(false);
      },
      onclose: () => {
        setLoading(false);
      },
    });
  };

  return (
    <div id="escrow-billing-portal" className="bg-[#12131A] border border-gray-800 rounded-2xl p-6 text-white shadow-xl max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold tracking-wide">ESCROW BILLING PORTAL</h3>
          <p className="text-xs text-gray-400 mt-1">
            Link a multi-network credit/debit card to authorize automated booking holds.
          </p>
        </div>
        <span className="px-3 py-1 bg-gray-800 border border-gray-700 text-xs font-mono text-gray-300 rounded-md">
          CARD
        </span>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-400 text-xs rounded-lg font-mono">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-500/50 text-emerald-400 text-xs rounded-lg font-mono">
          {successMsg}
        </div>
      )}

      <div className="bg-[#0A0B0E] border border-gray-800/80 rounded-xl p-5 mb-5 text-center">
        <div className="text-3xl mb-2">💳</div>
        <h4 className="text-sm font-semibold text-gray-200">Instant Card Authorization</h4>
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
          Flutterwave will verify your card with a temporary authorization. Your card token will be saved for instant Escrow Holds on future rendezvous bookings.
        </p>
      </div>

      <button
        type="button"
        onClick={handleLinkCardWithFlutterwave}
        disabled={loading}
        className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3.5 px-6 rounded-xl tracking-wider uppercase transition-colors shadow-lg shadow-pink-600/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <>
            <span className="animate-spin text-lg">⏳</span> Opening Flutterwave Secure Portal...
          </>
        ) : (
          'LINK PRIMARY PAYMENT CARD'
        )}
      </button>
    </div>
  );
};

export default EscrowBillingPortal;
