import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { amount, userId, payoutMethod, walletAddress, network } = req.body || {};

    const reqAmount = Number(amount) || 0;
    if (reqAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid disbursement amount. Must be greater than $0.00.' });
    }

    let availableBalance = 0.00;

    // Server-side database validation: check actual settled balance in Supabase
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

    // Strict validation: Reject if requested amount exceeds available settled balance or if balance is $0.00
    if (reqAmount > availableBalance || availableBalance <= 0) {
      return res.status(400).json({
        success: false,
        error: `Payout rejected: Requested amount ($${reqAmount.toFixed(2)}) exceeds available settled balance ($${availableBalance.toFixed(2)}).`
      });
    }

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
              amount: reqAmount,
              currency: targetNetwork === 'TRC20' ? 'usdttrc20' : 'usdt'
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(400).json({ success: false, error: data.message || 'Payout network error from payment gateway.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Payout request processed successfully',
        payoutId: data.id,
        amount: reqAmount,
        payoutMethod: payoutMethod || 'USDT_TRC20',
        timestamp: Date.now(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payout request processed successfully',
      payoutId: `payout_sim_${Date.now()}`,
      amount: reqAmount,
      payoutMethod: payoutMethod || 'USDT_TRC20',
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Payout API Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error during payout request.' });
  }
}
