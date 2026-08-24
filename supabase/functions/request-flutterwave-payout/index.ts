import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, amount } = await req.json();

    if (!userId || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: userId and amount." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Initialize Supabase Admin Client to fetch user bank settlement details
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user's saved bank information from profiles table
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('settlement_bank_code, settlement_account_number, settlement_account_name, full_name')
      .eq('id', userId)
      .single();

    if (profileErr || !profile?.settlement_account_number) {
      return new Response(
        JSON.stringify({ error: "Bank settlement details not configured for this account." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bankCode = profile.settlement_bank_code || '044';
    const accountNumber = profile.settlement_account_number;
    const accountName = profile.settlement_account_name || profile.full_name || 'Host';
    const reference = `payout-${userId.slice(0, 8)}-${Date.now()}`;

    // 2. Call Flutterwave Transfers API
    const flwRes = await fetch("https://api.flutterwave.com/v3/transfers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        account_bank: bankCode,
        account_number: accountNumber,
        amount: Number(amount),
        currency: "NGN",
        narration: `Vault Payout Withdrawal - ${accountName}`,
        reference: reference,
        callback_url: `${SUPABASE_URL}/functions/v1/flutterwave-webhook`
      })
    });

    const result = await flwRes.json();

    if (result.status !== "success") {
      return new Response(
        JSON.stringify({ error: result.message || "Flutterwave payout transfer failed" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Update database ledgers: Move status from pending/escrowed to processing
    await supabaseAdmin
      .from('booking_ledgers')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .or(`companion_id.eq.${userId},client_id.eq.${userId}`)
      .in('status', ['pending', 'escrowed', 'funded', 'held']);

    await supabaseAdmin
      .from('bookings')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .or(`companion_id.eq.${userId},client_id.eq.${userId}`)
      .in('status', ['pending', 'escrowed', 'funded', 'held']);

    return new Response(
      JSON.stringify({ success: true, message: `Vault Payout of $${Number(amount).toFixed(2)} successfully requested!`, data: result.data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
