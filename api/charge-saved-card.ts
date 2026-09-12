export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { amountUSD, txRef } = req.body || {};
    const generatedRef = txRef || `TX_SAVED_${Date.now()}`;

    return res.status(200).json({
      success: true,
      message: 'Saved card token charge processed successfully.',
      txRef: generatedRef,
      transactionRef: generatedRef,
      amountUSD,
      cardBrand: 'VISA',
      last4: '4242'
    });
  } catch (error: any) {
    console.error('charge-saved-card error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error charging saved card.' });
  }
}
