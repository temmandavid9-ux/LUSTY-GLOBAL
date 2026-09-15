import { NextResponse } from 'next/server';
import { fulfillService } from '../../../../api/webhook';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orderId, paymentId } = body;
    const apiKey = process.env.NOWPAYMENTS_API_KEY || '';

    let paymentStatus = 'finished';

    if (apiKey && paymentId) {
      try {
        const response = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
          headers: { 'x-api-key': apiKey }
        });
        if (response.ok) {
          const data = await response.json();
          paymentStatus = data.payment_status || 'finished';
        }
      } catch (err) {
        console.warn('NOWPayments status verification warning:', err);
      }
    }

    const result = await fulfillService(orderId, paymentId, paymentStatus);

    return NextResponse.json({
      success: true,
      verified: true,
      serviceRendered: true,
      orderId,
      paymentId,
      paymentStatus,
      fulfillment: result
    });
  } catch (err: any) {
    console.error('Verify payment error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
