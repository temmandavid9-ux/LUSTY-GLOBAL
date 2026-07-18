export function loadFlutterwaveScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).FlutterwaveCheckout) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface FlutterwavePaymentConfig {
  amount: number;
  currency?: string;
  email: string;
  phone?: string;
  name?: string;
  description: string;
  hostSubaccountId?: string | null;
  callback: (response: any) => void;
  onClose?: () => void;
}

export async function initiateFlutterwavePayment(config: FlutterwavePaymentConfig) {
  const loaded = await loadFlutterwaveScript();
  if (!loaded) {
    alert("⚠️ Failed to load Flutterwave checkout script. Please check your internet connection.");
    return;
  }

  const publicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || "FLWPUBK_TEST-a3597c27632646270650965e5bd57e84-X";
  const txRef = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const currency = config.currency || "NGN";

  const paymentData: any = {
    public_key: publicKey,
    tx_ref: txRef,
    amount: config.amount,
    currency: currency,
    payment_options: "card,ussd,banktransfer",
    customer: {
      email: config.email,
      phone_number: config.phone || "08000000000",
      name: config.name || "VIP Member",
    },
    customizations: {
      title: "Lusty Global VIP",
      description: config.description,
      logo: "https://vtmaffcyvhnnmfibfswm.supabase.co/storage/v1/object/public/assets/logo.png",
    },
    callback: (response: any) => {
      config.callback(response);
    },
    onclose: () => {
      if (config.onClose) config.onClose();
    }
  };

  if (config.hostSubaccountId) {
    paymentData.subaccounts = [
      {
        id: config.hostSubaccountId,
        transaction_split_ratio: 85,
        transaction_charge_type: "percentage"
      }
    ];
  }

  (window as any).FlutterwaveCheckout(paymentData);
}
