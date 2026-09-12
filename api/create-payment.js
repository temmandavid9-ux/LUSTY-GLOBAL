export default async function handler(req, res) {
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    if (res && typeof res.status === 'function') {
      return res.status(200).end();
    }
    return new Response(null, { status: 200 });
  }

  if (req.method !== 'POST') {
    if (res && typeof res.status === 'function') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    } else if (!body && typeof req.json === 'function') {
      body = await req.json();
    }
    body = body || {};

    const priceAmount = body.priceAmount;
    const orderId = body.orderId;

    const apiKey = process.env.NOWPAYMENTS_API_KEY || 'F488SQV-VQPM8FM-M6NC7A3-BJ926GZ';

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
        console.warn('Could not fetch NOWPayments min-amount, defaulting to $15 floor:', minErr);
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
      console.error('NOWPayments API Error:', data);

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
          if (res && typeof res.status === 'function') {
            return res.status(200).json(retryData);
          }
          return new Response(JSON.stringify(retryData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const errMsg = data.message || `NOWPayments requires a minimum payment of $${minAmountUsd} USD for USDT (TRC-20)`;
      if (res && typeof res.status === 'function') {
        return res.status(400).json({ error: errMsg, details: data });
      }
      return new Response(JSON.stringify({ error: errMsg, details: data }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (res && typeof res.status === 'function') {
      return res.status(200).json(data);
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('create-payment exception:', error);
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ error: error?.message || 'Failed to create payment' });
    }
    return new Response(JSON.stringify({ error: error?.message || 'Failed to create payment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
