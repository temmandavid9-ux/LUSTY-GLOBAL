import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function fulfillService(orderId: string, _paymentId?: string, paymentStatus?: string) {
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
        const { data: prof } = await supabase.from('profiles').select('settled_balance, earnings').eq('id', userId).single();
        const curr = Number(prof?.settled_balance ?? prof?.earnings ?? 0);
        await supabase.from('profiles').update({ settled_balance: curr + 50, earnings: curr + 50 }).eq('id', userId);
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

    const result = await fulfillService(orderId, paymentId, paymentStatus);

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
