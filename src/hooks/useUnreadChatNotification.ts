import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useUnreadChatNotification(currentUserId: string) {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!currentUserId || currentUserId === 'anon_user' || currentUserId === 'user' || currentUserId === 'undefined' || currentUserId === 'null' || currentUserId.trim() === '') return;

    // 1. Fetch initial total unread messages from database
    const fetchInitialCount = async () => {
      try {
        const { data, error } = await supabase.rpc('get_unread_chat_count', {
          p_user_id: currentUserId
        });
        if (!error && data !== null) {
          setUnreadCount(Number(data) || 0);
        } else {
          // Fallback if RPC does not exist or fails: fetch messages with is_read=false and receiver_id = currentUserId
          let totalCount = 0;
          const { data, error: countError } = await supabase
            .from('chat_messages')
            .select('id, is_read, sender_id, receiver_id, message_text')
            .eq('receiver_id', currentUserId);

          if (!countError && data) {
            const unread = data.filter((msg: any) => {
              if (msg.sender_id === currentUserId) return false;
              const isRead = msg.is_read;
              return isRead === false || isRead === 'false' || isRead === null;
            });
            totalCount += unread.length;
          }

          setUnreadCount(totalCount);
        }
      } catch (err) {
        console.warn("Error fetching unread notification count:", err);
      }
    };

    fetchInitialCount();

    // 2. Custom listener to clear unread counts immediately on demand
    const handleResetAll = () => {
      fetchInitialCount();
    };
    window.addEventListener('chat-read-all', handleResetAll);
    window.addEventListener('chat-unread-updated', handleResetAll);

    // 3. ⚡ LISTEN REAL-TIME: Watch for new messages sent to this user anywhere in the app
    const globalChatChannel = supabase
      .channel(`global-unread-notifications-${Math.random().toString(36).substring(2, 11)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        handleIncomingInsert(payload);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        handleIncomingInsert(payload);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, () => {
        fetchInitialCount();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages'
      }, () => {
        fetchInitialCount();
      })
      .subscribe();

    function handleIncomingInsert(payload: any) {
      const targetReceiver = payload.new.receiver_id || payload.new.recipient_id || payload.new.receiverId;
      const senderId = payload.new.sender_id || payload.new.senderId;
      
      // If the message is for me, increment the unread count banner badge instantly
      if (targetReceiver === currentUserId || (senderId && senderId !== currentUserId)) {
        setUnreadCount(prev => prev + 1);
        
        // Trigger a browser/system audio chirp or native notification toast while the app is in the background
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
          if (document.visibilityState === 'hidden') {
            const title = "New Lounge Message";
            const body = payload.new.content || payload.new.text || payload.new.text_content || payload.new.message_text || "Sent an audio note...";
            
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(title, {
                  body,
                  icon: "/favicon.ico",
                  badge: "/favicon.ico",
                  tag: "lounge-chat-" + (payload.new.id || Date.now()),
                  renotify: true
                } as any);
              }).catch(() => {
                new Notification(title, { body, icon: "/favicon.ico" });
              });
            } else {
              new Notification(title, { body, icon: "/favicon.ico" });
            }
          }
        }
      }
    }

    return () => {
      supabase.removeChannel(globalChatChannel);
      window.removeEventListener('chat-read-all', handleResetAll);
    };
  }, [currentUserId]);

  return { unreadCount, setUnreadCount };
}
