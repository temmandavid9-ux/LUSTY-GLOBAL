import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(request: Request) {
  try {
    const { walletAddress, network, amount, userId } = await request.json().catch(() => ({}));
    const reqAmount = Number(amount) || 0;

    if (reqAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid payout amount.' }, { status: 400 });
    }

    let availableBalance = 0.00;

    if (userId && supabase) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('settled_balance, earnings')
        .eq('id', userId)
        .single();

      if (profile) {
        availableBalance = Number(profile.settled_balance ?? profile.earnings ?? 0);
      }
    }

    if (reqAmount > availableBalance || availableBalance <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Payout rejected: Requested amount ($${reqAmount.toFixed(2)}) exceeds available settled balance ($${availableBalance.toFixed(2)}).`
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.NOWPAYMENTS_API_KEY || '';

    if (apiKey && walletAddress) {
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
              amount: reqAmount,
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
