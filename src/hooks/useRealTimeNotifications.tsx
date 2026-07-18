import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { COMPANIONS } from '../data';
import toast from 'react-hot-toast';

export function useRealTimeNotifications(
  currentUserId: string,
  onNotification: (message: string) => void
) {
  const lastKnownViewsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!currentUserId || currentUserId === 'anon_user' || currentUserId === 'user' || currentUserId === 'undefined' || currentUserId === 'null' || currentUserId.trim() === '') return;

    // 1. Fetch initial view counts for the current user's shorts to establish a baseline
    const fetchMyShorts = async () => {
      try {
        const { data, error } = await supabase
          .from('lounge_shorts')
          .select('id, views_count')
          .eq('host_id', currentUserId);
        
        if (!error && data) {
          const viewsMap: Record<string, number> = {};
          data.forEach(item => {
            viewsMap[item.id] = Number(item.views_count || 0);
          });
          lastKnownViewsRef.current = viewsMap;
        }
      } catch (err) {
        console.warn("Error fetching baseline views for real-time tracking:", err);
      }
    };

    fetchMyShorts();

    // 2. Setup real-time listeners for likes and views
    const notificationChannel = supabase
      .channel(`realtime-lounge-notifications-${currentUserId}-${Math.random().toString(36).substring(2, 11)}`)
      // ❤️ Watch for new likes on lounge_short_likes
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lounge_short_likes'
      }, async (payload) => {
        const { short_id, user_id } = payload.new;

        // Skip self-likes
        if (user_id === currentUserId) return;

        try {
          // Fetch the short to verify ownership and get details
          const { data: short } = await supabase
            .from('lounge_shorts')
            .select('host_id, caption')
            .eq('id', short_id)
            .maybeSingle();

          if (short && short.host_id === currentUserId) {
            const cleanCaption = short.caption ? short.caption.split(' [filter:')[0] : 'your short video';
            onNotification(`Someone liked your video "${cleanCaption}"! ❤️`);
          }
        } catch (err) {
          console.warn("Failed to process real-time like notification:", err);
        }
      })
      // ❤️ Watch for new likes on legacy/alternative short_likes table
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'short_likes'
      }, async (payload) => {
        const { short_id, user_id } = payload.new;

        // Skip self-likes
        if (user_id === currentUserId) return;

        try {
          // Fetch the short to verify ownership and get details
          const { data: short } = await supabase
            .from('lounge_shorts')
            .select('host_id, caption')
            .eq('id', short_id)
            .maybeSingle();

          if (short && short.host_id === currentUserId) {
            const cleanCaption = short.caption ? short.caption.split(' [filter:')[0] : 'your short video';
            onNotification(`Someone liked your video "${cleanCaption}"! ❤️`);
          }
        } catch (err) {
          console.warn("Failed to process real-time like notification (short_likes):", err);
        }
      })
      // 👁️ Watch for newly uploaded shorts by current user to dynamically add them to tracking
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lounge_shorts'
      }, (payload) => {
        if (payload.new.host_id === currentUserId) {
          lastKnownViewsRef.current[payload.new.id] = Number(payload.new.views_count || 0);
        }
      })
      // 👁️ Watch for view count updates on lounge_shorts
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'lounge_shorts'
      }, (payload) => {
        if (payload.new.host_id === currentUserId) {
          const shortId = payload.new.id;
          const oldViews = lastKnownViewsRef.current[shortId];
          const newViews = Number(payload.new.views_count || 0);

          // If the views count has increased, trigger view notification
          if (oldViews !== undefined && newViews > oldViews) {
            const diff = newViews - oldViews;
            const cleanCaption = payload.new.caption ? payload.new.caption.split(' [filter:')[0] : 'your short video';
            onNotification(
              `Your video "${cleanCaption}" got ${diff > 1 ? `${diff} new views` : 'a new view'}! 👁️ (Total: ${newViews})`
            );
          }
          // Update the ref map so we don't alert twice for the same number
          lastKnownViewsRef.current[shortId] = newViews;
        }
      })
      // 📅 Watch for new or updated bookings for this user (both as host or client)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings'
      }, (payload) => {
        const companionId = payload.new.companion_id || payload.new.companionId;
        
        // If current user is the host/companion receiving the booking request
        if (companionId === currentUserId) {
          const statusText = payload.new.status || 'pending';
          const msg = `New rendezvous booking proposal received! Status: ${statusText}`;
          onNotification(msg);
          
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
            if (document.visibilityState === 'hidden') {
              const title = "New Booking Proposal";
              const body = `You received a new booking proposal! Status: ${statusText}`;
              
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification(title, {
                    body,
                    icon: "/favicon.ico",
                    badge: "/favicon.ico",
                    tag: "lounge-booking-new-" + (payload.new.id || Date.now()),
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
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings'
      }, (payload) => {
        const companionId = payload.new.companion_id || payload.new.companionId;
        const clientId = payload.new.client_id || payload.new.clientId;
        const oldStatus = payload.old?.status;
        const newStatus = payload.new.status;
        
        // Only notify if status actually changed
        if (oldStatus !== newStatus) {
          if (clientId === currentUserId) {
            const msg = `Your booking status was updated to: ${newStatus}`;
            onNotification(msg);
            
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
              if (document.visibilityState === 'hidden') {
                const title = "Booking Status Updated";
                
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.ready.then((reg) => {
                    reg.showNotification(title, {
                      body: msg,
                      icon: "/favicon.ico",
                      badge: "/favicon.ico",
                      tag: "lounge-booking-update-" + (payload.new.id || Date.now()),
                      renotify: true
                    } as any);
                  }).catch(() => {
                    new Notification(title, { body: msg, icon: "/favicon.ico" });
                  });
                } else {
                  new Notification(title, { body: msg, icon: "/favicon.ico" });
                }
              }
            }
          } else if (companionId === currentUserId) {
            const msg = `Booking status updated to: ${newStatus}`;
            onNotification(msg);
            
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
              if (document.visibilityState === 'hidden') {
                const title = "Booking Status Updated";
                
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.ready.then((reg) => {
                    reg.showNotification(title, {
                      body: msg,
                      icon: "/favicon.ico",
                      badge: "/favicon.ico",
                      tag: "lounge-booking-update-" + (payload.new.id || Date.now()),
                      renotify: true
                    } as any);
                  }).catch(() => {
                    new Notification(title, { body: msg, icon: "/favicon.ico" });
                  });
                } else {
                  new Notification(title, { body: msg, icon: "/favicon.ico" });
                }
              }
            }
          }
        }
      })
      // 💬 Watch for new incoming chat messages for instant floating toast alerts
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, async (payload) => {
        await handleNewIncomingMessage(payload);
      })
      .subscribe();

    async function handleNewIncomingMessage(payload: any) {
      const newMsg = payload.new;
      const receiverId = newMsg.receiver_id || newMsg.recipient_id || newMsg.receiverId;
      const senderId = newMsg.sender_id || newMsg.senderId;

      // CRITICAL CHECK: Only trigger the toast banner if the message is for THIS user and is not sent by themselves
      if (receiverId === currentUserId && senderId !== currentUserId) {
        // Resolve sender's display name, username, and avatar_url
        let senderName = 'Someone';
        let senderAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop';
        
        const hardcodedComp = COMPANIONS.find(c => c.id === senderId);
        if (hardcodedComp) {
          senderName = `@${hardcodedComp.username || hardcodedComp.name}`;
          senderAvatar = hardcodedComp.images?.[0] || senderAvatar;
        } else {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', senderId)
              .maybeSingle();
            if (profile) {
              if (profile.username) {
                senderName = `@${profile.username}`;
              }
              if (profile.avatar_url) {
                senderAvatar = profile.avatar_url;
              }
            }
          } catch (err) {
            console.warn('Error resolving profile for toast:', err);
          }
        }

        const textContent = newMsg.content || newMsg.text || newMsg.text_content || newMsg.message_text || 'Sent an attachment...';

        // Trigger dynamic custom design alert toast with sender avatar and online dot
        toast.custom((t: any) => (
          <div
            className={`${
              t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'
            } max-w-sm w-full bg-[#120d1a] border border-[#ec4899]/30 shadow-[0_10px_30px_rgba(236,72,153,0.15)] rounded-2xl pointer-events-auto flex p-3 mt-2 items-center justify-between transition-all duration-300 ease-out`}
          >
            <div className="flex items-center gap-3 flex-grow min-w-0">
              {/* 📸 Sender Profile Avatar with Live Online Dot Indicator */}
              <div className="relative flex-shrink-0 w-10 h-10">
                <img
                  src={senderAvatar}
                  alt={senderName}
                  className="w-full h-full object-cover rounded-full border border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-[#00cc76] ring-2 ring-[#120d1a]" />
              </div>

              {/* 📝 Text Details Layer */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-white truncate">
                    {senderName}
                  </p>
                  <span className="text-[8px] bg-[#ff2d55]/20 text-[#ff2d55] px-1 py-0.5 rounded font-bold uppercase tracking-wider scale-90">
                    VIP CHAT
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-400 truncate font-medium">
                  {textContent}
                </p>
              </div>
            </div>

            {/* Dismiss Action */}
            <div className="ml-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="text-zinc-500 hover:text-zinc-300 text-[10px] font-bold font-mono uppercase tracking-wide cursor-pointer px-2 py-1 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ), { duration: 4500 });
      }
    }

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [currentUserId, onNotification]);
}
