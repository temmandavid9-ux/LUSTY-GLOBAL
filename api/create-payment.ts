export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { priceAmount, orderId } = req.body || {};
    const apiKey = process.env.NOWPAYMENTS_API_KEY || '';

    let minAmountUsd = 15;
    if (apiKey) {
      try {
        const minRes = await fetch('https://api.nowpayments.io/v1/min-amount?currency_from=usd&currency_to=usdttrc20&fiat_equivalent=true', {
          headers: { 'x-api-key': apiKey },
        });
        if (minRes.ok) {
          const minData = await minRes.json();
          if (minData.fiat_equivalent) {
            minAmountUsd = Math.max(minAmountUsd, Math.ceil(minData.fiat_equivalent));
          } else if (minData.min_amount) {
            minAmountUsd = Math.max(minAmountUsd, Math.ceil(minData.min_amount));
          }
        }
      } catch (minErr) {
        console.warn('Could not fetch min amount:', minErr);
      }
    }

    const requested = Number(priceAmount) || 15;
    const finalAmount = Math.max(requested, minAmountUsd);

    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        price_amount: finalAmount,
        price_currency: 'usd',
        pay_currency: 'usdttrc20',
        order_id: orderId || `sub_${Date.now()}`,
        ipn_callback_url: 'https://lusty-global.vercel.app/api/webhook',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === 'AMOUNT_MINIMAL_ERROR') {
        const retryRes = await fetch('https://api.nowpayments.io/v1/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            price_amount: 15.00,
            price_currency: 'usd',
            pay_currency: 'usdttrc20',
            order_id: orderId || `sub_${Date.now()}`,
            ipn_callback_url: 'https://lusty-global.vercel.app/api/webhook',
          }),
        });
        const retryData = await retryRes.json();
        if (retryRes.ok) {
          return res.status(200).json(retryData);
        }
      }

      return res.status(400).json({
        error: data.message || `NOWPayments requires a minimum payment of $${minAmountUsd} USD for USDT (TRC-20)`,
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('create-payment exception:', error);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
}
