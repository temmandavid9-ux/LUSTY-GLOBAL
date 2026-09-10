export interface FlutterwavePaymentConfig {
  amount: number;
  currency?: string;
  email: string;
  phone?: string;
  name?: string;
  description: string;
  hostSubaccountId?: string | null;
  txRef?: string;
  meta?: Record<string, any>;
  callback: (response: any) => void;
  onClose?: () => void;
}

export async function initiateFlutterwavePayment(config: FlutterwavePaymentConfig) {
  try {
    console.log("💎 Redirecting payment to NOWPayments USDT crypto endpoint...");
    const response = await fetch('/api/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceAmount: config.amount,
        orderId: config.txRef || `crypto_order_${Date.now()}`,
        orderDescription: config.description,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create crypto invoice');
    }

    const redirectUrl = data.invoice_url || data.payment_url || data.invoice_checkout_url;

    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      throw new Error('No invoice URL returned from payment gateway');
    }
  } catch (err: any) {
    console.error("Error initiating NOWPayments payment:", err);
    alert(err.message || "Failed to process crypto payment.");
  }
}

export function loadFlutterwaveScript(): Promise<boolean> {
  return Promise.resolve(true);
}
