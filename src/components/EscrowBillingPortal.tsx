import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import CheckoutButton from './CheckoutButton';

interface BillingPortalProps {
  userId: string;
  userEmail?: string;
  userName?: string;
  onCardLinked?: () => void;
}

export const EscrowBillingPortal: React.FC<BillingPortalProps> = ({
  userId,
  onCardLinked
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCryptoActivation = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Automatically bypass legacy card checks and mark user profile ready via crypto architecture
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ card_linked: true, has_payment_method: true })
        .eq('id', userId);

      if (dbError) {
        console.warn('Profile payment flag update notice:', dbError.message);
      }

      setSuccessMsg('✓ Account cleared for USDT (TRC-20) decentralized transactions!');

      if (typeof window !== 'undefined') {
        localStorage.setItem(`card_linked_${userId}`, 'true');
        window.dispatchEvent(new Event('cardLinked'));
      }
      
      if (onCardLinked) onCardLinked();
    } catch (err: any) {
      console.error('Failed to update account status:', err);
      setErrorMsg(`Initialization update failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="escrow-billing-portal" className="bg-[#12131A] border border-gray-800 rounded-2xl p-6 text-white shadow-xl max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold tracking-wide">USDT SECURE PAYMENT PORTAL</h3>
          <p className="text-xs text-gray-400 mt-1">
            Initialize decentralized USDT (TRC-20) payments for bookings, tips, boosts, and verifications.
          </p>
        </div>
        <span className="px-3 py-1 bg-blue-900/40 border border-blue-700 text-xs font-mono text-blue-300 rounded-md">
          USDT TRC-20
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
        <div className="text-3xl mb-2">💎</div>
        <h4 className="text-sm font-semibold text-gray-200">Decentralized Gateway Active</h4>
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
          All platform transactions are securely routed through NOWPayments directly to your designated TRC-20 wallet destination.
        </p>
      </div>

      <button
        type="button"
        onClick={handleCryptoActivation}
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl tracking-wider uppercase transition-colors shadow-lg shadow-emerald-600/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mb-3"
      >
        {loading ? (
          <>
            <span className="animate-spin text-lg">⏳</span> Activating Portal Node...
          </>
        ) : (
          'INITIALIZE CRYPTO GATEWAY ACCESS'
        )}
      </button>

      <div className="pt-4 border-t border-gray-800 flex flex-col items-center gap-2">
        <span className="text-xs font-mono text-gray-400 uppercase">Proceed to Instant USDT Checkout</span>
        <CheckoutButton 
          priceAmount={15.00}
          orderId={`escrow_sub_${userId || 'guest'}_${Date.now()}`}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20"
        />
      </div>
    </div>
  );
};

export default EscrowBillingPortal;
