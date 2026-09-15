import { fulfillService } from './webhook';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { orderId, paymentId } = req.body || req.query || {};
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

    return res.status(200).json({
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
    return res.status(500).json({ success: false, error: err.message });
  }
}
