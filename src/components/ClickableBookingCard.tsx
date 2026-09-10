import { useState } from 'react';
import { ShieldCheck, MapPin, Calendar, Clock, X } from 'lucide-react';

interface BookingItemProps {
  booking: {
    id: string;
    clientUsername: string;
    clientAvatar?: string;
    hostUsername: string;
    date: string;
    duration: string;
    location: string;
    hotelAddress?: string;
    roomNumber?: string;
    grossAmount: number;
    status: string;
    txRef: string;
  };
}

export default function ClickableBookingCard({ booking }: BookingItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Clickable Ledger Row */}
      <div 
        onClick={() => setIsOpen(true)}
        className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex items-center justify-between transition cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <img 
            src={booking.clientAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"} 
            alt={booking.clientUsername} 
            className="w-10 h-10 rounded-full object-cover border border-zinc-700"
          />
          <div>
            <div className="flex items-center gap-1.5 text-white font-bold text-xs font-mono">
              <span>@{booking.clientUsername}</span>
              <span className="text-zinc-500">→</span>
              <span className="text-zinc-300">@{booking.hostUsername}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-sky-400" /> {booking.date}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-sky-400" /> {booking.duration}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-1">
              <MapPin className="w-3 h-3 text-pink-500" />
              <span>{booking.location}</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-zinc-500 font-mono block uppercase">Escrow Deposit</span>
          <div className="text-emerald-400 font-black text-sm font-mono">${booking.grossAmount.toFixed(2)}</div>
          <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider inline-block mt-1">
            {booking.status}
          </span>
        </div>
      </div>

      {/* Booking Details Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
          <div className="bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 p-2 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <div>
                <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">Verified Booking Details</h3>
                <span className="text-[10px] text-zinc-500 font-mono">Ref: {booking.txRef}</span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="space-y-4 text-xs font-mono">
              <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-2xl space-y-3">
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500">Client:</span>
                  <span className="text-white font-bold">@{booking.clientUsername}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500">Scheduled Time:</span>
                  <span className="text-sky-400">{booking.date} ({booking.duration})</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500">General Area:</span>
                  <span className="text-zinc-300">{booking.location}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500">Hotel / Exact Address:</span>
                  <span className="text-emerald-400 font-bold">{booking.hotelAddress || 'The Ritz-Carlton, Suite 402'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Room Number:</span>
                  <span className="text-emerald-400 font-bold">{booking.roomNumber || 'Room 402'}</span>
                </div>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/20 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase">Secured Escrow Amount</span>
                  <span className="text-lg font-black text-emerald-400">${booking.grossAmount.toFixed(2)} USD</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-xl uppercase tracking-wider border border-emerald-500/30">
                  Funds Locked in Escrow
                </span>
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-2">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer border border-zinc-700"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export { ClickableBookingCard };
