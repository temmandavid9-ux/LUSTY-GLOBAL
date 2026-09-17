import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function handleSuccessfulPayment(paymentData: { 
  recipientUsername: string; 
  totalAmount: number; 
  orderId?: string;
}) {
  const { recipientUsername, totalAmount, orderId } = paymentData;

  if (!recipientUsername || !totalAmount || !supabase) {
    console.log('[NOWPAYMENTS SPLIT] Missing recipient/amount or standalone mode.');
    return { success: false, reason: 'Invalid payload or supabase unavailable' };
  }

  try {
    // 1. Fetch Creator B's referral status from Supabase
    const { data: creatorB } = await supabase
      .from('profiles')
      .select('id, username, referred_by, referral_bonus_paid, settled_balance, earnings')
      .eq('username', recipientUsername)
      .maybeSingle();

    let creatorShare = 0.85; // Default 85%
    let referrerShare = 0.00; 
    let platformShare = 0.15; // Default 15%
    let referrerUsername: string | null = null;

    // 2. Check if they were referred AND the one-time bonus hasn't been paid yet
    if (creatorB?.referred_by && !creatorB.referral_bonus_paid) {
      creatorShare = 0.80;      // Creator B gets 80% for their first transaction
      referrerShare = 0.10;     // Creator A gets the 10% one-time bonus
      platformShare = 0.10;     // Platform keeps 10% for this single transaction
      referrerUsername = creatorB.referred_by;

      // 3. Update the database so this NEVER happens again for this creator
      await supabase
        .from('profiles')
        .update({ referral_bonus_paid: true })
        .eq('username', recipientUsername);
    }

    // 4. Calculate actual cash amounts
    const creatorPayout = totalAmount * creatorShare;
    const referrerPayout = totalAmount * referrerShare;
    const platformCut = totalAmount * platformShare;

    // 5. Log the earnings into your ledger table to be paid out via crypto later
    try {
      await supabase.from('earnings_ledger').insert([
        { username: recipientUsername, amount: creatorPayout, type: 'creator_earnings', order_id: orderId || null },
        ...(referrerUsername ? [{ username: referrerUsername, amount: referrerPayout, type: 'referral_bonus', order_id: orderId || null }] : []),
        { username: 'platform_treasury', amount: platformCut, type: 'platform_fee', order_id: orderId || null }
      ]);
    } catch (ledgerErr) {
      console.warn("earnings_ledger insert warning (table might be optional):", ledgerErr);
    }

    // 6. Credit creator's profile balance
    if (creatorB?.id) {
      const currentSettled = Number(creatorB.settled_balance || 0);
      const currentEarnings = Number(creatorB.earnings || 0);
      await supabase.from('profiles').update({
        settled_balance: currentSettled + creatorPayout,
        earnings: currentEarnings + creatorPayout,
        updated_at: new Date().toISOString()
      }).eq('id', creatorB.id);
    }

    // 7. Credit referrer's profile balance if bonus was earned
    if (referrerUsername && referrerPayout > 0) {
      const { data: referrerProf } = await supabase
        .from('profiles')
        .select('id, settled_balance, earnings')
        .eq('username', referrerUsername)
        .maybeSingle();

      if (referrerProf?.id) {
        const refSettled = Number(referrerProf.settled_balance || 0);
        const refEarnings = Number(referrerProf.earnings || 0);
        await supabase.from('profiles').update({
          settled_balance: refSettled + referrerPayout,
          earnings: refEarnings + referrerPayout,
          updated_at: new Date().toISOString()
        }).eq('id', referrerProf.id);
      }
    }

    console.log(`[NOWPAYMENTS SPLIT COMPLETED] Recipient: @${recipientUsername} ($${creatorPayout.toFixed(2)}), Referrer: @${referrerUsername || 'None'} ($${referrerPayout.toFixed(2)}), Platform: $${platformCut.toFixed(2)}`);
    return { success: true, creatorPayout, referrerPayout, platformCut };
  } catch (err: any) {
    console.error('[NOWPAYMENTS SPLIT ERROR]:', err);
    return { success: false, error: err.message };
  }
}

export async function fulfillService(orderId: string, _paymentId?: string, paymentStatus?: string, payloadData?: any) {
  if (!orderId) return { success: false, reason: 'Missing order_id' };

  const isConfirmed = !paymentStatus || ['finished', 'confirmed', 'sending', 'partially_paid', 'paid', 'success'].includes(paymentStatus.toLowerCase());
  if (!isConfirmed) {
    return { success: false, reason: `Payment status '${paymentStatus}' not yet confirmed` };
  }

  console.log(`[SERVICE FULFILLMENT] Processing confirmed order: ${orderId}`);

  if (!supabase) {
    return { success: true, message: 'Fulfilled service in standalone mode', orderId };
  }

  try {
    const cleanId = String(orderId);

    // If explicit recipientUsername and totalAmount provided in webhook payload
    if (payloadData?.recipientUsername && payloadData?.totalAmount) {
      await handleSuccessfulPayment({
        recipientUsername: payloadData.recipientUsername,
        totalAmount: Number(payloadData.totalAmount),
        orderId: cleanId
      });
    }

    // 1. PRESTIGE BADGE VERIFICATION ($400.00)
    if (cleanId.includes('prestige') || cleanId.includes('badge')) {
      const parts = cleanId.split('_');
      // format: prestige_badge_{userId}_{timestamp} or badge_{userId}_{timestamp}
      let userId = '';
      for (const p of parts) {
        if (p !== 'prestige' && p !== 'badge' && p.length > 5 && isNaN(Number(p))) {
          userId = p;
          break;
        }
      }

      if (userId) {
        const { data: prof } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
        if (prof?.username) {
          await handleSuccessfulPayment({
            recipientUsername: prof.username,
            totalAmount: 400.00,
            orderId: cleanId
          });
        }

        await supabase
          .from('profiles')
          .update({
            is_verified: true,
            has_prestige_badge: true,
            prestige_badge: true,
            verified_badge: true,
            badge_status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      }

      try {
        await supabase.from('transaction_history').insert([{
          sender_id: userId || 'system',
          receiver_id: 'system',
          amount: 400.00,
          type: 'prestige_badge',
          status: 'completed',
          created_at: new Date().toISOString()
        }]);
      } catch {}

      return { success: true, service: 'prestige_badge', userId, orderId };
    }

    // 2. BOOKING / RENDEZVOUS CONFIRMATION
    if (cleanId.includes('booking') || cleanId.includes('rendezvous')) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('gross_amount, amount, companion_id, host_id, companion_username, host_username')
        .or(`order_id.eq.${cleanId},id.eq.${cleanId}`)
        .maybeSingle();

      if (booking) {
        const total = Number(booking.gross_amount || booking.amount || 0);
        const hostUser = booking.companion_username || booking.host_username;
        if (hostUser && total > 0) {
          await handleSuccessfulPayment({
            recipientUsername: hostUser,
            totalAmount: total,
            orderId: cleanId
          });
        }
      }

      await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          escrow_status: 'funded',
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .or(`order_id.eq.${cleanId},id.eq.${cleanId}`);

      await supabase
        .from('booking_ledgers')
        .update({
          status: 'paid_escrow',
          escrow_status: 'funded'
        })
        .or(`order_id.eq.${cleanId}`);

      return { success: true, service: 'booking', orderId };
    }

    // 3. TIP / TOKEN PURCHASE
    if (cleanId.includes('tip') || cleanId.includes('token')) {
      const parts = cleanId.split('_');
      let userId = parts[1] || '';
      if (userId) {
        const { data: prof } = await supabase.from('profiles').select('username, settled_balance, earnings').eq('id', userId).single();
        if (prof?.username) {
          await handleSuccessfulPayment({
            recipientUsername: prof.username,
            totalAmount: 50.00,
            orderId: cleanId
          });
        }
      }
      return { success: true, service: 'tip', orderId };
    }

    // 4. BOOST / VIP ACCESS
    if (cleanId.includes('boost') || cleanId.includes('vip')) {
      const parts = cleanId.split('_');
      let userId = parts[1] || '';
      if (userId) {
        await supabase.from('profiles').update({ is_boosted: true, vip_member: true }).eq('id', userId);
      }
      return { success: true, service: 'boost', orderId };
    }

    return { success: true, service: 'generic_payment', orderId };
  } catch (err: any) {
    console.error('[SERVICE FULFILLMENT ERROR]:', err);
    return { success: false, error: err.message || 'Fulfillment error' };
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const payload = req.body || {};
    const orderId = payload.order_id || payload.orderId;
    const paymentId = payload.payment_id || payload.paymentId;
    const paymentStatus = payload.payment_status || payload.status || 'finished';

    console.log(`[NOWPAYMENTS WEBHOOK RECEIVED] Order: ${orderId}, Status: ${paymentStatus}, PaymentID: ${paymentId}`);

    const result = await fulfillService(orderId, paymentId, paymentStatus, payload);

    return res.status(200).json({
      received: true,
      success: result.success,
      details: result
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(500).json({ received: true, error: err.message });
  }
}
