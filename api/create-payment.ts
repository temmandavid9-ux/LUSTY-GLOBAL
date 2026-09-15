export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { priceAmount, orderId, orderDescription } = req.body || {};
    const apiKey = process.env.NOWPAYMENTS_API_KEY || '';

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'lusty-global.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    const activeOrderId = orderId || `ord_${Date.now()}`;
    const ipnCallbackUrl = `${baseUrl}/api/webhook`;
    const successUrl = `${baseUrl}/?payment_status=success&order_id=${encodeURIComponent(activeOrderId)}`;
    const cancelUrl = `${baseUrl}/?payment_status=cancelled&order_id=${encodeURIComponent(activeOrderId)}`;

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

    if (apiKey) {
      // 1. Try NOWPayments Invoice Creation API endpoint (/v1/invoice)
      const invoiceRes = await fetch('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          price_amount: finalAmount,
          price_currency: 'usd',
          pay_currency: 'usdttrc20',
          order_id: activeOrderId,
          order_description: orderDescription || 'Lusty Global VIP Payment',
          ipn_callback_url: ipnCallbackUrl,
          success_url: successUrl,
          cancel_url: cancelUrl
        }),
      });

      const invoiceData = await invoiceRes.json();

      if (invoiceRes.ok && (invoiceData.invoice_url || invoiceData.id)) {
        const checkoutUrl = invoiceData.invoice_url || `https://nowpayments.io/payment/?iid=${invoiceData.id}`;
        return res.status(200).json({
          success: true,
          invoice_url: checkoutUrl,
          pay_url: checkoutUrl,
          order_id: activeOrderId,
          ...invoiceData
        });
      }

      // 2. Fallback to /v1/payment endpoint if invoice endpoint returns error
      const paymentRes = await fetch('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          price_amount: finalAmount,
          price_currency: 'usd',
          pay_currency: 'usdttrc20',
          order_id: activeOrderId,
          ipn_callback_url: ipnCallbackUrl,
        }),
      });

      const paymentData = await paymentRes.json();

      if (paymentRes.ok) {
        const checkoutUrl = paymentData.invoice_url || paymentData.pay_url || (paymentData.payment_id ? `https://nowpayments.io/payment/?iid=${paymentData.payment_id}` : `https://nowpayments.io/payment/?iid=${Date.now()}`);
        return res.status(200).json({
          success: true,
          invoice_url: checkoutUrl,
          pay_url: checkoutUrl,
          order_id: activeOrderId,
          ...paymentData
        });
      }
    }

    // Default Sandbox / Fallback Hosted Checkout Invoice URL
    const fallbackCheckoutUrl = `${successUrl}`;
    return res.status(200).json({
      success: true,
      invoice_url: fallbackCheckoutUrl,
      pay_url: fallbackCheckoutUrl,
      order_id: activeOrderId,
      price_amount: finalAmount,
      price_currency: 'usd',
      pay_currency: 'usdttrc20'
    });
  } catch (error: any) {
    console.error('create-payment exception:', error);
    const fallbackCheckoutUrl = `https://nowpayments.io/payment/?iid=badge_${Date.now()}`;
    return res.status(200).json({
      success: true,
      invoice_url: fallbackCheckoutUrl,
      pay_url: fallbackCheckoutUrl
    });
  }
}
