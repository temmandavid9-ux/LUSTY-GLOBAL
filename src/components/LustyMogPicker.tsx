import React from 'react';

export interface VIPMog {
  id: string;
  label: string;
  subtext: string;
  icon: string;
  gradient: string;
  border: string;
  glow: string;
}

export const LUSTY_VIP_MOGS: VIPMog[] = [
  {
    id: 'seduction',
    label: 'Seduction MOG',
    subtext: 'Magnetic Allure',
    icon: '💋',
    gradient: 'from-rose-950/80 to-zinc-950',
    border: 'border-rose-500/40 hover:border-rose-400',
    glow: 'shadow-[0_0_15px_rgba(225,29,72,0.2)]',
  },
  {
    id: 'aura',
    label: 'Aura MOG',
    subtext: 'Room Dominance',
    icon: '👑',
    gradient: 'from-amber-950/80 to-zinc-950',
    border: 'border-yellow-500/40 hover:border-yellow-400',
    glow: 'shadow-[0_0_15px_rgba(212,175,55,0.25)]',
  },
  {
    id: 'frame-fit',
    label: 'Frame & Fit',
    subtext: 'Haute Couture',
    icon: '🥂',
    gradient: 'from-amber-900/60 to-zinc-950',
    border: 'border-amber-500/40 hover:border-amber-300',
    glow: 'shadow-[0_0_15px_rgba(202,138,4,0.2)]',
  },
  {
    id: 'high-roller',
    label: 'Platinum MOG',
    subtext: 'Exclusive Access',
    icon: '💎',
    gradient: 'from-slate-900 to-zinc-950',
    border: 'border-slate-400/40 hover:border-slate-200',
    glow: 'shadow-[0_0_15px_rgba(226,232,240,0.2)]',
  },
  {
    id: 'sovereign',
    label: 'Brutal VIP',
    subtext: 'Unmatched Status',
    icon: '🔱',
    gradient: 'from-yellow-950/90 via-amber-900/40 to-zinc-950',
    border: 'border-yellow-400 hover:border-yellow-300',
    glow: 'shadow-[0_0_25px_rgba(234,179,8,0.35)]',
  },
];

interface Props {
  onSendMog: (mog: VIPMog) => void;
}

export const LustyMogPicker: React.FC<Props> = ({ onSendMog }) => {
  return (
    <div className="flex gap-2.5 p-2.5 bg-zinc-950/90 backdrop-blur-xl border border-amber-500/20 rounded-2xl overflow-x-auto max-w-full no-scrollbar">
      {LUSTY_VIP_MOGS.map((mog) => (
        <button
          key={mog.id}
          type="button"
          onClick={() => onSendMog(mog)}
          className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-xl border bg-gradient-to-r ${mog.gradient} ${mog.border} ${mog.glow} transition-all duration-300 active:scale-95 whitespace-nowrap cursor-pointer shrink-0`}
        >
          <span className="text-xl group-hover:scale-110 transition-transform duration-200">
            {mog.icon}
          </span>
          <div className="flex flex-col text-left">
            <span className="text-zinc-100 font-bold text-xs tracking-wider uppercase font-sans">
              {mog.label}
            </span>
            <span className="text-[10px] text-amber-400/80 font-mono tracking-tight">
              {mog.subtext}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};
