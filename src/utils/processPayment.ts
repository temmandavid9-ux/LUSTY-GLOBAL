import { toast } from 'react-hot-toast';

export interface PaymentOptions {
  userId?: string;
  email?: string;
  name?: string;
  amountInCents?: number;
  amount?: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
  onSuccess?: (response?: any) => Promise<void> | void;
  onClose?: () => void;
}

export async function executeCardPayment(options: PaymentOptions): Promise<void> {
  const {
    userId,
    amountInCents,
    amount: rawAmount,
    description = 'Crypto Payment Pass',
  } = options;

  // Resolve amount in dollars/main currency unit
  const finalAmount = rawAmount !== undefined
    ? rawAmount
    : (amountInCents !== undefined ? amountInCents / 100 : 0);

  if (finalAmount <= 0) {
    toast.error('Invalid payment amount');
    throw new Error('Invalid payment amount');
  }

  try {
    toast.loading('Generating NOWPayments USDT invoice...', { id: 'nowpayments-loading' });

    const response = await fetch('/api/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceAmount: finalAmount,
        orderId: `order_${userId || 'guest'}_${Date.now()}`,
        orderDescription: description,
      }),
    });

    const data = await response.json();
    toast.dismiss('nowpayments-loading');

    if (!response.ok) {
      const errMsg = data.error || 'Failed to create crypto invoice';
      toast.error(errMsg);
      throw new Error(errMsg);
    }

    const redirectUrl = data.invoice_url || data.payment_url || data.invoice_checkout_url;

    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      toast.error('No invoice URL returned from payment gateway');
      throw new Error('No invoice URL returned from payment gateway');
    }
  } catch (err: any) {
    console.error('Error during crypto payment generation:', err);
    toast.dismiss('nowpayments-loading');
    toast.error(err.message || 'Failed to generate crypto payment');
    throw err;
  }
}

export default executeCardPayment;
