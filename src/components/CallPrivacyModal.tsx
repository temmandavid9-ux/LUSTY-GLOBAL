import { useState, useEffect } from 'react';
import { BellOff, ShieldCheck, Sparkles, X, Check, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCreatorCallSettings, setCreatorCallSettings, CreatorCallSettings } from '../services/videoCallService';

interface CallPrivacyModalProps {
  username: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CallPrivacyModal({ username, isOpen, onClose }: CallPrivacyModalProps) {
  const [settings, setSettings] = useState<CreatorCallSettings>({
    isDND: false,
    allowCallsFrom: 'everyone'
  });

  useEffect(() => {
    if (username) {
      setSettings(getCreatorCallSettings(username));
    }
  }, [username, isOpen]);

  if (!isOpen) return null;

  const handleToggleDND = () => {
    const nextDND = !settings.isDND;
    const updated = setCreatorCallSettings(username, { isDND: nextDND });
    setSettings(updated);
    toast(nextDND ? "🌙 Do Not Disturb (DND) activated! Calls muted." : "🔔 DND disabled! Incoming calls enabled.", {
      icon: nextDND ? '🌙' : '🔔'
    });
  };

  const handleSetPrivacy = (allowCallsFrom: 'everyone' | 'verified_only' | 'supporters_only') => {
    const updated = setCreatorCallSettings(username, { allowCallsFrom });
    setSettings(updated);
    toast.success("Call privacy filter updated!");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base tracking-tight">Call Privacy & DND Controls</h3>
              <p className="text-[11px] text-zinc-400 font-mono">Manage incoming video call permissions for @{username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Do Not Disturb (DND) Toggle Card */}
        <div className={`p-4 rounded-2xl border transition mb-5 flex items-center justify-between ${
          settings.isDND 
            ? 'bg-amber-950/20 border-amber-500/40 text-amber-300' 
            : 'bg-zinc-900/60 border-zinc-800 text-zinc-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              settings.isDND ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400'
            }`}>
              <BellOff className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-white">Do Not Disturb (DND)</h4>
                {settings.isDND && (
                  <span className="bg-amber-500 text-zinc-950 font-black text-[9px] px-2 py-0.5 rounded-full font-mono uppercase">ACTIVE</span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {settings.isDND ? 'All incoming call rings are automatically silenced.' : 'Ready to accept incoming 1-on-1 calls.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleDND}
            className={`px-4 py-2 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 shrink-0 ${
              settings.isDND
                ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-950/40'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
            }`}
          >
            {settings.isDND ? 'DND ON' : 'DND OFF'}
          </button>
        </div>

        {/* 2. Call Privacy Filter Options */}
        <div className="space-y-3 mb-5">
          <label className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider block">
            Who Can Call Me Directly:
          </label>

          <button
            type="button"
            onClick={() => handleSetPrivacy('everyone')}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
              settings.allowCallsFrom === 'everyone'
                ? 'bg-pink-500/10 border-pink-500/40 text-white'
                : 'bg-zinc-900/50 border-zinc-850 hover:bg-zinc-900 text-zinc-400'
            }`}
          >
            <div>
              <span className="font-bold text-xs text-white block">Everyone</span>
              <span className="text-[11px] text-zinc-500 block font-mono">Any logged-in user can initiate a call ring</span>
            </div>
            {settings.allowCallsFrom === 'everyone' && <Check className="w-4 h-4 text-pink-400" />}
          </button>

          <button
            type="button"
            onClick={() => handleSetPrivacy('verified_only')}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
              settings.allowCallsFrom === 'verified_only'
                ? 'bg-blue-500/10 border-blue-500/40 text-white'
                : 'bg-zinc-900/50 border-zinc-850 hover:bg-zinc-900 text-zinc-400'
            }`}
          >
            <div>
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Verified Users Only
              </span>
              <span className="text-[11px] text-zinc-500 block font-mono">Only blue checkmark verified profiles can ring</span>
            </div>
            {settings.allowCallsFrom === 'verified_only' && <Check className="w-4 h-4 text-blue-400" />}
          </button>

          <button
            type="button"
            onClick={() => handleSetPrivacy('supporters_only')}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
              settings.allowCallsFrom === 'supporters_only'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                : 'bg-zinc-900/50 border-zinc-850 hover:bg-zinc-900 text-zinc-400'
            }`}
          >
            <div>
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Top Supporters ($10+ Tip History)
              </span>
              <span className="text-[11px] text-zinc-500 block font-mono">Only users who sent tips/bookings in the past</span>
            </div>
            {settings.allowCallsFrom === 'supporters_only' && <Check className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>

        {/* 3. Automatic Spam Safeguard Banner */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 text-[11px] font-mono text-zinc-400 space-y-1">
          <div className="flex items-center gap-1.5 text-pink-400 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Automatic Spam Safeguard Active</span>
          </div>
          <p className="text-zinc-500 leading-relaxed">
            Callers who are declined 2 times consecutively by you are automatically rate-limited with a 15-minute cool-down before they can ring your device again.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl font-mono transition cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}
