import React, { useState, useEffect } from 'react';
import { Star, X, CheckCircle2, Shield, ThumbsUp, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface PlatformRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}

export const PlatformRatingModal: React.FC<PlatformRatingModalProps> = ({
  isOpen,
  onClose,
  username = 'VIP Guest'
}) => {
  const [overallRating, setOverallRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  
  // Category sub-ratings
  const [categoryRatings, setCategoryRatings] = useState({
    videoFeed: 5,
    verification: 5,
    booking: 5,
    chatExperience: 5
  });

  // Selected quick tags
  const [selectedTags, setSelectedTags] = useState<string[]>([
    '⚡ Fast Video Streaming',
    '🔒 Secure Escrow Payments',
    '✨ Verified VIP Companions'
  ]);

  const [reviewText, setReviewText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  // Saved user submission history check
  useEffect(() => {
    const saved = localStorage.getItem('platform_user_review');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          setOverallRating(parsed.overallRating || 5);
          setCategoryRatings(parsed.categoryRatings || categoryRatings);
          setSelectedTags(parsed.selectedTags || []);
          setReviewText(parsed.reviewText || '');
        }
      } catch (e) {
        console.warn('Could not parse saved review:', e);
      }
    }
  }, []);

  if (!isOpen) return null;

  const quickTagOptions = [
    '⚡ Fast Video Streaming',
    '🔒 Secure Escrow Payments',
    '✨ Verified VIP Companions',
    '🎥 Pro AR Face Filters',
    '💬 Instant Realtime Chat',
    '🗺️ Precise Location Map',
    '📱 Sleek UI & Layout'
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const reviewPayload = {
        username,
        overallRating,
        categoryRatings,
        selectedTags,
        reviewText,
        submittedAt: new Date().toISOString()
      };

      localStorage.setItem('platform_user_review', JSON.stringify(reviewPayload));
      setIsSubmitting(false);
      setHasSubmitted(true);

      toast.success('Thank you for rating LUSTY GLOBAL! Your feedback keeps our VIP platform pristine.', {
        style: {
          background: '#09090b',
          color: '#ec4899',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          fontFamily: 'sans-serif',
          fontSize: '12px'
        }
      });
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
      <div 
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800/80 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
                Rate Platform Experience
                <span className="text-[10px] bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono uppercase font-extrabold">
                  VIP Feedback
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-sans">
                Help us refine LUSTY GLOBAL for verified hosts & guests
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Community Score Banner */}
        <div className="bg-gradient-to-r from-pink-950/40 via-purple-950/20 to-zinc-950 border-b border-zinc-900 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-black text-amber-400 font-mono tracking-tight flex items-baseline gap-1">
              <span>4.9</span>
              <span className="text-xs text-zinc-500 font-sans font-normal">/ 5.0</span>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">1,280+ Verified Platform Reviews</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-emerald-400 text-[10px] font-mono font-bold">
            <Shield className="w-3 h-3" />
            <span>99.8% Satisfaction</span>
          </div>
        </div>

        {/* Main Content Form */}
        <div className="p-5 overflow-y-auto space-y-6 no-scrollbar flex-1 text-left">
          {hasSubmitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Review Saved & Published!</h4>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-1">
                  Your rating ({overallRating} Stars) has been recorded. Thank you for contributing to the LUSTY GLOBAL community standard.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-lg shadow-pink-500/20"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Overall Star Rating */}
              <div className="text-center space-y-2 bg-zinc-900/50 border border-zinc-850 p-4 rounded-2xl">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono block">
                  Overall Platform Rating
                </label>
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || overallRating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setOverallRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform transform hover:scale-125 focus:outline-none cursor-pointer"
                      >
                        <Star 
                          className={`w-8 h-8 transition-colors ${
                            active 
                              ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                              : 'text-zinc-700 hover:text-zinc-500'
                          }`} 
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-bold text-amber-400 font-mono block">
                  {overallRating === 5 && '🌟 Exceptional - Gold Standard!'}
                  {overallRating === 4 && '👍 Great Experience!'}
                  {overallRating === 3 && '👌 Good - Solid Features'}
                  {overallRating === 2 && '⚠️ Needs Improvement'}
                  {overallRating === 1 && '👎 Poor'}
                </span>
              </div>

              {/* Sub-Category Ratings */}
              <div className="space-y-3 bg-zinc-900/30 border border-zinc-850 p-4 rounded-2xl">
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                  Detailed Module Ratings
                </h4>
                
                {[
                  { key: 'videoFeed', label: '🎬 Shorts Video & AR Filters' },
                  { key: 'verification', label: '🛡️ Host Verification & Safety' },
                  { key: 'booking', label: '💳 Direct Booking & Escrow' },
                  { key: 'chatExperience', label: '💬 Realtime Private Messaging' }
                ].map(({ key, label }) => {
                  const currentVal = categoryRatings[key as keyof typeof categoryRatings];
                  return (
                    <div key={key} className="flex items-center justify-between text-xs py-1">
                      <span className="text-zinc-300 font-medium">{label}</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCategoryRatings(prev => ({ ...prev, [key]: s }))}
                            className="p-0.5 cursor-pointer hover:scale-110 transition"
                          >
                            <Star 
                              className={`w-4 h-4 ${
                                currentVal >= s 
                                  ? 'fill-amber-400 text-amber-400' 
                                  : 'text-zinc-800 hover:text-zinc-600'
                              }`} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Aspect Tags */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
                  Highlight Favorite Features
                </label>
                <div className="flex flex-wrap gap-2">
                  {quickTagOptions.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition cursor-pointer ${
                          isSelected
                            ? 'bg-pink-500/20 text-pink-300 border-pink-500/50 font-bold'
                            : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Written Review */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
                  Written Feedback / Suggestions (Optional)
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your thoughts on performance, video filters, companion host listings, or requested features..."
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/60 transition resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Submitting Review...</span>
                  ) : (
                    <>
                      <ThumbsUp className="w-4 h-4" />
                      <span>Submit Platform Rating</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
};
