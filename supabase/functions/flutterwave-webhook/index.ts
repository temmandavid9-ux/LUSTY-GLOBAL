import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.info("Flutterwave webhook listener started");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. Verify the Secret Hash sent by Flutterwave headers
    const signature = req.headers.get("verif-hash");
    const expectedHash = Deno.env.get("FLW_SECRET_HASH") || Deno.env.get("FLUTTERWAVE_SECRET_HASH");

    if (expectedHash && (!signature || signature !== expectedHash)) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), { status: 401 });
    }

    const event = await req.json();

    // 2. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Handle Successful Charges
    if (event.event === "charge.completed" && event.data?.status === "successful") {
      const txRef = event.data.tx_ref || "";
      const meta = event.data.meta || {};

      console.log(`Processing successful payment for reference: ${txRef}`);

      // A. Check if it's a Video Boost
      if (txRef.startsWith("boost-") && meta.videoId) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('short_videos')
          .update({ is_boosted: true, boost_expires_at: expiresAt, booster_level: 2 })
          .eq('id', meta.videoId);
      }

      // B. Check if it's a Prestige Badge
      if (txRef.startsWith("badge-")) {
        const userId = meta.consumer_id || meta.userId || meta.client_id;
        if (userId) {
          await supabaseAdmin
            .from('profiles')
            .update({ is_verified: true, badge_status: 'prestige_active' })
            .eq('id', userId);
        }
      }

      // C. Check if it's a Companion Booking
      if (txRef.startsWith("booking-") && meta.companion_id) {
        await supabaseAdmin.from('bookings').insert({
          client_id: meta.client_id,
          companion_id: meta.companion_id,
          amount_paid: event.data.amount,
          gross_amount: Number(meta.booking_amount_usd || event.data.amount),
          status: 'escrow_funded',
          escrow_status: 'held',
          transaction_reference: txRef
        });
      }

      // D. Fallback or additional audit logging in payments table
      try {
        await supabaseAdmin
          .from('payments')
          .insert({
            transaction_id: String(event.data.id),
            tx_ref: txRef,
            email: event.data.customer?.email,
            amount: event.data.amount,
            currency: event.data.currency,
            status: "completed",
            payment_method: event.data.payment_type || 'card'
          });
      } catch (pErr) {
        console.warn("Payments log notice:", pErr);
      }
    }

    // Acknowledge receipt to Flutterwave with a 200 OK response
    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err: any) {
    console.error("Webhook processing error:", err.message);
    return new Response(JSON.stringify({ error: err.message }, { status: 500 }));
  }
});
