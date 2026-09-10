import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { walletAddress, network, amount } = await request.json();

    const apiKey = process.env.NOWPAYMENTS_API_KEY || '';

    if (apiKey) {
      const response = await fetch('https://api.nowpayments.io/v1/payout', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          withdrawals: [
            {
              address: walletAddress,
              amount: Number(amount),
              currency: network === 'TRC20' ? 'usdttrc20' : (network === 'ERC20' ? 'usdterc20' : 'usdt')
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { success: false, message: data.message || 'Payout network error.' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, payoutId: data.id });
    } else {
      return NextResponse.json({ success: true, payoutId: `payout_sim_${Date.now()}` });
    }
  } catch (error: any) {
    console.error('Payout processing error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error processing payout.' },
      { status: 500 }
    );
  }
}
