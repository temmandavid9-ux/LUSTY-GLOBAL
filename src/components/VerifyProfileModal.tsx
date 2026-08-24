import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { executeCardPayment } from '../utils/processPayment';
import { toast } from 'react-hot-toast';

export function VerifyProfileModal({
  currentUserId,
  onClose
}: {
  currentUserId: string;
  onClose: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const VERIFICATION_FEE = 400.00; // Verification price ($400)
  const VERIFICATION_CENTS = Math.round(VERIFICATION_FEE * 100);

  const handlePayForVerification = async () => {
    setIsProcessing(true);

    try {
      await executeCardPayment({
        userId: currentUserId,
        amountInCents: VERIFICATION_CENTS,
        description: 'Verified Profile Checkmark Badge Purchase',
        metadata: { type: 'profile_verification' },
        onSuccess: async () => {
          // Update profile in Supabase to verified status
          const { error } = await supabase
            .from('profiles')
            .update({
              is_verified: true,
              verified_at: new Date().toISOString()
            })
            .eq('id', currentUserId);

          if (error) throw error;

          toast.success(`🎉 $${VERIFICATION_FEE.toFixed(2)} Debited! Your profile is now officially Verified!`);
          onClose();
        }
      });
    } catch (err: any) {
      if (err.message !== 'No payment card linked') {
        toast.error(`❌ Verification failed: ${err.message || 'Payment not debited.'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-400 text-xl font-bold">
          ✓
        </div>

        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
            Get Verified Badge
          </h3>
          <p className="text-[11px] text-zinc-400 mt-1">
            Unlock the official verified checkmark badge on your profile and media loops.
          </p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 text-left space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Feature:</span>
            <span className="text-blue-400 font-bold">Verified Profile Badge</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Payment Method:</span>
            <span className="text-zinc-300 font-mono">Card on File</span>
          </div>
          <div className="border-t border-zinc-800 pt-2 flex justify-between text-sm font-black text-white">
            <span>Total Debit:</span>
            <span className="text-emerald-400 font-mono">${VERIFICATION_FEE.toFixed(2)} USD</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handlePayForVerification}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center"
          >
            {isProcessing ? 'Debiting Card...' : `Verify for $${VERIFICATION_FEE.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
