import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { priceAmount, orderId } = await request.json();

    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NOWPAYMENTS_API_KEY || '',
      },
      body: JSON.stringify({
        price_amount: priceAmount, // e.g., 9.99
        price_currency: 'usd',
        pay_currency: 'usdttrc20', // Automatically prompts for USDT on Tron
        order_id: orderId,
        ipn_callback_url: 'https://lusty-global.vercel.app/api/webhook',
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
