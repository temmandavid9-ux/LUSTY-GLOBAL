// src/lib/flutterwave.ts

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
  txRef?: string;
  meta?: Record<string, any>;
  callback: (response: any) => void;
  onClose?: () => void;
}

export async function initiateFlutterwavePayment(config: FlutterwavePaymentConfig) {
  const loaded = await loadFlutterwaveScript();
  if (!loaded) {
    alert("⚠️ Failed to load Flutterwave checkout script. Please check your internet connection.");
    return;
  }

  const publicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK-0b7a5318b3a387ddb8b414f97502ac76-X';
  if (!publicKey) {
    console.error("Flutterwave Public Key is missing in environment variables!");
    alert("Payment configuration error. Please check VITE_FLUTTERWAVE_PUBLIC_KEY.");
    return;
  }

  const isTestKey = publicKey.includes("TEST") || publicKey.startsWith("FLWPUBK_TEST");

  // Sandbox workaround: Flutterwave Test Mode only processes NGN for local test accounts.
  // In Live Mode (FLWPUBK_LIVE), USD will be used directly.
  let currency = config.currency || "USD";
  let amount = config.amount;

  if (isTestKey && currency === "USD") {
    console.warn("⚠️ Flutterwave Sandbox detected: Converting $ USD to ₦ NGN for testing purposes.");
    currency = "NGN";
    amount = config.amount * 1500; // Simulated exchange rate for test checkout
  }

  const prefix = config.meta?.tx_ref_prefix || "";
  const txRef = config.txRef || `${prefix}TX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // FIX 1: Sanitize email to remove spaces and ensure standard email domain for Flutterwave API compatibility
  let sanitizedEmail = config.email.replace(/\s+/g, "").toLowerCase();
  
  // If email is invalid, uses non-standard domain (.vip / lustyglobal.vip) or placeholder, map to valid standard email format
  if (
    !sanitizedEmail || 
    sanitizedEmail.includes("lustyglobal.vip") || 
    sanitizedEmail.endsWith(".vip") || 
    !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(sanitizedEmail)
  ) {
    const localPart = sanitizedEmail.split("@")[0].replace(/[^a-z0-9._-]/gi, "") || "vipmember";
    sanitizedEmail = `${localPart || "vipmember"}@gmail.com`;
  }

  // FIX 2: Set valid payment options (USD requires 'card' only; USSD/banktransfer fail on USD)
  const paymentOptions = currency === "USD" ? "card" : "card, banktransfer, ussd";

  const paymentData: any = {
    public_key: publicKey,
    tx_ref: txRef,
    amount: amount,
    currency: currency,
    payment_options: paymentOptions,
    customer: {
      email: sanitizedEmail,
      phone_number: config.phone || "08000000000",
      name: config.name || "VIP Member",
    },
    meta: {
      consumer_id: Date.now(), // Forces a unique consumer session to bypass lookup cache
      ...(config.meta || {}),
    },
    customizations: {
      title: "Lusty Global VIP",
      description: config.description,
      logo: window.location.origin + "/logo.png",
    },
    callback: (response: any) => {
      config.callback(response);
    },
    onclose: () => {
      if (config.onClose) config.onClose();
    }
  };

  // FIX 3: Ignore empty, null, or non-RS_ subaccount strings in Test Mode
  if (
    config.hostSubaccountId && 
    typeof config.hostSubaccountId === "string" && 
    config.hostSubaccountId.trim() !== "" &&
    config.hostSubaccountId !== "null" &&
    config.hostSubaccountId !== "undefined" &&
    config.hostSubaccountId.startsWith("RS_")
  ) {
    paymentData.subaccounts = [
      {
        id: config.hostSubaccountId.trim(),
        transaction_split_ratio: 85,
        transaction_charge_type: "percentage"
      }
    ];
  }

  console.log("Initializing Flutterwave checkout with:", paymentData);
  (window as any).FlutterwaveCheckout(paymentData);
}
