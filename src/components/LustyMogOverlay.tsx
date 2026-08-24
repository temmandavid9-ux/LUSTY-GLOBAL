import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ActiveMogEvent {
  id: string;
  senderName: string;
  mog: {
    label: string;
    icon: string;
    subtext: string;
  };
}

export const LustyMogOverlay: React.FC<{ activeMogs: ActiveMogEvent[] }> = ({ activeMogs }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex flex-col items-center justify-center overflow-hidden">
      <AnimatePresence>
        {activeMogs.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, scale: 0.5, y: 80 }}
            animate={{ opacity: 1, scale: 1.1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -80 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-zinc-950/95 border border-amber-500/50 shadow-[0_0_50px_rgba(212,175,55,0.4)] backdrop-blur-2xl my-2"
          >
            <span className="text-5xl filter drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]">
              {event.mog.icon}
            </span>
            <div className="flex flex-col">
              <span className="text-amber-400 text-xs font-mono tracking-widest uppercase">
                {event.senderName} sent
              </span>
              <span className="text-zinc-100 font-black text-lg tracking-wider uppercase font-sans">
                {event.mog.label}
              </span>
              <span className="text-amber-500/70 text-[11px] font-mono">
                {event.mog.subtext}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
