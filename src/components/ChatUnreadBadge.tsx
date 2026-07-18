import { useState, useEffect } from 'react';
import { supabase as defaultSupabase } from '../lib/supabase';

interface ChatUnreadBadgeProps {
  currentUserId: string;
  supabase?: any;
}

export function ChatUnreadBadge({ currentUserId, supabase: customSupabase }: ChatUnreadBadgeProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const supabaseInstance = customSupabase || defaultSupabase;

  useEffect(() => {
    if (!currentUserId || currentUserId === 'anon_user' || currentUserId === 'user' || currentUserId === 'undefined' || currentUserId === 'null' || currentUserId.trim() === '') return;

    // 1. Initial query count fetch
    async function getInitialCount() {
      try {
        const { data, error } = await supabaseInstance
          .from('chat_messages')
          .select('id, is_read, sender_id, receiver_id, message_text')
          .eq('receiver_id', currentUserId);

        if (!error && data) {
          const unread = data.filter((msg: any) => {
            const sender = msg.sender_id;
            if (sender === currentUserId) return false; // Don't count my own messages
            
            const isRead = msg.is_read;
            return isRead === false || isRead === 'false' || isRead === null;
          });
          setUnreadCount(unread.length);
          return;
        }
      } catch (err) {
        console.warn('[ChatUnreadBadge] Error getting initial unread count:', err);
      }
    }

    getInitialCount();

    // 2. ⚡ Bulletproof Realtime Change Listener for 'chat_messages'
    const channelName = `schema-db-changes-${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabaseInstance
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for inserts, updates, and deletes
          schema: 'public',
          table: 'chat_messages'
        },
        (payload: any) => {
          // New incoming message case
          if (payload.eventType === 'INSERT') {
            const msg = payload.new;
            if (msg.sender_id !== currentUserId && !msg.is_read) {
              setUnreadCount((prev) => prev + 1);
            }
          }
          
          // Message marked as read case
          if (payload.eventType === 'UPDATE') {
            const oldMsg = payload.old;
            const newMsg = payload.new;
            if (oldMsg && oldMsg.is_read === false && newMsg && newMsg.is_read === true) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    // Reset listener triggered by window custom events to keep client tabs synchronized
    const handleResetAll = () => {
      getInitialCount();
    };
    window.addEventListener('chat-read-all', handleResetAll);
    window.addEventListener('chat-unread-updated', handleResetAll);

    return () => {
      supabaseInstance.removeChannel(channel);
      window.removeEventListener('chat-read-all', handleResetAll);
      window.removeEventListener('chat-unread-updated', handleResetAll);
    };
  }, [currentUserId, supabaseInstance]);

  if (unreadCount === 0) return null;

  return (
    /* 🔴 Matching your circular image perfectly */
    <span id="chat-unread-badge" className="inline-flex items-center justify-center bg-[#b81d18] text-white text-[11px] font-bold rounded-full w-5 h-5 shadow-sm text-center">
      {unreadCount}
    </span>
  );
}
