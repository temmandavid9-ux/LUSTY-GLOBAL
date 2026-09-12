export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { walletAddress, network, amount } = req.body || {};
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
              amount: Number(amount),
              currency: network === 'TRC20' ? 'usdttrc20' : (network === 'ERC20' ? 'usdterc20' : 'usdt')
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(400).json({ success: false, message: data.message || 'Payout network error.' });
      }

      return res.status(200).json({ success: true, payoutId: data.id });
    } else {
      return res.status(200).json({ success: true, payoutId: `payout_sim_${Date.now()}` });
    }
  } catch (error: any) {
    console.error('Payout processing error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing payout.' });
  }
}
