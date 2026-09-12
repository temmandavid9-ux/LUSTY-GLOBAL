import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateSplit } from '@/lib/split';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export async function POST(req: Request) {
  try {
    const { companionId, amount, tipperId } = await req.json();

    if (!companionId || !amount) {
      return NextResponse.json({ error: 'Missing companionId or amount' }, { status: 400 });
    }

    // 1. Calculate split using shared utility
    const { grossAmount, platformFee, hostNetPayout } = calculateSplit(amount);

    if (grossAmount <= 0) {
      return NextResponse.json({ error: 'Invalid tip amount' }, { status: 400 });
    }

    // 2. Insert record into tips table
    const { error: tipError } = await supabase
      .from('tips')
      .insert({
        companion_id: companionId,
        tipper_id: tipperId || null,
        gross_amount: grossAmount,
        platform_fee: platformFee,
        net_payout: hostNetPayout,
        status: 'completed',
        created_at: new Date().toISOString(),
      });

    if (tipError) {
      throw new Error(`Failed to log tip: ${tipError.message}`);
    }

    // 3. Update host settled balance atomically via RPC
    const { error: balanceError } = await supabase.rpc('increment_settled_balance', {
      user_id_param: companionId,
      amount_param: hostNetPayout,
    });

    if (balanceError) {
      // Fallback: update settled balance directly if RPC function is not created
      const { data: profile } = await supabase
        .from('profiles')
        .select('settled_balance')
        .eq('id', companionId)
        .single();

      const newBalance = Number(((profile?.settled_balance || 0) + hostNetPayout).toFixed(2));

      const { error: fallbackError } = await supabase
        .from('profiles')
        .update({ settled_balance: newBalance })
        .eq('id', companionId);

      if (fallbackError) {
        throw new Error(`Failed to update settled balance for tip: ${balanceError.message || fallbackError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tip processed successfully',
      data: { grossAmount, platformFee, hostNetPayout },
    });
  } catch (err: any) {
    console.error('Tip processing error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
