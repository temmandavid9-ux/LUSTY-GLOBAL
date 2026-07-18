import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: CORS_HEADERS 
    });
  }

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(JSON.stringify({ error: "Missing required field: bookingId" }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || "";
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Backend configuration missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Fetch the booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: `Booking not found: ${bookingErr?.message || ''}` }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Verify the status is releasable
    const releasableStatuses = ['pending_confirmation', 'paid_escrow', 'confirmed', 'pending'];
    if (!releasableStatuses.includes(booking.status)) {
      return new Response(JSON.stringify({ error: `Booking is not in a releasable state. Current status: ${booking.status}` }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the host's bank details from the profiles table
    const hostId = booking.companion_id;
    const { data: hostProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('settlement_bank_code, settlement_account_number, settlement_account_name')
      .eq('id', hostId)
      .maybeSingle();

    if (profileErr || !hostProfile || !hostProfile.settlement_bank_code || !hostProfile.settlement_account_number) {
      return new Response(JSON.stringify({ 
        error: "Host has not configured settlement bank details. Please instruct them to configure payouts in their dashboard." 
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Calculate payout amount (85% of gross_amount)
    let payoutAmount = booking.net_payout || (booking.gross_amount ? booking.gross_amount * 0.85 : 0);
    if (!payoutAmount && booking.duration_hours && booking.hourly_rate_at_booking) {
      payoutAmount = booking.duration_hours * booking.hourly_rate_at_booking * 0.85;
    }

    // If the amount is in USD, convert to NGN (assuming Nigerian bank accounts)
    let amountInNGN = payoutAmount;
    if (amountInNGN < 5000) { 
      amountInNGN = Math.round(amountInNGN * 1500); // 1 USD = 1500 NGN
    }

    // Retrieve Flutterwave Secret Key from Env. If not set, use a simulation sandbox mock payout.
    const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    
    if (!flutterwaveSecretKey) {
      // Update booking status to 'completed' / 'disbursed' and escrow_status to 'released'
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ 
          status: 'completed', 
          escrow_status: 'released',
          confirmed_at: new Date().toISOString() 
        })
        .eq('id', bookingId);

      if (updateErr) {
        return new Response(JSON.stringify({ error: `Failed to update booking status: ${updateErr.message}` }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        simulated: true,
        message: "Payout processed successfully via sandbox mock gateway (Flutterwave key not configured in backend).",
        payout_amount_ngn: amountInNGN,
        host_details: {
          bank_code: hostProfile.settlement_bank_code,
          account_number: hostProfile.settlement_account_number,
          account_name: hostProfile.settlement_account_name
        }
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Call Flutterwave Transfer API
    const payoutResponse = await fetch("https://api.flutterwave.com/v3/transfers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${flutterwaveSecretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        account_bank: hostProfile.settlement_bank_code,
        account_number: hostProfile.settlement_account_number,
        amount: amountInNGN,
        narration: `Payout for Booking #${bookingId}`,
        currency: "NGN",
        reference: `POUT-${bookingId}-${Date.now()}`
      })
    });

    const payoutResult = await payoutResponse.json();

    if (payoutResponse.ok && (payoutResult.status === "success" || payoutResult.status === "successful")) {
      // Update booking status to 'completed' and escrow_status to 'released'
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ 
          status: 'completed', 
          escrow_status: 'released',
          confirmed_at: new Date().toISOString() 
        })
        .eq('id', bookingId);

      if (updateErr) {
        return new Response(JSON.stringify({ error: `Payout succeeded but database update failed: ${updateErr.message}` }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: payoutResult.data 
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: payoutResult.message || "Payout transfer failed on Flutterwave gateway." 
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
