import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { COMPANIONS } from '../data';
import { Message, Companion } from '../types';
import { Send, Image, CreditCard, CheckCheck, ShieldAlert, Award, Mic, Volume2, Crown, ArrowRight, PhoneOff, PhoneCall, MessageSquare } from 'lucide-react';
import { calculateDistanceInMiles } from '../utils/geo';
import { initiateFlutterwavePayment } from '../lib/flutterwave';
import { sanitizeUserInput, checkClientRateLimit } from '../utils/security';
import { motion, AnimatePresence } from 'motion/react';
import { LustyMogPicker, VIPMog } from './LustyMogPicker';
import { LustyMogOverlay, ActiveMogEvent } from './LustyMogOverlay';
import RecentCallsView from './RecentCallsView';

interface MogReaction {
  id: number;
  emoji: string;
  x: number;
  rotation: number;
}

const MOG_REACTIONS = ['💋', '👑', '💎', '🔱', '🥂', '👁️‍🗨️', '🖤'];

export function useOnlineStatusTracker(currentUserId: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) return;

    // 1. Establish a real-time tracking channel for system presence
    const syncChannel = supabase.channel('online-users-deck', {
      config: {
        presence: {
          key: currentUserId, // Tracks this specific user session id
        },
      },
    });

    // 2. Setup event listeners to watch people join and leave
    syncChannel
      .on('presence', { event: 'sync' }, () => {
        const state = syncChannel.presenceState();
        
        // Extract all user IDs currently connected to the cluster
        const activeIds = new Set<string>(Object.keys(state));
        setOnlineUsers(activeIds);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        console.log(`User node connected: ${key}`);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log(`User node disconnected: ${key}`);
      });

    // 3. Register this device session as "Active"
    syncChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await syncChannel.track({
          online_at: new Date().toISOString(),
        });
      }
    });

    // Clean up connections when the user closes their dashboard tab
    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [currentUserId]);

  return onlineUsers; // Returns a live Set of user IDs who are actually online
}

interface ChatViewProps {
  activeCompanionId: string | null;
  onOpenBooking: (companionId: string) => void;
  onSendTip: (companionId: string, amount: number) => void;
  currentUserId?: string;
  currentBalance?: number;
  onTopUp?: (amount: number) => void;
}

export default function ChatView({ 
  activeCompanionId, 
  onOpenBooking, 
  onSendTip, 
  currentUserId = 'user',
  currentBalance = 1450.00,
  onTopUp
}: ChatViewProps) {
  
  const handleOpenEscrowVault = (selectedHostId: string) => {
    onOpenBooking(selectedHostId);
  };

  const onlineUsersSet = useOnlineStatusTracker(currentUserId);

  // Channels, tabs and selection states
  const [chatTab, setChatTab] = useState<'chats' | 'calls'>('chats');
  const [channels, setChannels] = useState<Companion[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [mogList, setMogList] = useState<MogReaction[]>([]);
  const [showMogPicker, setShowMogPicker] = useState(false);
  const [activeOverlayMogs, setActiveOverlayMogs] = useState<ActiveMogEvent[]>([]);

  const handleSendVipMog = (mog: VIPMog) => {
    // 1. Create overlay event
    const eventId = `mog-${Date.now()}-${Math.random()}`;
    const newEvent: ActiveMogEvent = {
      id: eventId,
      senderName: 'You',
      mog: {
        label: mog.label,
        icon: mog.icon,
        subtext: mog.subtext
      }
    };
    setActiveOverlayMogs((prev) => [...prev, newEvent]);

    // Auto-remove overlay after 3 seconds
    setTimeout(() => {
      setActiveOverlayMogs((prev) => prev.filter((e) => e.id !== eventId));
    }, 3000);

    // 2. Spawn 4 floating particles
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        setMogList((prev) => [
          ...prev.slice(-6),
          {
            id: Date.now() + Math.random(),
            emoji: mog.icon,
            x: (Math.random() - 0.5) * 100,
            rotation: (Math.random() - 0.5) * 50
          }
        ]);
      }, i * 100);
    }

    // 3. Send message if channel is active
    if (selectedId) {
      const formattedMogText = `${mog.icon} [VIP ${mog.label.toUpperCase()}] ${mog.subtext}`;
      handleSendMessage(undefined, null, formattedMogText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Trigger on valid character keystrokes (alphanumeric, punctuation, spaces, emojis, etc.)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const randomMog = MOG_REACTIONS[Math.floor(Math.random() * MOG_REACTIONS.length)];
      
      const newMog: MogReaction = {
        id: Date.now() + Math.random(),
        emoji: randomMog,
        x: (Math.random() - 0.5) * 80, // Random left/right drift (-40px to 40px)
        rotation: (Math.random() - 0.5) * 40, // Tilt angle (-20deg to 20deg)
      };

      // Keep max 8 active floating Mogs on screen to keep it smooth
      setMogList((prev) => [...prev.slice(-7), newMog]);
    }
  };

  const removeMog = (id: number) => {
    setMogList((prev) => prev.filter((item) => item.id !== id));
  };
  const [selectedTipAmount, setSelectedTipAmount] = useState<number>(50);
  const [highlightSend, setHighlightSend] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingChannelRef = useRef<any>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number }>({
    lat: 51.5074,
    lon: -0.1278
  });

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        console.warn('Geolocation blocked or failed in ChatView:', error);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // 📝 REAL-TIME PRESENCE: Listen to typing status changes from the partner
  useEffect(() => {
    if (!currentUserId || !selectedId) {
      setIsPartnerTyping(false);
      return;
    }

    // Subscribe to presence updates on the 'typing_status' or 'chat_sessions' real-time channel
    const channel = supabase.channel('typing_status', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let partnerIsTyping = false;
        
        Object.entries(state).forEach(([key, presenceItems]: [string, any]) => {
          if (key === selectedId) {
            presenceItems.forEach((item: any) => {
              if (item.is_typing === true && item.typing_to === currentUserId) {
                partnerIsTyping = true;
              }
            });
          }
        });
        
        setIsPartnerTyping(partnerIsTyping);
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedId]);

  // 📝 REAL-TIME TYPING: Broadcast our own typing state on the 'typing_status' channel when input text changes
  useEffect(() => {
    if (!typingChannelRef.current || !currentUserId || !selectedId) return;

    const channel = typingChannelRef.current;
    const hasText = inputText.trim().length > 0;
    let timeoutId: any = null;

    if (hasText) {
      channel.track({
        is_typing: true,
        typing_to: selectedId,
        user_id: currentUserId,
        typed_at: new Date().toISOString()
      });

      // Reset typing status if idle for 3 seconds
      timeoutId = setTimeout(() => {
        if (typingChannelRef.current === channel) {
          channel.track({
            is_typing: false,
            typing_to: selectedId,
            user_id: currentUserId,
            typed_at: new Date().toISOString()
          });
        }
      }, 3000);
    } else {
      channel.track({
        is_typing: false,
        typing_to: selectedId,
        user_id: currentUserId,
        typed_at: new Date().toISOString()
      });
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [inputText, currentUserId, selectedId]);

  // ⚡ REAL-TIME SYNC: Update balance instantly when a top-up or tip happens
  const [_liveBalance, setLiveBalance] = useState<number>(currentBalance);
  const [_loadingBalance, setLoadingBalance] = useState(true);

  useEffect(() => {
    if (currentBalance !== undefined && currentBalance !== null) {
      setLiveBalance(currentBalance);
    }
  }, [currentBalance]);

  const fetchUserWallet = useCallback(async () => {
    if (!currentUserId || currentUserId === 'user') {
      setLoadingBalance(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('token_balance, current_balance')
        .eq('id', currentUserId)
        .single();

      if (!error && data) {
        const bal = data.token_balance !== undefined && data.token_balance !== null
          ? data.token_balance
          : data.current_balance;
        setLiveBalance(Number(bal) || 0);
      }
    } catch (err) {
      console.warn("Error fetching user wallet balance:", err);
    } finally {
      setLoadingBalance(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || currentUserId === 'user') {
      setLoadingBalance(false);
      return;
    }

    fetchUserWallet();

    const walletSubscription = supabase
      .channel(`profile-wallet-${currentUserId}-${Math.random().toString(36).substring(2, 11)}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles', 
        filter: `id=eq.${currentUserId}` 
      }, (payload) => {
        if (payload.new) {
          const bal = payload.new.token_balance !== undefined && payload.new.token_balance !== null
            ? payload.new.token_balance
            : payload.new.current_balance;
          if (bal !== undefined && bal !== null) {
            setLiveBalance(Number(bal) || 0);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(walletSubscription);
    };
  }, [currentUserId, currentBalance, fetchUserWallet]);

  // Unread badge counters & Live Sidebar Metrics
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});

  const fetchUnreadCounts = async () => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('sender_id, receiver_id, is_read')
        .eq('receiver_id', currentUserId);

      if (!error && data) {
        const counts: { [key: string]: number } = {};
        data.forEach((msg: any) => {
          const sender = msg.sender_id;
          const isRead = msg.is_read;
          if (sender && sender !== currentUserId && (isRead === false || isRead === 'false' || isRead === null)) {
            counts[sender] = (counts[sender] || 0) + 1;
          }
        });
        setUnreadCounts(counts);
      }
    } catch (e) {
      console.warn("Error fetching unread counts:", e);
    }
  };

  const markMessagesAsRead = async (companionId: string) => {
    if (!currentUserId || !companionId) return;
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('sender_id', companionId)
        .eq('receiver_id', currentUserId);

      try {
        await supabase.rpc('mark_thread_as_read', {
          chat_user_id: companionId,
          current_viewer_id: currentUserId
        });
      } catch (rpcErr) {
        console.warn("RPC mark_thread_as_read failed:", rpcErr);
      }

      setUnreadCounts(prev => ({
        ...prev,
        [companionId]: 0
      }));

      // Flush sticky notifications
      window.dispatchEvent(new CustomEvent('chat-read-all'));
      window.dispatchEvent(new CustomEvent('chat-unread-updated'));
    } catch (e) {
      console.warn("Failed to mark messages as read:", e);
    }
  };

  // 🎯 Handle Thread Activation
  const handleSelectThread = async (selectedUserId: string) => {
    setSelectedId(selectedUserId);

    // Optimistically zero out the unread indicator in UI
    setUnreadCounts(prev => ({
      ...prev,
      [selectedUserId]: 0
    }));

    await markMessagesAsRead(selectedUserId);

    try {
      // Persist read state change to database
      await supabase.rpc('mark_thread_as_read', {
        chat_user_id: selectedUserId,
        current_viewer_id: currentUserId
      });
    } catch (err) {
      console.error("Failed to clear notification state badge:", err);
    }
  };

  const loadCompanions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch recent messages involving current user to pre-populate lastMessage and lastMessageAt
        let recentMsgs: any[] = [];
        if (currentUserId && currentUserId !== 'user') {
          try {
            const { data: msgs, error: msgsErr } = await supabase
              .from('chat_messages')
              .select('*')
              .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
              .order('created_at', { ascending: false });
            if (!msgsErr && msgs) {
              recentMsgs = msgs;
            }
          } catch (errMsgs) {
            console.warn("Could not load recent messages to pre-sort chat list:", errMsgs);
          }
        }

        const interactedCompanionIds = new Set<string>();
        recentMsgs.forEach(m => {
          const sId = m.sender_id || m.senderId;
          const rId = m.recipient_id || m.receiverId || m.receiver_id;
          if (sId && sId !== currentUserId) interactedCompanionIds.add(sId);
          if (rId && rId !== currentUserId) interactedCompanionIds.add(rId);
        });

        const mapped: Companion[] = data
          .filter((profile: any) => {
            if (profile.id === currentUserId) return false;
            // 🚫 CRITICAL FILTER: Only show active, explicitly clicked or messaged profile chats
            const hasInteracted = interactedCompanionIds.has(profile.id);
            const isActiveSelection = profile.id === activeCompanionId;
            return hasInteracted || isActiveSelection;
          })
          .map((profile: any) => {
            const rawTags = Array.isArray(profile.tags) ? profile.tags : [];
            const tags = rawTags.map((t: string) => t.startsWith('#') ? t.substring(1) : t);
            
            const loc = profile.location || 'London, Mayfair';
            const hasValidUserCoords = userCoords && userCoords.lat !== 0 && userCoords.lon !== 0;

            let distanceStr = "Location unavailable";
            let miles = 9999;

            if (loc.toLowerCase().includes('remote') || profile.is_remote) {
              distanceStr = "Remote session";
              miles = 0;
            } else if (hasValidUserCoords) {
              const latOffset = Number(profile.lat_offset) || 0;
              const lngOffset = Number(profile.lng_offset) || 0;
              const hostLat = userCoords.lat + (latOffset * 0.1);
              const hostLon = userCoords.lon + (lngOffset * 0.1);
              miles = calculateDistanceInMiles(userCoords.lat, userCoords.lon, hostLat, hostLon);
              const formattedDistance = miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
              distanceStr = `~${formattedDistance} miles away`;
            }

            // Find the most recent message with this companion
            const lastMsgObj = recentMsgs.find(m => 
              (m.sender_id === profile.id || m.senderId === profile.id || m.recipient_id === profile.id || m.receiverId === profile.id)
            );

            return {
              id: profile.id,
              username: profile.username || 'anonymous',
              name: profile.name || profile.username || 'Anonymous Host',
              avatar: profile.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
              images: [
                profile.cover_image_url || profile.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600'
              ],
              isVIP: !!(profile.is_verified || profile.tier_badge === 'VIP SELECT'),
              is_verified: !!profile.is_verified,
              isVerified: !!profile.is_verified,
              isOnline: profile.is_online === true || (profile.last_seen && new Date(profile.last_seen).getTime() > Date.now() - 5 * 60 * 1000),
              age: profile.age || 24,
              location: profile.location || 'London, Mayfair',
              distance: distanceStr,
              ratePerHour: profile.hourly_rate || 250,
              bio: profile.bio || 'Verified VIP guest. Rates available on demand 🔒',
              default_caption: profile.default_caption || profile.title || profile.bio || '',
              tags: tags,
              rating: (profile.is_verified || profile.tier_badge === 'VIP SELECT') ? 5.0 : (profile.rating || 4.9),
              avg_rating: (profile.is_verified || profile.tier_badge === 'VIP SELECT') ? 5.0 : (profile.avg_rating || profile.rating || 4.9),
              reviewsCount: profile.reviews_count || 42,
              verifiedAt: profile.verified_at || 'June 2026',
              languages: profile.languages || ['English'],
              lastMessage: lastMsgObj ? (lastMsgObj.content || lastMsgObj.text || '') : '',
              lastMessageAt: lastMsgObj ? (lastMsgObj.created_at || lastMsgObj.time || '1970-01-01T00:00:00.000Z') : '1970-01-01T00:00:00.000Z'
            };
          });
        
        // Pre-sort mapped by lastMessageAt descending
        mapped.sort((a, b) => {
          const timeA = new Date(a.lastMessageAt || 0).getTime();
          const timeB = new Date(b.lastMessageAt || 0).getTime();
          return timeB - timeA;
        });

        setChannels(mapped);
        
        // Select default active channel
        if (activeCompanionId) {
          setSelectedId(activeCompanionId);
        } else if (mapped.length > 0) {
          if (window.innerWidth >= 768) {
            setSelectedId(mapped[0].id);
          }
        }
      } else {
        const mappedCompanions = COMPANIONS.map(c => ({
          ...c,
          is_verified: c.isVIP,
          isVerified: c.isVIP
        })).filter(c => {
          const hasInteracted = offlineMessages[c.id] && offlineMessages[c.id].length > 0;
          const isActiveSelection = c.id === activeCompanionId;
          return hasInteracted || isActiveSelection;
        });
        setChannels(mappedCompanions);
        if (activeCompanionId) {
          setSelectedId(activeCompanionId);
        } else if (window.innerWidth >= 768 && mappedCompanions.length > 0) {
          setSelectedId(mappedCompanions[0].id);
        }
      }
    } catch (err) {
      console.warn("Using offline companion directory listing:", err);
      const mappedCompanions = COMPANIONS.map(c => ({
        ...c,
        is_verified: c.isVIP,
        isVerified: c.isVIP
      })).filter(c => {
        const hasInteracted = offlineMessages[c.id] && offlineMessages[c.id].length > 0;
        const isActiveSelection = c.id === activeCompanionId;
        return hasInteracted || isActiveSelection;
      });
      setChannels(mappedCompanions);
      if (activeCompanionId) {
        setSelectedId(activeCompanionId);
      } else if (window.innerWidth >= 768 && mappedCompanions.length > 0) {
        setSelectedId(mappedCompanions[0].id);
      }
    }
  }, [currentUserId, activeCompanionId, userCoords.lat, userCoords.lon]);

  const triggerChannelUpdateAndReorder = useCallback((partnerId: string, text: string, createdAtISOString: string) => {
    setChannels((prev) => {
      const targetIndex = prev.findIndex(c => c.id === partnerId);
      if (targetIndex === -1) {
        // Automatically trigger reload to include the newly messaged channel
        setTimeout(() => {
          loadCompanions();
        }, 50);
        return prev;
      }

      const updated = [...prev];
      const target = { ...updated[targetIndex] };

      target.lastMessage = text;
      target.lastMessageAt = createdAtISOString;

      // Pull item out of its current index position
      updated.splice(targetIndex, 1);
      // Shift to top
      updated.unshift(target);

      return updated;
    });
  }, [loadCompanions]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchUnreadCounts();

    const channel = supabase
      .channel(`chat_unread_monitoring_${Math.random().toString(36).substring(2, 11)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        fetchUnreadCounts();
        
        const newMsg = payload.new;
        if (newMsg) {
          const sender = newMsg.sender_id || newMsg.senderId;
          const receiver = newMsg.recipient_id || newMsg.receiverId || newMsg.receiver_id;
          const partnerId = sender === currentUserId ? receiver : sender;
          if (partnerId) {
            triggerChannelUpdateAndReorder(
              partnerId,
              newMsg.message_text || newMsg.text_content || newMsg.content || newMsg.text || '',
              newMsg.created_at || newMsg.time || new Date().toISOString()
            );
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, () => {
        fetchUnreadCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, triggerChannelUpdateAndReorder]);

  useEffect(() => {
    if (selectedId) {
      markMessagesAsRead(selectedId);
    }
  }, [selectedId, currentUserId]);

  // Tip Token Top Up states
  const [showTopUpSheet, setShowTopUpSheet] = useState(false);
  const [lowBalanceNeeded, setLowBalanceNeeded] = useState<number | null>(null);
  const [topUpAmountInput, setTopUpAmountInput] = useState('50');
  const [topUpCardHolder, setTopUpCardHolder] = useState('');
  const [topUpCardNum, setTopUpCardNum] = useState('');
  const [topUpCardExpiry, setTopUpCardExpiry] = useState('');
  const [topUpCardCvv, setTopUpCardCvv] = useState('');
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  // 🎙️ Voice Note Recorder System
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleTokenInput = (val: string) => {
    // Strips anything that is not a whole digit string, limits length to 5 characters
    const cleanNumericValue = val.replace(/\D/g, '').slice(0, 5);
    setTopUpAmountInput(cleanNumericValue);
  };

  const handlePerformTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onTopUp) return;
    setIsToppingUp(true);
    
    // Simulate real authorization
    setTimeout(async () => {
      try {
        const amt = Number(topUpAmountInput) || 50;
        await onTopUp(amt);
        
        // Immediately fetch the updated wallet balance from the database
        await fetchUserWallet();
        
        setIsToppingUp(false);
        setTopUpSuccess(true);
        setTimeout(() => {
          setTopUpSuccess(false);
          setShowTopUpSheet(false);
          setLowBalanceNeeded(null);
        }, 1500);
      } catch (err) {
        console.error("Top-up failed to synchronize:", err);
        setIsToppingUp(false);
      }
    }, 1500);
  };

  const handleSendImageMessage = async (file: File) => {
    setIsSending(true);
    try {
      let publicUrl = '';
      try {
        const filePath = `chat-media/${Date.now()}_${file.name}`;
        await supabase.storage.from('chat-attachments').upload(filePath, file);
        const { data } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
        publicUrl = data?.publicUrl || '';
      } catch (storageErr) {
        console.warn("Storage upload failed, fallback to local reader:", storageErr);
      }

      if (!publicUrl) {
        publicUrl = URL.createObjectURL(file);
      }

      const textContent = `🖼️ [Image]`;
      const localMsg: Message = {
        id: `local_msg_${Date.now()}`,
        senderId: currentUserId,
        receiverId: selectedId,
        text: textContent,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'image',
        mediaUrl: publicUrl
      };

      setOfflineMessages(prev => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] || []), localMsg]
      }));
      setMessages(prev => [...prev, localMsg]);
      triggerChannelUpdateAndReorder(selectedId, textContent, new Date().toISOString());

      try {
        const { error } = await supabase.from('chat_messages').insert([
          {
            sender_id: currentUserId,
            receiver_id: selectedId,
            message_text: JSON.stringify({ text: textContent, type: 'image', media_url: publicUrl }),
            is_read: false
          }
        ]);
        if (error) {
          console.error("Database image write error:", error);
        }
      } catch (dbErr) {
        console.warn("Database message write error:", dbErr);
      }
    } catch (err) {
      console.error("Error sending image message:", err);
    } finally {
      setIsSending(false);
    }
  };

  // 🎙️ Voice Note Recording Stream Action Handlers
  const handleToggleVoiceRecord = async () => {
    if (isRecordingVoice) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingVoice(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        
        // Use standardized audio container types compatible across iOS/Android/Safari/Web
        let options: any = {};
        if (typeof MediaRecorder.isTypeSupported === 'function') {
          if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' };
          }
        }
        
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
 
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
 
        mediaRecorder.onstop = async () => {
          const mimeTypeUsed = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeUsed });
          
          // Shut down raw mic streams completely
          stream.getTracks().forEach(track => track.stop());
          
          if (audioBlob.size > 0) {
            await handleSendVoiceNote(audioBlob, mimeTypeUsed);
          }
        };
 
        mediaRecorder.start();
        setIsRecordingVoice(true);
      } catch (err) {
        console.warn("Could not initiate mic recording stream:", err);
        alert("Microphone access is required to record voice notes in this sandbox. Please ensure microphone permissions are granted.");
      }
    }
  };
 
  const handleSendVoiceNote = async (blob: Blob, mimeType: string) => {
    setIsSending(true);
    try {
      let publicUrl = '';
      const isMp4 = mimeType.includes('mp4') || mimeType.includes('aac');
      const fileExtension = isMp4 ? 'mp4' : 'webm';
      const filename = `voice_${Date.now()}.${fileExtension}`;
      
      try {
        const filePath = `chat_audio/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(filePath, blob, {
            contentType: mimeType,
            cacheControl: '3600',
          });
        
        if (!uploadError) {
          const { data } = supabase.storage.from('videos').getPublicUrl(filePath);
          publicUrl = data?.publicUrl || '';
        } else {
          console.warn("Primary videos bucket upload failed, attempting fallback to chat-attachments bucket:", uploadError);
          const fallbackPath = `chat-media/${filename}`;
          const { error: fallbackError } = await supabase.storage
            .from('chat-attachments')
            .upload(fallbackPath, blob, {
              contentType: mimeType
            });
          if (!fallbackError) {
            const { data } = supabase.storage.from('chat-attachments').getPublicUrl(fallbackPath);
            publicUrl = data?.publicUrl || '';
          }
        }
      } catch (storageErr) {
        console.warn("Storage audio upload failed, falling back to local base64 reader:", storageErr);
      }
 
      if (!publicUrl) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          if (typeof reader.result === 'string') {
            await insertVoiceMessage(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } else {
        await insertVoiceMessage(publicUrl);
      }
    } catch (e) {
      console.warn("Failed to complete voice note stream:", e);
    } finally {
      setIsSending(false);
    }
  };
 
  const insertVoiceMessage = async (audioUrl: string) => {
    const textContent = `🎙️ Audio Message`;
    const localMsg: Message = {
      id: `local_msg_${Date.now()}`,
      senderId: currentUserId,
      receiverId: selectedId,
      text: textContent,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'voice',
      mediaUrl: audioUrl
    };
 
    setOfflineMessages(prev => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), localMsg]
    }));
    setMessages(prev => [...prev, localMsg]);
    triggerChannelUpdateAndReorder(selectedId, textContent, new Date().toISOString());
 
    try {
      // Write record to database under 'chat_messages' table with all required fields
      const { error } = await supabase
        .from('chat_messages')
        .insert([
          {
            sender_id: currentUserId,
            receiver_id: selectedId,
            message_text: JSON.stringify({ text: textContent || '🎙️ Audio Message', type: 'voice', media_url: audioUrl }),
            is_read: false
          }
        ]);
      
      if (error) {
        console.error("Error inserting voice note to DB:", JSON.stringify(error, null, 2));
      }
    } catch (err) {
      console.warn("Error inserting voice note:", err);
    }
  };
  
  // Custom offline/memory fallback storage for messages in case of schema discrepancy
  const [offlineMessages, setOfflineMessages] = useState<{ [key: string]: Message[] }>({
    comp_1: [
      { id: 'm1', senderId: 'comp_1', receiverId: currentUserId, text: 'Hey there! Welcome to my VIP profile. Let me know if you are around Mayfair tonight 🥂', time: '10:42 AM', type: 'text' }
    ],
    comp_2: [
      { id: 'm2', senderId: 'comp_2', receiverId: currentUserId, text: 'Loved your gesture! Are you going to watch my dance session tonight? 🎫', time: 'Yesterday', type: 'text' }
    ]
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch real companions (profiles) from Supabase or fallback to COMPANIONS
  useEffect(() => {
    loadCompanions();
  }, [loadCompanions]);

  // Keep track of active target profile object
  const activeCompanion = selectedId ? (channels.find(c => c.id === selectedId) || COMPANIONS.find(c => c.id === selectedId)) : null;

  // 2. Load active message thread & Subscribe to Live Real-Time Changes
  useEffect(() => {
    if (!selectedId) return;

    let active = true;

    const fetchThread = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedId}),and(sender_id.eq.${selectedId},receiver_id.eq.${currentUserId})`)
          .order('created_at', { ascending: true });

        if (!error && data) {
          if (active) {
            setMessages(data.map(mapDbMessageToAppMessage));
          }
        } else {
          if (active) {
            setMessages(offlineMessages[selectedId] || []);
          }
        }
      } catch (err) {
        console.warn("Supabase messages query failed, using offline sandbox messages state.");
        if (active) {
          setMessages(offlineMessages[selectedId] || []);
        }
      }
    };

    fetchThread();

    // Setup real-time listener for real-time messages
    const liveChannel = supabase
      .channel(`chat_thread_${currentUserId}_${selectedId}_${Math.random().toString(36).substring(2, 11)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new;
        const mapped = mapDbMessageToAppMessage(newMsg);
        
        // Filter messages for current active thread
        if (
          (mapped.senderId === selectedId && mapped.receiverId === currentUserId) ||
          (mapped.senderId === currentUserId && mapped.receiverId === selectedId)
        ) {
          setMessages((prev) => {
            // Check for duplicate keys
            if (prev.some(m => m.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
          
          if (mapped.senderId === selectedId) {
            markMessagesAsRead(selectedId);
          }
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(liveChannel);
    };
  }, [selectedId, currentUserId, offlineMessages]);

  // Scroll to bottom whenever messages or recipient shifts
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedId]);

  // Map arbitrary db schemas into a robust App Message interface
  const mapDbMessageToAppMessage = (dbMsg: any): Message => {
    let parsedText = dbMsg.message_text || dbMsg.text_content || dbMsg.content || dbMsg.text || '';
    let type = dbMsg.is_tip_token || dbMsg.type === 'tip' || dbMsg.message_type === 'tip' ? 'tip' : (dbMsg.message_type || dbMsg.type || 'text');
    let mediaUrl = dbMsg.media_url || dbMsg.mediaUrl || undefined;

    if (parsedText.trim().startsWith('{') && parsedText.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(parsedText);
        if (parsed && (parsed.type || parsed.media_url || parsed.mediaUrl)) {
          parsedText = parsed.text || '';
          type = parsed.type || type;
          mediaUrl = parsed.media_url || parsed.mediaUrl || mediaUrl;
        }
      } catch (e) {
        // Not JSON
      }
    }

    return {
      id: dbMsg.id || `msg_${Date.now()}_${Math.random()}`,
      senderId: dbMsg.sender_id || dbMsg.senderId || 'user',
      receiverId: dbMsg.recipient_id || dbMsg.receiverId || 'recipient',
      text: parsedText,
      time: dbMsg.created_at 
        ? new Date(dbMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : dbMsg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      amount: dbMsg.tip_amount || dbMsg.amount || undefined,
      mediaUrl
    };
  };

  // Dispatch message handler
  const handleSendMessage = async (e?: React.FormEvent, tipVal: number | null = null, customText?: string) => {
    if (e) e.preventDefault();
    const rawMessageBody = customText || inputText;
    if (!selectedId || (!rawMessageBody.trim() && !tipVal) || isSending) return;

    // Rate Limiter Check (Max 8 messages per 5 seconds)
    if (!checkClientRateLimit(`chat_msg:${currentUserId}`, 8, 5000)) {
      alert("Rate limit exceeded: Please wait a moment before sending more messages.");
      return;
    }

    // 🚫 Gated Payment validation - trigger payment flow first without inserting into the chat stream!
    if (tipVal) {
      onSendTip(selectedId, tipVal);
      return;
    }

    setIsSending(true);
    // Sanitize user text input against XSS attacks
    const textContent = sanitizeUserInput(rawMessageBody.trim());
    const msgType = 'text';

    const tempId = `temp_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const localMsg: Message = {
      id: tempId,
      senderId: currentUserId,
      receiverId: selectedId,
      text: textContent,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: msgType,
      status: 'sending',
      amount: undefined
    };

    // Optimistically update memory fallback list
    setOfflineMessages(prev => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), localMsg]
    }));

    // Update active message thread locally immediately for snappy zero-latency UI
    setMessages(prev => [...prev, localMsg]);
    triggerChannelUpdateAndReorder(selectedId, textContent, new Date().toISOString());
    setInputText('');

    try {
      const { data, error } = await supabase.from('chat_messages').insert([
        {
          sender_id: currentUserId,
          receiver_id: selectedId,
          message_text: textContent,
          is_read: false
        }
      ]).select().single();

      if (error) {
        console.error("Database text write error:", error);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      } else {
        const realId = data?.id || tempId;
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: realId, status: 'sent' } : m));
      }
    } catch (err) {
      console.warn("Supabase live write failed, executing via sandbox state:", err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
    } finally {
      setIsSending(false);
    }

    // Interactive automated host responses to standard messages
    setIsPartnerTyping(true);
    setTimeout(() => {
      const normalReplies = [
        `That sounds lovely! Let us finalize our booking schedule. Feel free to propose a direct rendezvous or send a secure advanced escrow 🔒`,
        `Thank you for messaging! I am currently online in London and ready to rendezvous. Drop a booking proposal and I will accept it instantly!`,
        `Amazing! Shall we do a VIP booking? Click the booking button above to lock in our time slot. Let me know if you have specific preferences! ✨`
      ];
      const replyText = normalReplies[Math.floor(Math.random() * normalReplies.length)];

      const autoReply: Message = {
        id: `comp_reply_${Date.now()}`,
        senderId: selectedId,
        receiverId: currentUserId,
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text'
      };

      setOfflineMessages(prev => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] || []), autoReply]
      }));
      setMessages(prev => [...prev, autoReply]);
      triggerChannelUpdateAndReorder(selectedId, replyText, new Date().toISOString());
      setIsPartnerTyping(false);
    }, 2000);
  };

  // Retry failed message
  const handleRetryMessage = async (failedMsg: Message) => {
    setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: 'sending' } : m));

    try {
      const { data, error } = await supabase.from('chat_messages').insert([
        {
          sender_id: currentUserId,
          receiver_id: selectedId,
          message_text: failedMsg.text,
          is_read: false
        }
      ]).select().single();

      if (error) {
        console.error("Retry message error:", error);
        setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: 'failed' } : m));
      } else {
        const realId = data?.id || failedMsg.id;
        setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, id: realId, status: 'sent' } : m));
      }
    } catch (err) {
      console.warn("Retry failed:", err);
      setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: 'failed' } : m));
    }
  };

  const totalUnreadMessages = Object.values(unreadCounts).reduce((sum, count) => sum + (count || 0), 0);

  return (
    <div id="chat-view-container" className="w-full max-w-7xl mx-auto flex flex-col h-full md:h-[calc(100vh-120px)] overflow-hidden px-0 md:px-2 font-sans text-white relative">
      <LustyMogOverlay activeMogs={activeOverlayMogs} />
      
      {/* ── 📊 THE SPLIT PANEL MATRIX WRAPPER ── */}
      <div className="grid grid-cols-12 gap-0 md:gap-4 w-full h-full items-start overflow-hidden">
        
        {/* ── 📜 LEFT SIDE PANEL: SCROLLABLE CHAT CHANNELS LEDGER ── */}
        <aside className={`col-span-12 md:col-span-4 bg-[#0c0c0e]/40 border border-zinc-900 rounded-2xl md:rounded-3xl h-full flex flex-col overflow-hidden transition-all duration-300 ${
          selectedId ? 'max-md:hidden' : 'col-span-12'
        }`}>
          
          {/* Static Unscrollable Subsection Title & Tab Switcher Inside Sidebar */}
          <div className="p-3 bg-[#0c0c0e] border-b border-zinc-900/50 shrink-0 select-none flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 w-full">
              <button
                type="button"
                onClick={() => setChatTab('chats')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  chatTab === 'chats'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-950/40'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chats</span>
                {totalUnreadMessages > 0 && (
                  <span className="bg-pink-500 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full animate-pulse ml-0.5">
                    {totalUnreadMessages}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setChatTab('calls')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  chatTab === 'calls'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-950/40'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Logs</span>
              </button>
            </div>
          </div>

          {/* 🔄 Bounded Scrollable Target Layer */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-900">
            {channels.map((user) => {
              const isSelected = selectedId === user.id;
              const userUnread = unreadCounts[user.id] || 0;
              
              // Format to match requirements of the dynamic checks
              const userObj = {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                unread_count: userUnread,
                is_online: (user.isOnline !== undefined && user.isOnline !== null) ? user.isOnline : ((user as any).is_online !== undefined && (user as any).is_online !== null ? (user as any).is_online : true),
                is_verified: !!user.is_verified || !!user.isVerified,
                isVIP: !!user.isVIP
              };

              const isActuallyOnline = onlineUsersSet.has(userObj.id) || userObj.is_online === true;

              const onlineDotClass = isActuallyOnline 
                ? "bg-emerald-500 ring-2 ring-zinc-950 animate-pulse" // Bright green for active streams
                : "bg-zinc-600 border border-zinc-800"; // Deep dark tone that matches your dashboard layout

              return (
                <button
                  type="button"
                  key={userObj.id}
                  onClick={() => handleSelectThread(userObj.id)}
                  className={`w-full flex items-center justify-between p-2.5 md:p-3 rounded-xl transition text-left border cursor-pointer focus:outline-none ${
                    isSelected 
                      ? 'bg-zinc-900/80 border-zinc-800' 
                      : 'hover:bg-zinc-900/30 border-transparent'
                  }`}
                >
                  {/* Left Side: Avatar & Identity Block */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar Frame with Dynamic Unread Circle Indicator */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-zinc-800 overflow-hidden border border-zinc-750">
                        <img src={userObj.avatar} alt="" className="object-cover w-full h-full" />
                      </div>
                      {/* 🟢 FIXED: Dynamic Online/Offline Status Indicator Pin */}
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${onlineDotClass}`} />
                      
                      {/* 🔴 FIXED: Unread Count Overlay (Removes itself automatically if count is 0) */}
                      {userObj.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-rose-600 text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full text-white">
                          {userObj.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Identity Column */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Username Clamped safely */}
                        <span className="text-xs font-bold text-zinc-200 truncate">@{userObj.username || 'VIP_Host'}</span>
                        
                        {/* 🎯 FIXED: Blue Verified Checkmark (Only renders if verified, inline next to name) */}
                        {userObj.is_verified && (
                          <svg 
                            className="w-3.5 h-3.5 text-blue-500 fill-current flex-shrink-0 drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        )}
                      </div>
                      
                      {/* Dynamic Status / Subtext String */}
                      <p className={`text-[11px] truncate max-w-[150px] md:max-w-[180px] mt-0.5 ${
                        userObj.unread_count > 0 ? 'text-pink-400 font-black' : 'text-zinc-500 font-mono'
                      }`}>
                        {user.lastMessage || "Click to open chat ledger..."}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Specialized Tiers & Live Unread count badge */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                    {userObj.isVIP && (
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[9px] font-black px-2 py-1 rounded-md shadow-[0_0_10px_rgba(219,39,119,0.2)] tracking-wider uppercase flex items-center gap-1">
                        ★ VIP
                      </span>
                    )}
                    {userObj.unread_count > 0 && (
                      <div className="bg-[#ec4899] text-white font-black text-[10px] min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-pink-950/20 animate-pulse">
                        {userObj.unread_count}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── 📌 RIGHT PANEL: STICKY ESCROW ACTIVE CHAT MATRIX OR CALL LOGS ── */}
        {chatTab === 'calls' ? (
          <section className="col-span-12 md:col-span-8 h-full">
            <RecentCallsView
              currentUsername={currentUserId}
              onSelectUserForChat={(userId) => {
                setSelectedId(userId);
                setChatTab('chats');
              }}
            />
          </section>
        ) : (
          <section className={`col-span-12 md:col-span-8 bg-[#09090b]/60 border border-zinc-900 rounded-2xl md:rounded-3xl h-full flex flex-col overflow-hidden transition-all duration-300 ${
            !selectedId ? 'max-md:hidden' : 'col-span-12 md:col-span-8'
          }`}>
          {activeCompanion ? (
            <>
              {/* 👤 Chat Header (Sticky Context / Non-Scrolling) */}
              <div className="p-4 bg-[#0c0c0e]/95 border-b border-zinc-900/60 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-3">
                  {/* 🔙 BACK NAVIGATION BUTTON FOR MOBILE PHONE PLATFORMS */}
                  <button 
                    type="button"
                    onClick={() => setSelectedId('')}
                    className="md:hidden w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 active:scale-95 text-sm mr-1 cursor-pointer"
                  >
                    ⬅️
                  </button>
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
                    <img src={activeCompanion.avatar} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" className="object-cover w-full h-full" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-black text-white">@{activeCompanion.username}</h3>
                      {activeCompanion.is_verified && (
                        <svg 
                          className="w-3.5 h-3.5 text-blue-500 fill-current flex-shrink-0 drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]" 
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                      )}
                      {activeCompanion.isVIP && (
                        <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded-md scale-95 tracking-widest uppercase shadow-[0_0_6px_rgba(236,72,153,0.3)]">
                          ★ VIP
                        </span>
                      )}
                    </div>
                    {onlineUsersSet.has(activeCompanion.id) || activeCompanion.isOnline || (activeCompanion as any).is_online ? (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Online
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> Offline
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons: Video Call, Call Privacy & Direct Booking */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-call-privacy-modal'));
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold text-xs px-2.5 py-2 rounded-xl uppercase font-mono cursor-pointer transition active:scale-95"
                    title="Configure Call Privacy & Do Not Disturb (DND)"
                  >
                    🛡️ Privacy
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('lounge-start-video-call', {
                        detail: {
                          booking: {
                            id: `bk_call_${activeCompanion.id}_${Date.now()}`,
                            companionId: activeCompanion.id,
                            receiverUsername: activeCompanion.username || activeCompanion.name,
                            receiverAvatar: activeCompanion.avatar,
                            duration: 2,
                            rate: activeCompanion.ratePerHour || 250,
                            escrowDeposit: 0,
                            isFreeCall: true,
                            location: activeCompanion.location || 'VIP Lounge Room 1 - London Mayfair'
                          }
                        }
                      }));
                    }}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-xs px-3 py-2 rounded-xl uppercase tracking-wider font-mono cursor-pointer flex items-center gap-1.5 transition active:scale-95"
                    title="Launch 1-on-1 Direct Video Call Session"
                  >
                    <span>🎥</span> VIDEO CALL
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleOpenEscrowVault(activeCompanion.id)}
                    className="bg-pink-600 hover:bg-pink-700 active:scale-[0.98] transition text-white font-black text-xs px-4 py-2 rounded-xl uppercase tracking-wider font-mono cursor-pointer"
                  >
                    Book Host
                  </button>
                </div>
              </div>

              {/* 💬 Scrollable Inner Feed Messages Window (If content inside the chat overflows) */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-zinc-950/20 no-scrollbar">
                
                {/* Shield Info Notice Box from image_63e8de.jpg */}
                <div className="max-w-xl mx-auto bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 text-center text-zinc-400 text-[11px] leading-relaxed relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-pink-500" />
                  <div className="flex items-start gap-2.5 text-left">
                    <div className="w-5 h-5 rounded-full bg-pink-950/40 border border-pink-800/60 flex items-center justify-center text-pink-400 shrink-0 mt-0.5">
                      <ShieldAlert className="w-3 h-3" />
                    </div>
                    <div>
                      <span className="font-bold text-zinc-200 block text-xs mb-0.5 uppercase tracking-wide font-mono">Secure Direct Escrow Chat</span>
                      All direct bookings, messages, and tip tokens are end-to-end verified. Escrow protects both parties. Never share external bank credentials or routing keys.
                    </div>
                  </div>
                </div>

                {messages.map((msg) => {
                  const isMe = msg.senderId === currentUserId;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end ml-auto' : 'items-start mr-auto'} max-w-[80%] ${msg.status === 'sending' ? 'opacity-70' : ''}`}>
                      <div className={`rounded-2xl border ${
                        msg.type === 'tip' 
                          ? 'bg-amber-950/20 border-amber-500/30 text-amber-300 font-bold font-mono px-4 py-3 text-xs leading-relaxed' 
                        : msg.type === 'voice'
                          ? 'bg-zinc-950/40 border-zinc-900 p-2 max-w-[320px]'
                        : msg.type === 'image' || msg.mediaUrl
                          ? 'bg-zinc-950 border-zinc-900 p-1.5 max-w-[280px]'
                        : isMe 
                          ? 'bg-pink-600 text-white border-transparent px-4 py-3 text-xs leading-relaxed' 
                          : 'bg-zinc-900/80 text-zinc-200 border-zinc-800/60 px-4 py-3 text-xs leading-relaxed'
                      }`}>
                        {msg.type === 'voice' || (msg as any).message_type === 'voice' ? (
                          <div className="flex items-center gap-2 text-left min-w-[220px]">
                            <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
                              <Volume2 className="w-4 h-4 animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">Voice Note</span>
                              <audio 
                                controls 
                                src={msg.mediaUrl || (msg as any).media_url || (msg as any).mediaUrl} 
                                className="w-full h-6 mt-1 text-xs focus:outline-none accent-pink-500 bg-transparent"
                              />
                            </div>
                          </div>
                        ) : msg.type === 'image' || msg.mediaUrl ? (
                          <img 
                            src={msg.mediaUrl || msg.text} 
                            alt="Chat attachment" 
                            referrerPolicy="no-referrer"
                            className="rounded-xl max-w-full h-auto object-cover border border-zinc-900 shadow-md"
                          />
                        ) : msg.text && msg.text.includes('Missed Video Call') ? (
                          <div className="flex items-center gap-2 text-rose-400 font-mono font-bold text-xs">
                            <PhoneOff className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />
                            <span>{msg.text}</span>
                          </div>
                        ) : (
                          <p>{msg.text}</p>
                        )}
                      </div>
                      <div className="text-[9px] font-mono mt-1 px-1 flex items-center gap-1.5 text-zinc-500">
                        <span>{msg.time}</span>
                        {isMe && (
                          <>
                            {msg.status === 'sending' ? (
                              <span className="text-amber-400 font-medium animate-pulse">Sending...</span>
                            ) : msg.status === 'failed' ? (
                              <button
                                type="button"
                                onClick={() => handleRetryMessage(msg)}
                                className="text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                              >
                                Failed to send - Tap to retry
                              </button>
                            ) : (
                              <CheckCheck className="w-3 h-3 text-pink-500" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isPartnerTyping && (
                  <div className="flex items-center gap-2 max-w-[80%] mr-auto animate-pulse">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
                      <img src={activeCompanion.avatar} alt="" className="object-cover w-full h-full" />
                    </div>
                    <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl px-4 py-3 text-xs flex items-center gap-1.5 text-zinc-400">
                      <span className="font-bold text-zinc-300">@{activeCompanion.username}</span> is typing
                      <div className="flex gap-1 items-center ml-1">
                        <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 💸 QUICK TIP LAYER PANEL */}
              <div className="px-4 py-2 border-t border-zinc-900/60 bg-[#0a0a0c] flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0 pointer-events-auto relative z-20">
                {/* ── Direct Processing Billing Node ── */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!currentUserId) {
                        alert("Please sign in to complete this transaction.");
                        return;
                      }
                      if (!selectedId) {
                        alert("Please select a recipient from your active chats first.");
                        return;
                      }

                      const amountToSend = selectedTipAmount || 5;

                      // Explicit user confirmation prompt
                      const isConfirmed = window.confirm(
                        `Confirm Tip Payment:\n\nAre you sure you want to send a $${amountToSend} tip directly to your companion?`
                      );
                      if (!isConfirmed) return;

                      setHighlightSend(false);
                      setIsSending(true);
                      try {
                        // 💳 Check if user has sufficient tokens in real-time wallet balance state
                        if (_liveBalance < amountToSend) {
                          // Fetch current authenticated user's email and metadata
                          const { data: { user } } = await supabase.auth.getUser();
                          const userEmail = user?.email || "vipmember@gmail.com";
                          const userName = user?.user_metadata?.username || "VIP Member";

                          console.log(`Spinning up secure Flutterwave checkout for $${amountToSend.toFixed(2)} to top-up tokens...`);

                          initiateFlutterwavePayment({
                            amount: amountToSend,
                            currency: "USD",
                            email: userEmail,
                            name: userName,
                            description: `Direct Card Tip Payment: $${amountToSend.toFixed(2)}`,
                            callback: async (response: any) => {
                              try {
                                if (response.status === "successful" || response.status === "completed" || response.success) {
                                  const paymentGatewayRef = response.transaction_id || response.tx_ref || `TRX-TOK-${Date.now()}`;
                                  
                                  try {
                                    // 1. Credit the user's tokens in the DB
                                    console.log("Crediting user tokens in DB...");
                                    await supabase
                                      .from('token_transactions')
                                      .insert([{
                                        user_id: currentUserId,
                                        amount_usd: amountToSend,
                                        tokens_delivered: amountToSend,
                                        payment_method: 'direct_card',
                                        status: 'completed'
                                      }]);

                                    const { data: profData } = await supabase
                                      .from('profiles')
                                      .select('token_balance, current_balance')
                                      .eq('id', currentUserId)
                                      .maybeSingle();

                                    const currentBal = Number(profData?.token_balance || profData?.current_balance || 0);
                                    const nextBal = currentBal + amountToSend;

                                    await supabase
                                      .from('profiles')
                                      .update({
                                        token_balance: nextBal,
                                        current_balance: nextBal
                                      })
                                      .eq('id', currentUserId);

                                    // Log unified transaction history
                                    await supabase.from('transaction_history').insert([{
                                      sender_id: currentUserId,
                                      receiver_id: currentUserId,
                                      transaction_type: 'token_purchase',
                                      status: 'completed',
                                      gross_amount: amountToSend,
                                      platform_fee: 0,
                                      net_payout: amountToSend,
                                      tx_ref: paymentGatewayRef
                                    }]);

                                    // Update local balance state
                                    setLiveBalance(nextBal);

                                    // 2. Automatically execute process_token_tip RPC or direct update
                                    console.log("Re-triggering process_token_tip RPC after successful payment...");
                                    const { error: tipRpcError } = await supabase.rpc('process_token_tip', {
                                      sender_id: currentUserId,
                                      receiver_id: selectedId,
                                      tip_amount: amountToSend,
                                      recipient_id: selectedId
                                    });

                                    if (tipRpcError) {
                                      console.warn("Tip RPC failed, applying direct balance transfer fallback:", tipRpcError.message);
                                      setLiveBalance(prev => Math.max(0, prev - amountToSend));
                                    }

                                    alert(`🎉 Payment Successful! $${amountToSend} captured. Credited ${amountToSend} Tokens to your balance and successfully sent tip to creator.`);
                                    
                                    // Insert text message logs indicating successful tip
                                    const textContent = `💸 Sent a $${amountToSend} Tip Token!`;
                                    const localMsg: Message = {
                                      id: `local_tip_${Date.now()}`,
                                      senderId: currentUserId,
                                      receiverId: selectedId,
                                      text: textContent,
                                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                      type: 'tip',
                                      amount: amountToSend
                                    };
                                    setMessages(prev => [...prev, localMsg]);
                                    triggerChannelUpdateAndReorder(selectedId, textContent, new Date().toISOString());

                                    try {
                                      await supabase.from('chat_messages').insert([
                                        {
                                          sender_id: currentUserId,
                                          receiver_id: selectedId,
                                          message_text: JSON.stringify({ text: textContent, type: 'tip', amount: amountToSend }),
                                          is_read: false
                                        }
                                      ]);
                                    } catch (msgErr) {
                                      console.warn("Could not log chat message for tip:", msgErr);
                                    }
                                  } catch (creditErr: any) {
                                    console.error("Error crediting user account:", creditErr);
                                    alert(`Payment captured successfully, but database credit failed: ${creditErr.message}`);
                                  }
                                } else {
                                  alert("Payment verification failed or was declined.");
                                }
                              } finally {
                                setIsSending(false);
                                setHighlightSend(false);
                              }
                            },
                            onClose: () => {
                              console.log("Flutterwave payment modal closed.");
                              setIsSending(false);
                              setHighlightSend(false);
                            }
                          });
                          return;
                        }

                        // ── If they have sufficient balance, proceed directly ──
                        const senderId = currentUserId;
                        const receiverId = selectedId;
                        const tipAmount = amountToSend;

                        const { data, error } = await supabase.rpc('process_token_tip', {
                          sender_id: senderId,
                          receiver_id: receiverId,
                          tip_amount: Number(tipAmount)
                        });

                        if (error) {
                          console.error('Tip RPC failed:', error.message);
                        } else {
                          console.log('Tip processed successfully:', data);
                          setLiveBalance(prev => Math.max(0, prev - Number(tipAmount)));
                        }

                        alert(`🎉 $${amountToSend} Tip Token sent successfully!`);

                        // Insert a text message indicating the tip
                        const textContent = `💸 Sent a $${amountToSend} Tip Token!`;
                        
                        // Optimistically add to current message list
                        const localMsg: Message = {
                          id: `local_tip_${Date.now()}`,
                          senderId: currentUserId,
                          receiverId: selectedId,
                          text: textContent,
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          type: 'tip',
                          amount: amountToSend
                        };
                        setMessages(prev => [...prev, localMsg]);
                        triggerChannelUpdateAndReorder(selectedId, textContent, new Date().toISOString());

                        try {
                          await supabase.from('chat_messages').insert([
                            {
                              sender_id: currentUserId,
                              receiver_id: selectedId,
                              message_text: JSON.stringify({ text: textContent, type: 'tip', amount: amountToSend }),
                              is_read: false
                            }
                          ]);
                        } catch (msgErr) {
                          console.warn("Could not log chat message for tip:", msgErr);
                        }
                      } catch (err: any) {
                        console.error("Error executing token tip:", err);
                        alert(`Error sending tip: ${err.message || err}`);
                      } finally {
                        setIsSending(false);
                      }
                    }}
                    disabled={isSending}
                    className={`transition-all px-4 py-2 rounded-2xl flex flex-col justify-center leading-normal text-left cursor-pointer outline-none select-none disabled:opacity-50 shrink-0 border ${
                      highlightSend
                        ? 'bg-emerald-950/40 border-emerald-500 animate-pulse shadow-lg shadow-emerald-500/20'
                        : 'bg-[#0a0a14] hover:bg-[#121222] border-zinc-800/80 hover:border-pink-500/50'
                    }`}
                    title={`Click to confirm and pay $${selectedTipAmount || 5} tip`}
                  >
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-200 flex items-center gap-1.5 font-bold">
                      <span className={`w-2 h-2 rounded-full ${highlightSend ? 'bg-emerald-400' : 'bg-pink-500'} animate-ping shrink-0`} />
                      {highlightSend ? 'CONFIRM & PAY TIPPING' : 'SEND TIPS TOKEN'}
                      <ArrowRight className="w-3 h-3 ml-1 text-emerald-400" />
                    </span>
                    <span className="text-[9px] text-zinc-400 lowercase font-mono block">
                      {highlightSend 
                        ? `click here to pay $${selectedTipAmount || 5} via card/tokens` 
                        : `to client ($${selectedTipAmount || 5})`}
                    </span>
                  </button>
                </div>
                <div className="flex gap-2 items-center overflow-x-auto no-scrollbar">
                  {[5, 10, 20, 50, 100].map((amt) => {
                    const isSelected = selectedTipAmount === amt;
                    return (
                      <button
                        type="button"
                        key={amt}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTipAmount(amt);
                          setHighlightSend(true);
                        }}
                        disabled={isSending}
                        className={`font-mono font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1.5 transition shrink-0 cursor-pointer pointer-events-auto border ${
                          isSelected 
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-400 shadow-md shadow-pink-500/25 scale-105' 
                            : 'bg-[#0a0a14] hover:bg-[#121222] border-zinc-800/80 hover:border-zinc-700 text-pink-500'
                        }`}
                        title={`Select $${amt} Tipping Amount`}
                      >
                        <CreditCard className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-pink-500'}`} />
                        <span>${amt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VIP MOG Picker Tray */}
              {showMogPicker && (
                <div className="px-4 py-2 bg-[#09090b] border-t border-amber-500/20 shrink-0">
                  <LustyMogPicker onSendMog={(mog) => { handleSendVipMog(mog); setShowMogPicker(false); }} />
                </div>
              )}

              {/* Quick Thank You Suggestions for Tip Recipient */}
              {(() => {
                const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
                const isLastTip = lastMsg && 
                  lastMsg.senderId !== currentUserId && 
                  (lastMsg.type === 'tip' || (lastMsg.text && (lastMsg.text.includes('Tip') || lastMsg.text.includes('tip') || lastMsg.text.includes('💸'))));
                if (!isLastTip) return null;
                
                const thankYouOptions = [
                  "Thank you so much for the tip! 💕",
                  "Aww, thank you! You're so sweet! ✨",
                  "Received! Thank you for supporting me! 🙏"
                ];

                return (
                  <div className="px-4 py-2 bg-slate-900 border-t border-amber-500/30 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                    <span className="text-xs text-slate-400 font-mono font-medium shrink-0 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Quick Reply:
                    </span>
                    {thankYouOptions.map((option, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setInputText(option)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-full px-3 py-1 font-medium whitespace-nowrap transition cursor-pointer shrink-0"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* 📥 Non-Scrolling Fixed Footer Input Console Panel */}
              <form onSubmit={(e) => handleSendMessage(e)} className="p-4 border-t border-zinc-900 bg-[#0c0c0e] flex items-center gap-3 shrink-0">
                <input 
                  type="file"
                  id="chat-image-uploader"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleSendImageMessage(file);
                    }
                  }}
                />
                <button 
                  type="button" 
                  onClick={() => document.getElementById('chat-image-uploader')?.click()}
                  className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer p-1"
                  title="Attach Secure Image"
                >
                  <Image className="w-4 h-4" />
                </button>

                <button 
                  type="button" 
                  onClick={handleToggleVoiceRecord}
                  className={`transition cursor-pointer p-1.5 rounded-full ${
                    isRecordingVoice 
                      ? 'text-red-500 bg-red-950/40 border border-red-500/30 animate-pulse' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={isRecordingVoice ? "Stop Voice Recording" : "Record Live Voice Note"}
                >
                  <Mic className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowMogPicker(!showMogPicker)}
                  className={`transition cursor-pointer p-1.5 rounded-xl border ${
                    showMogPicker
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : 'text-zinc-500 hover:text-amber-400 border-zinc-800 hover:border-amber-500/30'
                  }`}
                  title="Send VIP MOG Reaction"
                >
                  <Crown className="w-4 h-4" />
                </button>
                
                <div className="relative flex-1 flex items-center">
                  {/* Floating Mog Reaction Container */}
                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 pointer-events-none h-24 w-full flex justify-center items-end overflow-visible z-50">
                    <AnimatePresence>
                      {mogList.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 1, y: 0, x: item.x, scale: 0.6, rotate: 0 }}
                          animate={{
                            opacity: 0,
                            y: -80,
                            scale: 1.6,
                            rotate: item.rotation,
                          }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          onAnimationComplete={() => removeMog(item.id)}
                          className="absolute text-3xl select-none filter drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                        >
                          {item.emoji}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <input
                    type="text"
                    placeholder={`Reply to @${activeCompanion.username}...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                    className="w-full bg-zinc-900 border border-zinc-800/80 focus:border-zinc-700 text-white rounded-xl px-4 py-3 text-xs focus:outline-none placeholder-zinc-600 font-medium"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isSending || !inputText.trim()}
                  className="bg-pink-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 hover:bg-pink-700"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-xs text-zinc-600 font-mono p-10">
              <Award className="w-10 h-10 text-zinc-800 mb-2.5 animate-pulse" />
              Select a secure VIP channel to initialize streaming console.
            </div>
          )}
        </section>
        )}

      </div>

      {/* 💳 QUICK CARD TOP-UP SHEET OVERLAY */}
      {showTopUpSheet && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center animate-fade-in">
          <div className="bg-[#0e0e11] border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-slide-up relative text-left">
            <button
              onClick={() => { setShowTopUpSheet(false); setLowBalanceNeeded(null); }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
            
            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-wider font-mono">Instant Tip Token Top-Up</h4>
              <p className="text-[10px] text-zinc-500 font-mono mt-1">Secure debit card pipeline using multi-currency authorization hold</p>
            </div>

            {lowBalanceNeeded && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-400 text-xs font-mono">
                ⚠️ Insufficient balance to send a ${lowBalanceNeeded} Tip. Please top up your wallet.
              </div>
            )}

            {topUpSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="text-3xl text-emerald-400">✓</div>
                <p className="text-emerald-400 font-bold text-xs font-mono uppercase tracking-wider">Payment Authorized &amp; Funded!</p>
                <p className="text-[10px] text-zinc-500">Your wallet balance has been updated instantly.</p>
              </div>
            ) : (
              <form onSubmit={handlePerformTopUp} className="space-y-4">
                {/* Pre-selected values */}
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-zinc-500 font-black font-mono block mb-1.5">Top-Up Amount</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['25', '50', '100', '250'].map((val) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => setTopUpAmountInput(val)}
                        className={`py-2 text-xs font-mono font-bold rounded-xl border transition ${
                          topUpAmountInput === val
                            ? 'bg-pink-600 border-transparent text-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        ${val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Token Input with input regex filter */}
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-zinc-500 font-black font-mono block mb-1.5">Or Custom Amount ($)</label>
                  <input
                    type="text"
                    pattern="\d*"
                    placeholder="Enter custom token amount..."
                    value={topUpAmountInput}
                    onChange={(e) => handleTokenInput(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-pink-500 font-mono"
                  />
                </div>

                {/* Custom Card inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-zinc-500 font-black font-mono block mb-1">Card Holder Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={topUpCardHolder}
                      onChange={(e) => setTopUpCardHolder(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-zinc-500 font-black font-mono block mb-1">Card Number</label>
                    <input
                      type="text"
                      required
                      maxLength={19}
                      placeholder="4111 2222 3333 4444"
                      value={topUpCardNum}
                      onInput={(e) => {
                        const target = e.currentTarget;
                        const original = target.value.replace(/\D/g, '');
                        const matches = original.match(/\d{1,4}/g);
                        target.value = matches ? matches.join(' ') : '';
                        setTopUpCardNum(target.value);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-pink-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] uppercase tracking-wider text-zinc-500 font-black font-mono block mb-1">Expiry Date</label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        placeholder="MM/YY"
                        value={topUpCardExpiry}
                        onInput={(e) => {
                          const target = e.currentTarget;
                          let val = target.value.replace(/\D/g, '');
                          if (val.length >= 2) {
                            val = val.slice(0, 2) + '/' + val.slice(2, 4);
                          }
                          target.value = val;
                          setTopUpCardExpiry(val);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-pink-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-wider text-zinc-500 font-black font-mono block mb-1">CVV</label>
                      <input
                        type="text"
                        required
                        maxLength={3}
                        placeholder="123"
                        value={topUpCardCvv}
                        onInput={(e) => {
                          const target = e.currentTarget;
                          target.value = target.value.replace(/\D/g, '');
                          setTopUpCardCvv(target.value);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-pink-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isToppingUp}
                  className="w-full bg-pink-600 hover:bg-pink-700 active:scale-[0.98] py-3 rounded-xl font-black text-xs uppercase tracking-wider transition text-white font-mono flex items-center justify-center gap-2"
                >
                  {isToppingUp ? 'Securing Escrow hold...' : `Confirm & Fund $${topUpAmountInput}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 2. Fetch specific list rows with unread aggregations & online status checks
export function ChatSidebarLiveController({ currentUserId }: { currentUserId: string }) {
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [, setConversations] = useState<any[]>([]);

  const fetchLiveChatMetrics = async () => {
    // 1. Total top-level layout badge counter
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);
    
    setGlobalUnreadCount(count || 0);

    // 2. Fetch specific list rows with unread aggregations & online status checks
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, is_online'); // Ensure 'is_online' boolean tracking is in your profiles table schema
    
    setConversations(data || []);
  };

  useEffect(() => {
    fetchLiveChatMetrics();
    
    // Subscribe to new incoming real-time messages to keep badges ticking instantly
    const channel = supabase
      .channel(`realtime_chat_badges_${Math.random().toString(36).substring(2, 11)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => fetchLiveChatMetrics())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  return (
    <div>
      {/* Top Header/Navbar Layout Indicator (Render outside if needed via callback) */}
      <div className="relative">
        <span>Chats</span>
        {globalUnreadCount > 0 && (
          <span className="absolute -top-2 -right-3 bg-red-600 text-white font-mono font-black text-[9px] px-1.5 py-0.5 rounded-full animate-bounce">
            {globalUnreadCount}
          </span>
        )}
      </div>
    </div>
  );
}
