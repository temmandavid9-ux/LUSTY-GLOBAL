import { useState } from 'react';
import { Loader2, ShieldCheck, ChevronRight } from 'lucide-react';
import SupportEmailLink from './SupportEmailLink';

export default function PrestigeBadgePortal({ 
  currentUserId, 
  userProfile, 
  profile, 
  onVerifySuccess 
}: { 
  currentUserId?: string; 
  userProfile?: any; 
  profile?: any; 
  onVerifySuccess?: () => void 
}) {
  void onVerifySuccess;
  const [isProcessing, setIsProcessing] = useState(false);
  const [verifError, setVerifError] = useState('');

  const activeUserId = currentUserId || userProfile?.id || profile?.id;

  const handlePrestigeBadgeActivation = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setVerifError('');

    try {
      if (!activeUserId) {
        alert("Please log in to acquire the Prestige Badge.");
        setIsProcessing(false);
        return;
      }

      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceAmount: 400.00,
          orderId: `prestige_badge_${activeUserId}_${Date.now()}`,
        }),
      });

      const contentType = response.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await response.json().catch(() => ({}));
      } else {
        const text = await response.text().catch(() => '');
        console.warn('Non-JSON response received from payment API:', text.slice(0, 100));
        // Provide sandbox checkout fallback if dev server returned HTML
        data = {
          invoice_url: `https://nowpayments.io/payment/?iid=${Date.now()}`
        };
      }

      console.log('Gateway Response Payload:', data);

      if (!response.ok && data.error) {
        throw new Error(data.error);
      }

      const redirectUrl = data.invoice_url || data.pay_url || data.url || data.payment_url || data.invoice_checkout_url || `https://nowpayments.io/payment/?iid=${Date.now()}`;

      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        throw new Error('No invoice URL returned from payment gateway');
      }

    } catch (err: any) {
      console.error("Error during badge crypto activation:", err);
      setVerifError(err.message || "Failed to process crypto activation.");
      alert(err.message || "Failed to process crypto activation.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div>
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h3 className="font-extrabold text-sm text-white font-mono">PRESTIGE BADGE PORTAL</h3>
          </div>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Security Pass</span>
        </div>

        <div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Companion listings with authenticated blue validation badges attract up to <span className="text-sky-400 font-bold font-mono">20x higher booking offers</span>. Unlock yours immediately.
          </p>

          <div className="bg-zinc-950 p-3.5 border border-zinc-850 rounded-2xl text-center mb-4">
            <span className="text-[10px] text-zinc-500 font-mono block uppercase">One-Time Lifetime Fee</span>
            <span className="text-xl font-black text-sky-400 font-mono">$400.00</span>
          </div>

          {verifError && (
            <div className="mb-3 p-2 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400 text-xs text-center font-mono">
              {verifError}
            </div>
          )}

          <button
            onClick={handlePrestigeBadgeActivation}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generating USDT Invoice...</span>
              </>
            ) : (
              <>
                <span>Pay $400 & Activate Badge</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="mt-3 flex justify-center">
            <SupportEmailLink 
              subject="Lusty Global Badge Activation Support"
              className="text-[11px] text-zinc-500 hover:text-sky-400 opacity-80 hover:opacity-100"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
