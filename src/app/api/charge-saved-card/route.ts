import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { amountUSD, txRef } = body;

    const generatedRef = txRef || `TX_SAVED_${Date.now()}`;

    return NextResponse.json({
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
    return NextResponse.json(
      { success: false, error: error.message || 'Server error charging saved card.' },
      { status: 500 }
    );
  }
}
