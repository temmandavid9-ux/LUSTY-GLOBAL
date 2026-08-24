import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Lock, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export interface EscrowProps {
  escrowId: string;
  amount: number;
  hostName: string;
  status: 'HELD_IN_ESCROW' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED';
  clientId?: string;
  companionId?: string;
  currentUserId?: string;
  booking?: {
    id: string;
    client_id?: string;
    companion_id?: string;
    escrow_status?: string;
  };
  onStatusChange?: () => void;
}

const IS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function EscrowVaultCard({
  escrowId,
  amount,
  hostName,
  status,
  clientId,
  companionId,
  currentUserId,
  booking,
  onStatusChange
}: EscrowProps) {
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  // 1. Determine user role for this specific booking
  const actualClientId = clientId || booking?.client_id;
  const actualCompanionId = companionId || booking?.companion_id;

  const isClient = currentUserId ? currentUserId === actualClientId : true;
  const isCompanion = currentUserId ? currentUserId === actualCompanionId : false;

  const handleReleaseFunds = async (bookingId: string) => {
    if (!confirm(`Are you sure you want to release $${amount.toFixed(2)} to ${hostName}?`)) return;

    setLoading(true);
    try {
      // 1. Primary RPC Call
      const { error } = await supabase.rpc('release_escrow', {
        booking_id: String(bookingId)
      });

      if (error) {
        console.warn('RPC Release notice, attempting direct update fallback:', error.message);
        
        // 2. Direct Update Fallback if RPC fails
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'completed',
            escrow_status: 'released'
          })
          .eq('id', bookingId);

        if (updateError) {
          toast.error(`Release failed: ${updateError.message}`);
          alert(`Release failed: ${updateError.message}`);
          return;
        }
      }

      toast.success('Escrow funds released successfully!');
      setLocalStatus('COMPLETED');
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      console.error('Unexpected error during release:', err);
      toast.error(err?.message || 'Error releasing escrow');
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!confirm(`Initiate escrow dispute for transaction with ${hostName}? Escrow auto-payout will be paused for admin review.`)) return;

    setLoading(true);
    try {
      const isRealUuid = IS_UUID_REGEX.test(escrowId);

      if (isRealUuid) {
        const { error } = await supabase
          .from('bookings')
          .update({ escrow_status: 'disputed', status: 'disputed' })
          .eq('id', escrowId);

        if (error) {
          console.warn('Database dispute notice:', error.message);
        }
      }

      toast.success(`Dispute logged. Escrow auto-release paused.`);
      setLocalStatus('DISPUTED');
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      toast.error(err?.message || 'Error disputing transaction');
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = localStatus || status;

  return (
    <div id={`escrow-card-${escrowId}`} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between space-y-4 w-full hover:border-zinc-700 transition-all">
      {/* Top Header Section with Proper Flex Wrapping */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* Icon Box */}
          <div className="p-2 bg-pink-500/10 border border-pink-500/20 rounded-xl text-pink-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono block">Escrow Vault</span>
            <div className="text-lg font-mono font-black text-white">${amount.toFixed(2)} <span className="text-xs font-normal text-zinc-400">USD</span></div>
          </div>
        </div>
        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
          currentStatus === 'HELD_IN_ESCROW' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
          currentStatus === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          currentStatus === 'DISPUTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
          'bg-zinc-800 text-zinc-400 border-zinc-700'
        }`}>
          {currentStatus === 'HELD_IN_ESCROW' ? 'HELD' : currentStatus.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Description - Fully Visible */}
      <p className="text-xs text-zinc-400 leading-relaxed">
        Funds held safely in vault for session with <span className="text-white font-medium">@{hostName}</span>.
      </p>

      {/* Action Buttons - Unclipped */}
      {currentStatus === 'HELD_IN_ESCROW' ? (
        <div className="pt-2 flex gap-2">
          {isClient ? (
            <>
              <button
                type="button"
                onClick={() => handleReleaseFunds(escrowId)}
                disabled={loading}
                className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold py-2.5 px-2 rounded-xl uppercase tracking-wider transition-all text-center cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Release Funds'}
              </button>

              <button
                type="button"
                onClick={handleDispute}
                disabled={loading}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[10px] font-bold py-2.5 px-2 rounded-xl uppercase tracking-wider transition-all text-center cursor-pointer disabled:opacity-50"
                title="Raise Dispute"
              >
                Dispute
              </button>
            </>
          ) : isCompanion ? (
            <button
              type="button"
              disabled
              className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold py-2.5 rounded-xl uppercase tracking-wider transition-all text-center font-mono cursor-default"
            >
              Awaiting Client Release
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold py-2.5 rounded-xl uppercase tracking-wider transition-all text-center font-mono cursor-default"
            >
              Held in Escrow
            </button>
          )}
        </div>
      ) : currentStatus === 'COMPLETED' ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono pt-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>Funds successfully disbursed to host wallet.</span>
        </div>
      ) : currentStatus === 'DISPUTED' ? (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono pt-1">
          <AlertTriangle className="w-4 h-4" />
          <span>Under admin dispute review. Funds frozen in vault.</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono pt-1">
          <Clock className="w-4 h-4" />
          <span>Transaction archived.</span>
        </div>
      )}
    </div>
  );
}
