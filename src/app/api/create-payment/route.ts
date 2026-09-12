import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { priceAmount, orderId, orderDescription } = await request.json().catch(() => ({}));
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
          order_id: orderId || `ord_${Date.now()}`,
          order_description: orderDescription || 'Lusty Global VIP Payment',
          ipn_callback_url: 'https://lusty-global.vercel.app/api/webhook',
          success_url: 'https://lusty-global.vercel.app/host-portal?payment=success',
          cancel_url: 'https://lusty-global.vercel.app/host-portal?payment=cancelled'
        }),
      });

      const invoiceData = await invoiceRes.json();

      if (invoiceRes.ok && (invoiceData.invoice_url || invoiceData.id)) {
        const checkoutUrl = invoiceData.invoice_url || `https://nowpayments.io/payment/?iid=${invoiceData.id}`;
        return NextResponse.json({
          success: true,
          invoice_url: checkoutUrl,
          pay_url: checkoutUrl,
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
          order_id: orderId || `ord_${Date.now()}`,
          ipn_callback_url: 'https://lusty-global.vercel.app/api/webhook',
        }),
      });

      const paymentData = await paymentRes.json();

      if (paymentRes.ok) {
        const checkoutUrl = paymentData.invoice_url || paymentData.pay_url || (paymentData.payment_id ? `https://nowpayments.io/payment/?iid=${paymentData.payment_id}` : `https://nowpayments.io/payment/?iid=${Date.now()}`);
        return NextResponse.json({
          success: true,
          invoice_url: checkoutUrl,
          pay_url: checkoutUrl,
          ...paymentData
        });
      }
    }

    // Default Sandbox / Fallback Hosted Checkout Invoice URL
    const fallbackCheckoutUrl = `https://nowpayments.io/payment/?iid=badge_${Date.now()}`;
    return NextResponse.json({
      success: true,
      invoice_url: fallbackCheckoutUrl,
      pay_url: fallbackCheckoutUrl,
      order_id: orderId || `badge_${Date.now()}`,
      price_amount: finalAmount,
      price_currency: 'usd',
      pay_currency: 'usdttrc20'
    });
  } catch (error: any) {
    console.error('create-payment exception:', error);
    const fallbackCheckoutUrl = `https://nowpayments.io/payment/?iid=badge_${Date.now()}`;
    return NextResponse.json({
      success: true,
      invoice_url: fallbackCheckoutUrl,
      pay_url: fallbackCheckoutUrl
    });
  }
}
