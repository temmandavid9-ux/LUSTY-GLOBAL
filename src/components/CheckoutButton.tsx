import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface CheckoutButtonProps {
  priceAmount?: number;
  orderId?: string;
  className?: string;
  label?: string;
}

export default function CheckoutButton({
  priceAmount = 15.00,
  orderId,
  className,
  label = 'Pay with Crypto (USDT)'
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceAmount, 
          orderId: orderId || 'sub_' + Date.now() 
        }),
      });

      const data = await res.json();
      const redirectUrl = data.invoice_url || data.payment_url || data.invoice_checkout_url;

      if (redirectUrl) {
        toast.loading('Redirecting to NOWPayments USDT secure checkout...', { duration: 2000 });
        window.location.href = redirectUrl; // Redirects user to NOWPayments secure checkout page
      } else if (data.pay_address) {
        toast.success(`Send ${data.pay_amount || priceAmount} USDT (TRC-20) to address: ${data.pay_address}`);
      } else {
        toast.error(data.error || 'Could not generate crypto invoice url');
      }
    } catch (err: any) {
      console.error('NOWPayments checkout error:', err);
      toast.error('Payment checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      type="button"
      onClick={handleCheckout}
      disabled={loading}
      className={className || "px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
          <span>Creating Crypto Invoice...</span>
        </>
      ) : (
        <>
          <span>⚡</span>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
