import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { amountUSD, txRef } = body;

    const generatedRef = txRef || `TX_MANUAL_${Date.now()}`;

    return NextResponse.json({
      success: true,
      message: 'Manual card payment processed successfully.',
      txRef: generatedRef,
      transactionRef: generatedRef,
      amountUSD
    });
  } catch (error: any) {
    console.error('charge-manual-card error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error processing manual card charge.' },
      { status: 500 }
    );
  }
}
