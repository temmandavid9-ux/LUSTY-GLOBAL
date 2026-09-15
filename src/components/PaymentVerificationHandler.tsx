import React, { useEffect, useState } from 'react';
import { CheckCircle, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentVerificationHandlerProps {
  currentUserId?: string;
  onRefreshProfile?: () => void;
}

export const PaymentVerificationHandler: React.FC<PaymentVerificationHandlerProps> = ({
  currentUserId,
  onRefreshProfile
}) => {
  const [verifying, setVerifying] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ title: string; desc: string } | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status') || urlParams.get('payment');
    const orderId = urlParams.get('order_id') || urlParams.get('orderId');
    const paymentId = urlParams.get('payment_id') || urlParams.get('paymentId') || urlParams.get('NP_id');

    if (paymentStatus === 'success' || paymentStatus === 'finished' || orderId) {
      setVerifying(true);
      const targetOrderId = orderId || `order_${Date.now()}`;

      fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: targetOrderId,
          paymentId: paymentId || '',
          userId: currentUserId
        })
      })
        .then(res => res.json())
        .then(async (data) => {
          console.log('[PAYMENT VERIFICATION RESULT]:', data);
          setVerifying(false);

          // Direct client-side Supabase updates to ensure instant UI rendering
          if (currentUserId && supabase) {
            if (targetOrderId.includes('prestige') || targetOrderId.includes('badge') || targetOrderId.includes('ord_')) {
              await supabase
                .from('profiles')
                .update({
                  is_verified: true,
                  has_prestige_badge: true,
                  prestige_badge: true,
                  verified_badge: true,
                  badge_status: 'active'
                })
                .eq('id', currentUserId);
            }
          }

          if (onRefreshProfile) {
            onRefreshProfile();
          }

          if (targetOrderId.includes('prestige') || targetOrderId.includes('badge')) {
            setSuccessInfo({
              title: 'PRESTIGE BADGE VERIFIED & ACTIVATED!',
              desc: 'Your account has been upgraded with the verified blue security badge. High-tier offers are now unlocked.'
            });
          } else if (targetOrderId.includes('booking') || targetOrderId.includes('rendezvous')) {
            setSuccessInfo({
              title: 'BOOKING PAYMENT CONFIRMED!',
              desc: 'Your VIP Rendezvous booking has been paid into escrow and confirmed with the host.'
            });
          } else {
            setSuccessInfo({
              title: 'PAYMENT SUCCESSFUL!',
              desc: 'Your transaction was confirmed and your service features are now fully active.'
            });
          }

          // Clean up URL parameters cleanly
          try {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          } catch (e) {}
        })
        .catch((err) => {
          console.warn('Verification request warning:', err);
          setVerifying(false);
        });
    }
  }, [currentUserId, onRefreshProfile]);

  if (!successInfo && !verifying) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] font-sans">
      {verifying ? (
        <div className="bg-sky-950/90 border border-sky-500/40 text-sky-200 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
            <span>Verifying incoming crypto payment & rendering service...</span>
          </div>
        </div>
      ) : successInfo ? (
        <div className="bg-emerald-950/95 border border-emerald-500/50 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md relative space-y-1">
          <button
            onClick={() => setSuccessInfo(null)}
            className="absolute top-3 right-3 text-emerald-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs font-mono uppercase tracking-wider">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{successInfo.title}</span>
          </div>
          <p className="text-[11px] text-zinc-300 font-mono pl-6 leading-relaxed">
            {successInfo.desc}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default PaymentVerificationHandler;
