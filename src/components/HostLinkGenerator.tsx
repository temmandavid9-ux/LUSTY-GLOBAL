import { useState } from 'react';
import { Share2, Link, Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface HostLinkGeneratorProps {
  username: string;
}

export function HostLinkGenerator({ username }: HostLinkGeneratorProps) {
  const [copied, setCopied] = useState(false);
  
  // 🎯 Dynamic platform domain link matching the premium branding of LUSTY GLOBAL VIP
  // We use the window.location.origin to support whichever domain the app runs on (like AIS previews or custom domains)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lustyglobal.vip';
  const shareUrl = `${origin}/join/${username || 'anonymous'}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      
      // 🚀 Premium customized toast showing off the viral asset launch
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-in fade-in slide-in-from-top-4 duration-300' : 'animate-out fade-out slide-out-to-top-4 duration-300'
          } max-w-sm w-full bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl pointer-events-auto p-4 mt-2 flex items-center gap-3 text-left z-50`}
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm flex-shrink-0">
            <Link className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-emerald-400 uppercase tracking-wider font-sans">
              Promo Link Copied!
            </p>
            <p className="text-[11px] text-zinc-400 font-medium font-sans mt-0.5">
              Ready to share on Instagram, X, or Snapchat bio.
            </p>
          </div>
        </div>
      ), { duration: 4000 });

      // Reset local indicator button state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Could not copy text: ", err);
      toast.error("Failed to copy link.", {
        style: {
          background: '#09090b',
          color: '#f4f4f5',
          border: '1px solid #27272a'
        }
      });
    }
  };

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-left relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-pink-500 animate-pulse" />
            <h3 className="text-white font-black text-xs uppercase tracking-wider font-mono">
              📢 Viral Marketing Link
            </h3>
          </div>
          <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-black tracking-widest uppercase animate-pulse">
            GROWTH
          </span>
        </div>
        
        <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed font-sans">
          Share this custom-branded promo link on your socials to bring your fans directly to your premium lounge profile and earn instant commissions.
        </p>

        {/* Modern Box displaying the static target URL */}
        <div className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3 flex items-center justify-between gap-3 my-4">
          <p className="text-zinc-300 font-mono text-xs truncate select-all">
            {shareUrl}
          </p>
          <Sparkles className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        </div>
      </div>

      {/* Call to Action Trigger Button */}
      <button
        type="button"
        onClick={handleCopyLink}
        className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-[0.99] shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
          copied 
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10' 
            : 'bg-pink-500 hover:bg-pink-600 text-white shadow-pink-500/20'
        }`}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            <span>Link Secured to Clipboard</span>
          </>
        ) : (
          <>
            <Link className="w-4 h-4" />
            <span>Copy My Promo Link</span>
          </>
        )}
      </button>
    </div>
  );
}
