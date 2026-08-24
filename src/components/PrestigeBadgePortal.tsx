import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, ShieldCheck, ChevronRight } from 'lucide-react';
import { chargeSavedCardForEscrow } from '../lib/chargeLinkedCard';
import { executeCardPayment } from '../utils/processPayment';

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

      // 1. Check if user has a valid linked payment method
      const { data: dbProfile, error: profileError } = await supabase
        .from('profiles')
        .select('has_payment_method')
        .eq('id', activeUserId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!dbProfile?.has_payment_method) {
        alert("A valid credit/debit card is required to acquire the Prestige Badge. Please link a card in your profile first.");
        setIsProcessing(false);
        return;
      }

      // 2. Execute background token charge for $400.00
      console.log("💳 Executing background token charge ($400) for Prestige Badge...");
      
      try {
        await chargeSavedCardForEscrow(activeUserId, 400.00);
      } catch (chargeErr: any) {
        console.warn("chargeSavedCardForEscrow notice, executing card payment checkout fallback:", chargeErr);
        await executeCardPayment({
          userId: activeUserId,
          amount: 400.00,
          description: 'Prestige Badge Pass',
          onSuccess: async () => {}
        });
      }

      const badgeTxRef = `BADGE-PASS-${Date.now()}`;

      // 3. Update the companion's profile in Supabase to grant the badge
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_verified: true, 
          badge_status: 'prestige_active',
          updated_at: new Date().toISOString()
        })
        .eq('id', activeUserId);

      if (updateError) {
        throw new Error("Payment captured, but database profile update failed: " + updateError.message);
      }

      // 4. Log the transaction in your audit history table
      await supabase.from('transaction_history').insert([{
        sender_id: activeUserId,
        receiver_id: activeUserId, 
        transaction_type: 'prestige_badge',
        status: 'completed',
        gross_amount: 400.00,
        platform_fee: 400.00,
        net_payout: 0,
        tx_ref: badgeTxRef
      }]);

      alert("🎉 Prestige Badge successfully activated! Your blue validation badge is now live.");
      if (onVerifySuccess) {
        onVerifySuccess();
      } else {
        window.location.reload(); // Refresh to display the new badge state
      }

    } catch (err: any) {
      console.error("Error during badge activation flow:", err);
      setVerifError(err.message || "Failed to process Prestige Badge activation.");
      alert(err.message || "Failed to process Prestige Badge activation.");
    } finally {
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
                <span>Processing $400 Charge...</span>
              </>
            ) : (
              <>
                <span>Pay $400 & Activate Badge</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
