import { NextResponse } from 'next/server';
import { fulfillService } from '../../../../api/webhook';

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const orderId = payload.order_id || payload.orderId;
    const paymentId = payload.payment_id || payload.paymentId;
    const paymentStatus = payload.payment_status || payload.status || 'finished';

    console.log(`[NOWPAYMENTS NEXT ROUTE WEBHOOK] Order: ${orderId}, Status: ${paymentStatus}`);

    const result = await fulfillService(orderId, paymentId, paymentStatus);

    return NextResponse.json({
      received: true,
      success: result.success,
      details: result
    });
  } catch (err: any) {
    console.error('Webhook Next route error:', err);
    return NextResponse.json({ received: true, error: err.message }, { status: 500 });
  }
}

export async function GET(_request: Request) {
  return NextResponse.json({ status: 'active', service: 'NOWPayments IPN Webhook Receiver' });
}
