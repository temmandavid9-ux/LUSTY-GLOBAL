import React from 'react';
import { useReceivedTips } from '../hooks/useReceivedTips';

export const ReceivedTipsView: React.FC<{ userId: string }> = ({ userId }) => {
  const { tips, totalEarned, loading } = useReceivedTips(userId);

  if (loading) {
    return (
      <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-400 text-sm font-mono flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Loading tip history & balance...
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-xl">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>💸</span> Received Tips
          </h2>
          <p className="text-xs text-slate-400">Total tip earnings credited to your balance</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-extrabold text-emerald-400">${totalEarned.toFixed(2)}</span>
          <span className="block text-xs text-slate-400 font-mono">USD Total</span>
        </div>
      </div>

      {tips.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center font-mono">No tips received yet.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg flex justify-between items-center hover:bg-slate-800 transition"
            >
              <div>
                <p className="text-sm font-medium text-slate-200 font-mono">
                  Tip from User #{tip.tipper_id ? tip.tipper_id.substring(0, 8) : 'Anonymous'}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {new Date(tip.created_at).toLocaleString()}
                </p>
              </div>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                +${Number(tip.amount).toFixed(2)} {tip.currency || 'USD'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
