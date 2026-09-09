import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { priceAmount, orderId } = await request.json();

    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NOWPAYMENTS_API_KEY || '',
      },
      body: JSON.stringify({
        price_amount: priceAmount, // e.g., 9.99
        price_currency: 'usd',
        pay_currency: 'usdttrc20', // Locks payment directly to USDT on TRON
        order_id: orderId,
        ipn_callback_url: 'https://lusty-global.vercel.app/api/webhook',
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('NOWPayments API Error:', data);
      return NextResponse.json({ error: data.message || 'Payment provider rejected request' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
