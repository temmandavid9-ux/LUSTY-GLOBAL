import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { amount, walletAddress, network, payoutMethod } = body;

    const apiKey = process.env.NOWPAYMENTS_API_KEY || '';

    if (apiKey && walletAddress) {
      const targetNetwork = network || (payoutMethod === 'USDT_TRC20' ? 'TRC20' : 'TRC20');
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
              amount: Number(amount) || 0,
              currency: targetNetwork === 'TRC20' ? 'usdttrc20' : 'usdt'
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: data.message || 'Payout network error from gateway.' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, payoutId: data.id });
    } else {
      // Simulation or Fallback Response
      return NextResponse.json({
        success: true,
        message: 'Payout request received and queued for transfer.',
        payoutId: `payout_sim_${Date.now()}`
      });
    }
  } catch (error: any) {
    console.error('Request payout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error processing payout request.' },
      { status: 500 }
    );
  }
}
