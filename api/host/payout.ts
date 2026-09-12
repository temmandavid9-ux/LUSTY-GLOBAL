export default async function handler(req: any, res: any) {
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    if (res && typeof res.status === 'function') {
      return res.status(200).end();
    }
    return new Response(null, { status: 200 });
  }

  if (req.method !== 'POST') {
    if (res && typeof res.status === 'function') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    } else if (!body && typeof req.json === 'function') {
      body = await req.json();
    }
    body = body || {};

    const { walletAddress, network, amount } = body;
    const apiKey = process.env.NOWPAYMENTS_API_KEY || 'F488SQV-VQPM8FM-M6NC7A3-BJ926GZ';

    if (apiKey) {
      const response = await fetch('https://api.nowpayments.io/v1/payout', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          withdrawals: [
            {
              address: walletAddress,
              amount: Number(amount),
              currency: network === 'TRC20' ? 'usdttrc20' : (network === 'ERC20' ? 'usdterc20' : 'usdt'),
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (res && typeof res.status === 'function') {
          return res.status(400).json({ success: false, message: data.message || 'Payout network error.' });
        }
        return new Response(JSON.stringify({ success: false, message: data.message || 'Payout network error.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (res && typeof res.status === 'function') {
        return res.status(200).json({ success: true, payoutId: data.id });
      }
      return new Response(JSON.stringify({ success: true, payoutId: data.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const simResponse = { success: true, payoutId: `payout_sim_${Date.now()}` };
      if (res && typeof res.status === 'function') {
        return res.status(200).json(simResponse);
      }
      return new Response(JSON.stringify(simResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    console.error('Payout processing error:', error);
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ success: false, message: 'Server error processing payout.' });
    }
    return new Response(JSON.stringify({ success: false, message: 'Server error processing payout.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
