import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY");

serve(async (req) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { token, amount, currency, email, txRef } = await req.json();

    if (!token || !amount || !email) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Direct token charge to Flutterwave API
    const response = await fetch("https://api.flutterwave.com/v3/tokenized-charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
      body: JSON.stringify({
        token: token,
        currency: currency || "USD",
        amount: amount,
        email: email,
        tx_ref: txRef || `TOK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      }),
    });

    const data = await response.json();

    if (data.status === "success" && data.data?.status === "successful") {
      return new Response(
        JSON.stringify({ success: true, txRef: data.data.tx_ref, data: data.data }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, message: data.message || 'Token charge failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
