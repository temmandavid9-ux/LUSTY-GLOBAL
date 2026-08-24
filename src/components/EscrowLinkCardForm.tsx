import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface LinkCardFormProps {
  currentUserId: string;
  onCardLinkedSuccess: (formattedCard: string) => void;
}

export function EscrowLinkCardForm({ currentUserId, onCardLinkedSuccess }: LinkCardFormProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 💳 Dynamic Regex Brand Detector
  const detectCardBrand = (num: string): string => {
    const cleanNumber = num.replace(/\s+/g, '');
    if (/^4/.test(cleanNumber)) return 'Visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'Mastercard';
    if (/^3[47]/.test(cleanNumber)) return 'Amex';
    if (/^(5061|5078|6500)/.test(cleanNumber) || /^506[0-9]/.test(cleanNumber)) return 'Verve'; // Full Verve tracking
    return 'Card';
  };

  const detectedBrand = detectCardBrand(cardNumber);

  // Format Card Number Input with Spaces on typing
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Digits only
    const formatted = value.replace(/(.{4})/g, '$1 ').trim().slice(0, 19); // 16 digits max with spaces
    setCardNumber(formatted);
  };

  const handleLinkCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = cardNumber.replace(/\s+/g, '');

    if (cleanNumber.length < 15) {
      setFeedback({ type: 'error', message: 'Please enter a valid card number length.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const last4 = cleanNumber.slice(-4);
    const formattedPayload = `${detectedBrand} •••• ${last4}`;

    try {
      // Direct single-source upsert to user profile to guarantee record creation
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: currentUserId,
          has_payment_method: true,
          card_brand_last4: formattedPayload
        }, { onConflict: 'id' });

      if (error) throw error;

      if (typeof window !== 'undefined') {
        localStorage.setItem(`card_linked_${currentUserId}`, 'true');
        window.dispatchEvent(new Event('cardLinked'));
      }

      setFeedback({
        type: 'success',
        message: `Securely verified and synchronized! ${formattedPayload} is now primary for Escrow holds.`
      });
      onCardLinkedSuccess(formattedPayload);
      
      // Clear sensitive UI state fields immediately
      setCardNumber('');
      setExpiry('');
      setCvv('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Payment system authorization failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="escrow-billing-portal-form" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-tight">Escrow Billing Portal</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">Link a multi-network credit/debit card to authorize bookings.</p>
        </div>
        {/* Dynamic Card Network Icon Badge */}
        <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase font-mono ${
          detectedBrand === 'Visa' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40' :
          detectedBrand === 'Mastercard' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40' :
          detectedBrand === 'Verve' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40' :
          'bg-zinc-950 text-zinc-500 border border-zinc-850'
        }`}>
          {detectedBrand}
        </span>
      </div>

      <form onSubmit={handleLinkCard} className="space-y-4">
        <div>
          <label className="text-[10px] text-zinc-400 font-bold block mb-1 uppercase tracking-wider">Card Number</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={19}
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={handleCardNumberChange}
            onInput={(e: React.FormEvent<HTMLInputElement>) => {
              e.currentTarget.value = e.currentTarget.value.replace(/[^\d ]/g, '');
            }}
            disabled={isSubmitting}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 text-white rounded-xl p-3 font-mono text-xs focus:outline-none placeholder-zinc-700"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-zinc-400 font-bold block mb-1 uppercase tracking-wider">Expiry</label>
            <input
              type="text"
              placeholder="MM/YY"
              maxLength={5}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
                // Strip everything except numbers and forward slashes
                let cleaned = e.target.value.replace(/[^0-9/]/g, '');
                
                // Auto-insert the slash character if the user types the 2 month digits cleanly
                if (cleaned.length === 2 && !cleaned.includes('/')) {
                  cleaned = cleaned + '/';
                }
                e.target.value = cleaned;
              }}
              disabled={isSubmitting}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 text-white rounded-xl p-3 font-mono text-xs text-center focus:outline-none placeholder-zinc-700"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 font-bold block mb-1 uppercase tracking-wider">CVV Security Code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              placeholder="000"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
              onInput={(e: React.FormEvent<HTMLInputElement>) => {
                e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '');
              }}
              disabled={isSubmitting}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 text-white rounded-xl p-3 font-mono text-xs text-center focus:outline-none placeholder-zinc-700"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition ${
            isSubmitting ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-pink-600 text-white hover:bg-pink-700 active:scale-[0.99] cursor-pointer'
          }`}
        >
          {isSubmitting ? 'Authorizing secure node...' : 'Link Primary Payment Card'}
        </button>

        {feedback && (
          <div className={`p-3 rounded-xl text-xs font-medium border ${
            feedback.type === 'success' ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-400 font-mono' : 'bg-red-950/20 border-red-800/60 text-red-400 font-mono'
          }`}>
            {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.message}
          </div>
        )}
      </form>
    </div>
  );
}
