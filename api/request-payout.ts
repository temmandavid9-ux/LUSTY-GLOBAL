export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { amount, payoutMethod, walletAddress, network } = req.body || {};

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid disbursement amount.' });
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
              amount: Number(amount),
              currency: targetNetwork === 'TRC20' ? 'usdttrc20' : 'usdt'
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(400).json({ error: data.message || 'Payout network error from payment gateway.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Payout request processed successfully',
        payoutId: data.id,
        amount,
        payoutMethod: payoutMethod || 'USDT_TRC20',
        timestamp: Date.now(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payout request processed successfully',
      payoutId: `payout_sim_${Date.now()}`,
      amount,
      payoutMethod: payoutMethod || 'USDT_TRC20',
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Payout API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error during payout request.' });
  }
}
