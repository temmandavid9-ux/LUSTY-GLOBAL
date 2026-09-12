import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { priceAmount, orderId } = await request.json();
    const apiKey = process.env.NOWPAYMENTS_API_KEY || '';

    // NOWPayments has a minimum limit for USDT (TRC-20) transactions (typically $15.00 USD)
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

    if (apiKey) {
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
          // Automatically retry with standard $15.00 minimum floor
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
            return NextResponse.json(retryData);
          }
        }

        return NextResponse.json({ 
          error: data.message || `NOWPayments requires a minimum payment of $${minAmountUsd} USD for USDT (TRC-20)`,
          details: data 
        }, { status: 400 });
      }

      return NextResponse.json(data);
    } else {
      // Sandbox / Fallback mock response when NOWPAYMENTS_API_KEY is not configured
      const mockInvoiceUrl = `https://nowpayments.io/payment/?iid=${Date.now()}`;
      return NextResponse.json({
        invoice_url: mockInvoiceUrl,
        pay_url: mockInvoiceUrl,
        raw: {
          id: 'np_inv_' + Date.now(),
          order_id: orderId || `prestige_${Date.now()}`,
          price_amount: finalAmount,
          price_currency: 'usd',
          pay_currency: 'usdttrc20',
          invoice_url: mockInvoiceUrl,
          created_at: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('create-payment exception:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

