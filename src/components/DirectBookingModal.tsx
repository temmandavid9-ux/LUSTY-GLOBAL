import { useState } from 'react';
import { Companion, Booking } from '../types';
import { X, ShieldAlert, Calendar, Clock, MapPin, Sparkles } from 'lucide-react';

interface DirectBookingModalProps {
  companion: Companion;
  onClose: () => void;
  onSubmitBooking: (booking: Booking) => void;
}

export default function DirectBookingModal({ companion, onClose, onSubmitBooking }: DirectBookingModalProps) {
  const [date, setDate] = useState('2026-06-28');
  const [time, setTime] = useState('20:00');
  const [duration, setDuration] = useState(2); // hours
  const [location, setLocation] = useState('VIP Lounge Room 1 - London Mayfair');
  const [notes, setNotes] = useState('');

  const totalRate = companion.ratePerHour * duration;
  const bookerFee = 1.00;
  const totalCharged = totalRate + bookerFee;
  const depositEscrow = Math.round(totalCharged * 0.3); // 30% advance escrow deposit standard

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newBooking: Booking = {
      id: `booking_${Date.now()}`,
      companionId: companion.id,
      date,
      time,
      duration,
      rate: companion.ratePerHour,
      location,
      status: 'pending',
      notes
    };

    onSubmitBooking(newBooking);
  };

  return (
    <div id="booking-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative shadow-2xl max-h-[90vh] flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-500" />
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            <h2 className="text-sm font-extrabold text-white tracking-widest uppercase">PROPOSE RENDEZVOUS</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-900 rounded-xl transition"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Selected Companion Banner preview */}
        <div className="bg-zinc-900/60 p-4 border-b border-zinc-800 flex items-center gap-3 shrink-0">
          <img 
            src={companion.avatar} 
            alt="" 
            className="w-12 h-12 rounded-full object-cover border-2 border-pink-500"
          />
          <div className="text-left">
            <h3 className="font-bold text-white text-xs">Rendezvous with @{companion.username}</h3>
            <span className="text-[10px] text-zinc-400 font-mono">Premium Hourly Rate: <span className="text-emerald-400 font-bold">${companion.ratePerHour}/hr</span></span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto flex-1 no-scrollbar text-left">
          
          {/* Grid for date and time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1.5">Proposed Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-zinc-950 text-xs text-zinc-100 rounded-xl pl-9 pr-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1.5">Proposed Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-zinc-950 text-xs text-zinc-100 rounded-xl pl-9 pr-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Duration slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Duration (Hours)</label>
              <span className="text-xs font-bold text-pink-400 font-mono">{duration} Hours</span>
            </div>
            <input 
              type="range"
              min={1}
              max={12}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer accent-pink-500"
            />
          </div>

          {/* Meeting location choice */}
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1.5">Meeting Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. VIP Lounge or Hotel Address"
                className="w-full bg-zinc-950 text-xs text-zinc-100 rounded-xl pl-9 pr-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1.5">Custom Notes / Instructions</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Champagne preferences, formal dress code, specific timing guidelines..."
              rows={2}
              className="w-full bg-zinc-950 text-xs text-zinc-100 rounded-xl px-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500 resize-none"
            />
          </div>

          {/* Booking Summary Invoice */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mt-2 text-sans space-y-2.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2 flex items-center justify-between">
              <span>Booking Summary Invoice</span>
              <span className="text-[9px] text-zinc-500 font-mono">15% Split applied</span>
            </h4>
            <div className="flex justify-between items-center text-xs text-zinc-300">
              <span>Host Session Rate ({duration} hrs)</span>
              <span className="font-mono text-zinc-100 font-bold">${totalRate.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span>Platform Secure Booker Fee</span>
              <span className="font-mono text-zinc-200">+$1.00</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-zinc-500 border-t border-zinc-900/40 pt-2">
              <span>Host Net Earnings (15% Split)</span>
              <span className="font-mono text-pink-400/80">${(totalRate * 0.85).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-white pt-1.5 border-t border-zinc-900">
              <span>Total Invoice Charge</span>
              <span className="font-mono text-emerald-400">${totalCharged.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-extrabold text-white pt-1">
              <span className="flex items-center gap-1">
                30% Advanced Escrow Deposit
                <span className="text-[9px] bg-pink-500/10 text-pink-400 px-1 py-0.5 rounded border border-pink-500/10 font-mono">ESCROW</span>
              </span>
              <span className="font-mono text-pink-400 text-sm">${depositEscrow.toFixed(2)}</span>
            </div>
          </div>

          {/* Safety alert message */}
          <div className="flex items-start gap-2 text-[10px] text-zinc-400 leading-relaxed bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-850">
            <ShieldAlert className="w-4 h-4 text-pink-500 shrink-0" />
            <span>Escrow guarantee holds deposit safely. Companion will only be paid once the rendezvous is confirmed live. Cancellations are 100% refundable up to 4 hrs before the scheduled time slot.</span>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-black text-xs py-3.5 rounded-xl active:scale-95 transition shadow-lg shadow-pink-500/10 uppercase"
          >
            PROCEED TO ESCROW PAYMENT CHECKOUT
          </button>

        </form>

      </div>

    </div>
  );
}
