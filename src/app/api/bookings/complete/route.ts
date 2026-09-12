import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateSplit } from '@/lib/split';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export async function POST(req: Request) {
  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    // 1. Fetch booking record
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'completed') {
      return NextResponse.json({ error: 'Booking already completed' }, { status: 400 });
    }

    // 2. Calculate 15% / 85% split
    const { grossAmount, platformFee, hostNetPayout } = calculateSplit(booking.gross_amount || 0);

    // 3. Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'completed',
        escrow_status: 'released',
        platform_fee: platformFee,
        net_payout: hostNetPayout,
        released_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // 4. Update host settled balance atomically via RPC
    const { error: balanceError } = await supabase.rpc('increment_settled_balance', {
      user_id_param: booking.companion_id,
      amount_param: hostNetPayout,
    });

    if (balanceError) {
      // Fallback: update settled balance directly if RPC function is not created
      const { data: profile } = await supabase
        .from('profiles')
        .select('settled_balance')
        .eq('id', booking.companion_id)
        .single();

      const newBalance = Number(((profile?.settled_balance || 0) + hostNetPayout).toFixed(2));

      const { error: fallbackError } = await supabase
        .from('profiles')
        .update({ settled_balance: newBalance })
        .eq('id', booking.companion_id);

      if (fallbackError) {
        throw new Error(`Failed to update settled balance: ${balanceError.message || fallbackError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Booking split processed successfully',
      data: { grossAmount, platformFee, hostNetPayout },
    });
  } catch (err: any) {
    console.error('Booking completion error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
