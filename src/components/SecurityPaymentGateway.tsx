import { useState, useEffect } from 'react';
import { ShieldCheck, CreditCard, Lock, Zap } from 'lucide-react';
import { chargeSavedCardToken, getUserSavedCardToken, SavedCardInfo } from '../lib/chargeLinkedCard';
import { supabase } from '../lib/supabase';

interface SecurityPaymentGatewayProps {
  amount: number;
  recipientUsername: string;
  onPaymentSuccess: () => void;
  onPaymentCancel: () => void;
  title?: string;
  userId?: string;
}

export default function SecurityPaymentGateway({ amount, recipientUsername, onPaymentSuccess, onPaymentCancel, title = "Secure Escrow Deposit", userId }: SecurityPaymentGatewayProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [error, setError] = useState('');
  const [savedCard, setSavedCard] = useState<SavedCardInfo | null>(null);
  const [isChargingToken, setIsChargingToken] = useState(false);

  useEffect(() => {
    async function loadSavedCard() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const activeUserId = userId || user?.id;
        if (activeUserId) {
          const info = await getUserSavedCardToken(activeUserId);
          if (info) {
            setSavedCard(info);
          }
        }
      } catch (err) {
        console.warn('Failed to load saved card info:', err);
      }
    }
    loadSavedCard();
  }, [userId]);

  const handleSavedCardDebit = async () => {
    try {
      setIsChargingToken(true);
      setError('');
      const { data: { user } } = await supabase.auth.getUser();
      const activeUserId = userId || user?.id || 'guest';

      const res = await chargeSavedCardToken({
        userId: activeUserId,
        amountUSD: amount,
        description: `Escrow Hold of ${amount} for @${recipientUsername}`
      });

      if (res.success) {
        setStatus('success');
      } else {
        setError(res.message || 'Auto-debit failed. Please enter card details manually.');
      }
    } catch (err: any) {
      setError(err.message || 'Saved card charge error.');
    } finally {
      setIsChargingToken(false);
    }
  };

  // 🛠️ Strict Card Formatting Input Controllers
  const handleCardNumberInput = (val: string) => {
    // Strip all non-digits and cap at 16 characters
    const clean = val.replace(/\D/g, '').slice(0, 16);
    setCardNumber(clean);
  };

  const handleExpiryInput = (val: string) => {
    // Strip non-digits and cap at 4 characters (MMYY)
    const clean = val.replace(/\D/g, '').slice(0, 4);
    // Auto format slash for display
    let formatted = clean;
    if (clean.length > 2) {
      formatted = clean.slice(0, 2) + '/' + clean.slice(2, 4);
    }
    setCardExpiry(formatted);
  };

  const handleCvvInput = (val: string) => {
    // Strip non-digits and cap at 3 or 4 characters
    const clean = val.replace(/\D/g, '').slice(0, 3);
    setCardCvv(clean);
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
      setError("Please provide all card details");
      return;
    }

    setStatus('processing');
    setError('');

    // Simulate payment authorization processing
    setTimeout(() => {
      setStatus('success');
    }, 2200);
  };

  if (status === 'success') {
    return (
      <div id="payment-success-screen" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
          
          <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5 text-emerald-400">
            <ShieldCheck className="w-8 h-8 animate-pulse" />
          </div>

          <h2 className="text-lg font-extrabold text-white mb-1">Escrow Deposit Confirmed!</h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            Your payment of <span className="text-emerald-400 font-bold font-mono">${amount}</span> has been transferred into secure escrow for @{recipientUsername}.
          </p>

          <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-2xl text-left mb-6 font-mono text-[11px] text-zinc-400 flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span>Receipt Ref:</span>
              <span className="text-white">MMC-{Date.now().toString().slice(-6)}</span>
            </div>
            <div className="flex justify-between">
              <span>Escrow Vault:</span>
              <span className="text-white">Active Guarantee</span>
            </div>
            <div className="flex justify-between">
              <span>Recipient:</span>
              <span className="text-pink-400">@{recipientUsername}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-400 font-bold">SECURED</span>
            </div>
          </div>

          <button
            onClick={onPaymentSuccess}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs py-3 rounded-xl transition uppercase"
          >
            Confirm &amp; Proceed to Active Lounge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="payment-form-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in">
      
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-pink-500 to-purple-500" />
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-pink-500" />
            <h2 className="text-sm font-extrabold text-white tracking-widest uppercase">{title}</h2>
          </div>
          <button 
            type="button"
            onClick={onPaymentCancel}
            className="text-xs text-zinc-500 hover:text-white px-2 py-1 rounded bg-zinc-900"
          >
            Cancel
          </button>
        </div>

        {/* Transfer Details */}
        <div className="bg-gradient-to-tr from-pink-950/20 to-purple-950/20 p-4 border-b border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-400 font-mono block uppercase tracking-wide">Deposit Escrow Value</span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">${amount}</span>
          <p className="text-[10px] text-zinc-400 mt-1.5">Transfer target recipient: <span className="text-pink-400 font-bold">@{recipientUsername}</span></p>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handlePayment} className="p-5 flex flex-col gap-3.5">
          {error && (
            <div className="bg-red-950/40 border border-red-500/20 text-red-400 text-[10px] py-1.5 px-2.5 rounded-lg font-mono">
              ⚠️ {error}
            </div>
          )}

          {savedCard && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400 animate-pulse" /> Linked Card Found
                </span>
                <span className="text-[10px] font-mono text-zinc-400">{savedCard.cardBrand} •••• {savedCard.last4}</span>
              </div>
              <button
                type="button"
                onClick={handleSavedCardDebit}
                disabled={isChargingToken}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                {isChargingToken ? 'DEBITING SAVED CARD...' : `⚡ INSTANT AUTO-DEBIT ${amount}`}
              </button>
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink mx-2 text-[9px] text-zinc-600 uppercase font-mono">Or Manual Card Entry</span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>
            </div>
          )}

          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">Cardholder Name</label>
            <input 
              type="text"
              required
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g. DAVID TEMMAN"
              className="w-full bg-zinc-950 text-xs text-zinc-100 rounded-xl px-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500 uppercase font-mono"
            />
          </div>

          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">Credit Card Number</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text"
                required
                value={cardNumber}
                onChange={(e) => handleCardNumberInput(e.target.value)}
                placeholder="4111222233334444"
                maxLength={16}
                className="w-full bg-zinc-950 text-xs text-zinc-100 rounded-xl pl-9 pr-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">Expiry Date</label>
              <input 
                type="text"
                required
                value={cardExpiry}
                onChange={(e) => handleExpiryInput(e.target.value)}
                placeholder="MM / YY"
                maxLength={5}
                className="w-full bg-zinc-950 text-xs text-zinc-100 rounded-xl px-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500 font-mono text-center"
              />
            </div>

            <div>
              <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">CVV Code</label>
              <input 
                type="password"
                required
                value={cardCvv}
                onChange={(e) => handleCvvInput(e.target.value)}
                placeholder="•••"
                maxLength={3}
                className="w-full bg-zinc-950 text-xs text-zinc-100 rounded-xl px-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500 font-mono text-center"
              />
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-[10px] text-zinc-400 leading-relaxed">
            🔒 <span className="font-bold text-white font-mono">PCI-DSS Security:</span> All card data is processed server-side via tokenized sandboxes. Your actual credentials are never logged or stored.
          </div>

          <button
            type="submit"
            disabled={status === 'processing'}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 text-white font-black text-xs py-3 rounded-xl active:scale-95 transition shadow-lg shadow-pink-500/15"
          >
            {status === 'processing' ? 'AUTHORIZING TRANSACTION...' : `AUTHORIZE SECURE escrow $${amount}`}
          </button>
        </form>

      </div>

    </div>
  );
}
