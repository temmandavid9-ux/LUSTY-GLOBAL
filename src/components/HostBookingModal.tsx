import { useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';

interface HostBookingModalProps {
  hostId?: string;
  hostUsername?: string;
  hourlyRate?: number;
  hostAvatar?: string;
  onClose?: () => void;
}

export default function HostBookingModal({
  hostId,
  hostUsername = "samuel",
  hourlyRate = 250.00,
  hostAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
  onClose
}: HostBookingModalProps) {
  const [proposedDate, setProposedDate] = useState('2026-06-28');
  const [proposedTime, setProposedTime] = useState('08:00');
  const [durationHours, setDurationHours] = useState(2);
  const [meetingLocation, setMeetingLocation] = useState('VIP Lounge Room 1 - London Mayfair');
  const [customNotes, setCustomNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const hostSessionRate = hourlyRate * durationHours;
  const platformBookerFee = 1.00;
  const totalInvoiceCharge = hostSessionRate + platformBookerFee;
  const escrowDepositAmount = totalInvoiceCharge * 0.30; // 30% Advanced Escrow Deposit

  const handleProceedToEscrowPayment = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceAmount: escrowDepositAmount,
          orderId: `rendezvous_escrow_${hostId || 'host'}_${Date.now()}`,
          metadata: {
            hostUsername,
            proposedDate,
            proposedTime,
            duration: `${durationHours} hours`,
            meetingLocation,
            customNotes,
            totalInvoiceCharge,
            escrowDepositAmount
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create crypto escrow invoice');
      }

      const redirectUrl = data.invoice_url || data.payment_url || data.invoice_checkout_url;

      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        throw new Error('No invoice URL returned from payment gateway');
      }
    } catch (err: any) {
      console.error('Rendezvous checkout error:', err);
      setErrorMsg(err.message || 'Payment checkout failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-sans overflow-y-auto">
      <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 max-w-lg w-full relative space-y-5 shadow-2xl my-8">
        
        {/* Close Button */}
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 p-2 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-pink-500" />
            <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">PROPOSE RENDEZVOUS</h3>
          </div>
        </div>

        {/* Host Info Badge */}
        <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={hostAvatar} 
              alt={hostUsername} 
              className="w-10 h-10 rounded-full object-cover border border-zinc-700"
            />
            <div>
              <div className="text-xs font-bold text-white font-mono">Rendezvous with @{hostUsername}</div>
              <div className="text-[11px] text-zinc-400 font-mono">Premium Hourly Rate: <span className="text-emerald-400 font-bold">${hourlyRate.toFixed(0)}/hr</span></div>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 text-xs font-mono text-left">
          
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] uppercase text-zinc-500 mb-1">Proposed Date</label>
              <input
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-pink-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-zinc-500 mb-1">Proposed Time</label>
              <input
                type="time"
                value={proposedTime}
                onChange={(e) => setProposedTime(e.target.value)}
                className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-pink-500 text-xs"
              />
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[9px] uppercase text-zinc-500">Duration (Hours)</label>
              <span className="text-pink-400 font-bold">{durationHours} Hours</span>
            </div>
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-pink-500 text-xs"
            >
              <option value={1}>1 Hour</option>
              <option value={2}>2 Hours</option>
              <option value={3}>3 Hours</option>
              <option value={4}>4 Hours</option>
              <option value={6}>6 Hours</option>
            </select>
          </div>

          {/* Meeting Location */}
          <div>
            <label className="block text-[9px] uppercase text-zinc-500 mb-1">Meeting Location</label>
            <input
              type="text"
              value={meetingLocation}
              onChange={(e) => setMeetingLocation(e.target.value)}
              placeholder="e.g., VIP Lounge Room 1 - London Mayfair"
              className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-pink-500 text-xs"
            />
          </div>

          {/* Custom Notes */}
          <div>
            <label className="block text-[9px] uppercase text-zinc-500 mb-1">Custom Notes / Instructions</label>
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g., Champagne preferences, formal dress code, specific timing guidelines..."
              rows={2}
              className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-xl px-3 py-2 focus:outline-none focus:border-pink-500 text-xs resize-none"
            />
          </div>

          {/* Booking Summary Invoice */}
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Booking Summary Invoice</span>
              <span className="text-[9px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded font-bold">15% Split Applied</span>
            </div>

            <div className="flex justify-between text-zinc-400 text-xs">
              <span>Host Session Rate ({durationHours} hrs)</span>
              <span className="text-white font-bold">${hostSessionRate.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-zinc-400 text-xs border-b border-zinc-900 pb-2">
              <span>Platform Secure Booker Fee</span>
              <span className="text-white font-bold">+${platformBookerFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-zinc-400 text-xs">
              <span>Host Net Earnings (15% Split)</span>
              <span className="text-pink-400 font-bold">${(hostSessionRate * 0.85).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-xs border-t border-zinc-900 pt-2">
              <span>Total Invoice Charge</span>
              <span className="text-white">${totalInvoiceCharge.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-400 font-black text-sm border-t border-zinc-900 pt-2">
              <span className="flex items-center gap-1.5">30% Advanced Escrow Deposit <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">ESCROW</span></span>
              <span>${escrowDepositAmount.toFixed(2)}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">
              {errorMsg}
            </div>
          )}

          <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
            Escrow guarantee holds deposit safely. Companion will only be paid once the rendezvous is confirmed live. Cancellations are 100% refundable up to 4 hrs before the scheduled time.
          </p>

          {/* Action Button */}
          <button
            type="button"
            disabled={loading}
            onClick={handleProceedToEscrowPayment}
            className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-lg shadow-pink-950 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generating USDT Invoice...</span>
              </>
            ) : (
              <span>Proceed to Escrow Payment Checkout</span>
            )}
          </button>

        </div>

      </div>
    </div>
  );
}

export { HostBookingModal, HostBookingModal as ProposeRendezvousModal };
