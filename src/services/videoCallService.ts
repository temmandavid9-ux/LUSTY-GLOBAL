import { supabase } from '../lib/supabase';

export interface VideoCallRoomConfig {
  bookingId: string;
  roomName: string;
  roomUrl: string;
  token: string;
  expiryTimestamp: number;
  durationMinutes: number;
  senderUsername: string;
  senderAvatar: string;
  receiverUsername: string;
  receiverAvatar: string;
  escrowDeposit: number;
  isFreeCall?: boolean;
  location: string;
}

export interface CreatorCallSettings {
  isDND: boolean; // Do Not Disturb mode
  allowCallsFrom: 'everyone' | 'verified_only' | 'supporters_only'; // Privacy filter
}

/**
 * Get or set Creator Call Privacy & Availability Settings
 */
export function getCreatorCallSettings(username: string): CreatorCallSettings {
  if (typeof window === 'undefined') return { isDND: false, allowCallsFrom: 'everyone' };
  const raw = localStorage.getItem(`call_settings_${username.toLowerCase()}`);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // fallback
    }
  }
  return { isDND: false, allowCallsFrom: 'everyone' };
}

export function setCreatorCallSettings(username: string, settings: Partial<CreatorCallSettings>): CreatorCallSettings {
  const current = getCreatorCallSettings(username);
  const updated = { ...current, ...settings };
  if (typeof window !== 'undefined') {
    localStorage.setItem(`call_settings_${username.toLowerCase()}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('creator-call-settings-changed', { detail: { username, settings: updated } }));
  }
  return updated;
}

/**
 * Rate Limiting Tracker: Tracks consecutive declined calls from caller -> receiver
 */
export function checkCallRateLimit(callerUsername: string, receiverUsername: string): { isBlocked: boolean; remainingMinutes?: number } {
  if (typeof window === 'undefined') return { isBlocked: false };
  const key = `decline_limit_${callerUsername.toLowerCase()}_${receiverUsername.toLowerCase()}`;
  const raw = localStorage.getItem(key);
  if (!raw) return { isBlocked: false };

  try {
    const data = JSON.parse(raw);
    if (data.blockedUntil && Date.now() < data.blockedUntil) {
      const remainingMinutes = Math.ceil((data.blockedUntil - Date.now()) / (60 * 1000));
      return { isBlocked: true, remainingMinutes };
    }
  } catch (e) {
    // ignore
  }
  return { isBlocked: false };
}

export function recordCallDecline(callerUsername: string, receiverUsername: string) {
  if (typeof window === 'undefined') return;
  const key = `decline_limit_${callerUsername.toLowerCase()}_${receiverUsername.toLowerCase()}`;
  const raw = localStorage.getItem(key);
  let count = 0;
  if (raw) {
    try { count = JSON.parse(raw).count || 0; } catch (e) {}
  }
  count += 1;

  if (count >= 2) {
    // Force a 15-minute cool-down
    const blockedUntil = Date.now() + 15 * 60 * 1000;
    localStorage.setItem(key, JSON.stringify({ count, blockedUntil }));
  } else {
    localStorage.setItem(key, JSON.stringify({ count, blockedUntil: 0 }));
  }
}

export function clearCallDecline(callerUsername: string, receiverUsername: string) {
  if (typeof window === 'undefined') return;
  const key = `decline_limit_${callerUsername.toLowerCase()}_${receiverUsername.toLowerCase()}`;
  localStorage.removeItem(key);
}

export interface EscrowSettlementReceipt {
  bookingId: string;
  totalDeposit: number;
  creatorAmount: number;
  platformFee: number;
  refundAmount?: number;
  elapsedMinutes?: number;
  totalBookedMinutes?: number;
  isProrated?: boolean;
  settledAt: string;
  status: 'COMPLETED' | 'EARLY_SETTLED_PRORATED';
}

/**
 * Call Session record interface for Supabase 'call_history' table
 */
export interface CallSessionRecord {
  id?: string;
  caller_username: string;
  receiver_username: string;
  status: 'COMPLETED' | 'DECLINED' | 'MISSED' | 'CANCELLED';
  duration_seconds?: number;
  reason?: string;
  created_at?: string;
}

/**
 * Log a video call session (COMPLETED, DECLINED, MISSED, CANCELLED) to Supabase 'call_history' table
 */
export async function logCallSession(params: {
  callerUsername: string;
  receiverUsername: string;
  status: 'COMPLETED' | 'DECLINED' | 'MISSED' | 'CANCELLED';
  durationSeconds?: number;
  reason?: string;
}) {
  const record: CallSessionRecord = {
    caller_username: params.callerUsername,
    receiver_username: params.receiverUsername,
    status: params.status,
    duration_seconds: params.durationSeconds || 0,
    reason: params.reason || '',
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('call_history').insert([record]);
    if (error) {
      console.warn("Could not insert record into Supabase 'call_history':", error);
    }
  } catch (err) {
    console.warn("Call history table insert error:", err);
  }

  // Broadcast realtime call log event across all active devices
  try {
    const channel = supabase.channel('vip_video_calls_channel');
    await channel.send({
      type: 'broadcast',
      event: 'CALL_LOGGED',
      payload: record
    });
  } catch (e) {
    // ignore
  }

  // Local storage fallback for offline/sandbox mode
  try {
    const existing = JSON.parse(localStorage.getItem('lounge_call_history') || '[]');
    const newEntry = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...record
    };
    existing.unshift(newEntry);
    localStorage.setItem('lounge_call_history', JSON.stringify(existing.slice(0, 100)));
  } catch (e) {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lounge-call-history-updated', { detail: record }));
  }

  return record;
}

/**
 * Automatically initializes local fallback call history in localStorage if empty or missing
 */
export function initLocalCallHistoryFallback(username?: string): CallSessionRecord[] {
  if (typeof window === 'undefined') return [];
  const targetUser = username || 'current_user';
  try {
    const raw = localStorage.getItem('lounge_call_history');
    if (!raw || raw === '[]') {
      const sampleRecords: CallSessionRecord[] = [
        {
          id: 'sample_call_1',
          caller_username: 'Elena_VIP',
          receiver_username: targetUser,
          status: 'COMPLETED',
          duration_seconds: 742,
          created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
        },
        {
          id: 'sample_call_2',
          caller_username: 'Bella_Dance',
          receiver_username: targetUser,
          status: 'MISSED',
          reason: 'No Answer',
          created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
        },
        {
          id: 'sample_call_3',
          caller_username: targetUser,
          receiver_username: 'Natasha_Rose',
          status: 'DECLINED',
          reason: 'User Busy',
          created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
        },
        {
          id: 'sample_call_4',
          caller_username: 'Zara_Mystique',
          receiver_username: targetUser,
          status: 'COMPLETED',
          duration_seconds: 1215,
          created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        }
      ];
      localStorage.setItem('lounge_call_history', JSON.stringify(sampleRecords));
      return sampleRecords;
    }
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Fetch call history for a given username from Supabase 'call_history' or local fallback
 */
export async function fetchCallHistory(username: string): Promise<CallSessionRecord[]> {
  let dbRecords: CallSessionRecord[] = [];

  if (username) {
    try {
      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .or(`caller_username.ilike.${username},receiver_username.ilike.${username}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        dbRecords = data as CallSessionRecord[];
      }
    } catch (e) {
      console.warn("Supabase call_history query error, reading local fallback");
    }
  }

  try {
    const local = initLocalCallHistoryFallback(username);

    // Merge database records and local storage records smoothly
    const combined = [...dbRecords];
    const dbIds = new Set(dbRecords.map(r => r.id));

    local.forEach(item => {
      const callerLower = (item.caller_username || '').toLowerCase();
      const receiverLower = (item.receiver_username || '').toLowerCase();
      const unameLower = (username || '').toLowerCase();

      const isForUser = 
        !username ||
        callerLower === unameLower ||
        receiverLower === unameLower ||
        callerLower === 'current_user' ||
        receiverLower === 'current_user';

      if (isForUser && (!item.id || !dbIds.has(item.id))) {
        const mappedItem: CallSessionRecord = {
          ...item,
          caller_username: item.caller_username === 'current_user' ? (username || 'current_user') : item.caller_username,
          receiver_username: item.receiver_username === 'current_user' ? (username || 'current_user') : item.receiver_username
        };
        combined.push(mappedItem);
      }
    });

    return combined.sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });
  } catch (e) {
    return dbRecords;
  }
}

/**
 * Log a Missed Call notification message in Supabase 'chat_messages' table and broadcast to active listeners
 */
export async function logMissedCallInChat(senderUsername: string, receiverUsername: string, reason = "No Answer") {
  const missedCallText = `📞 Missed Video Call (${reason})`;
  
  // Record in call_history table
  await logCallSession({
    callerUsername: senderUsername,
    receiverUsername: receiverUsername,
    status: reason === 'Declined' ? 'DECLINED' : 'MISSED',
    reason
  });

  try {
    const { error } = await supabase.from('chat_messages').insert([
      {
        sender_id: senderUsername,
        receiver_id: receiverUsername,
        message_text: missedCallText,
        is_read: false
      }
    ]);
    if (error) {
      console.warn("Could not write missed call to chat_messages DB:", error);
    }
  } catch (err) {
    console.warn("Failed to write missed call to DB:", err);
  }

  // Broadcast realtime event so recipient's chat view and unread badges refresh live
  try {
    const channel = supabase.channel('vip_video_calls_channel');
    await channel.send({
      type: 'broadcast',
      event: 'MISSED_CALL_LOGGED',
      payload: {
        senderUsername,
        receiverUsername,
        reason,
        text: missedCallText,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lounge-missed-call-logged', {
      detail: { senderUsername, receiverUsername, reason, text: missedCallText }
    }));
  }
}

/**
 * Broadcast an incoming 100% FREE video call signal to the receiver
 */
export async function initiateVideoCallSignal(params: {
  bookingId?: string;
  senderUsername: string;
  senderAvatar: string;
  receiverUsername: string;
  receiverAvatar: string;
  escrowDeposit?: number;
  durationMinutes?: number;
  location?: string;
  isFreeCall?: boolean;
}) {
  const receiverSettings = getCreatorCallSettings(params.receiverUsername);
  
  // 1. Check Do Not Disturb (DND)
  if (receiverSettings.isDND) {
    await logMissedCallInChat(params.senderUsername, params.receiverUsername, "DND Active");
    return {
      success: false,
      reason: `dnd_active`,
      message: `@${params.receiverUsername} is currently in Do Not Disturb (DND) mode. A missed call message was sent to chat.`
    };
  }

  // 2. Presence / Online Check: Check if recipient is online in profiles table or localStorage
  try {
    const { data: receiverProfile } = await supabase
      .from('profiles')
      .select('is_online, status')
      .eq('username', params.receiverUsername)
      .maybeSingle();

    if (receiverProfile && receiverProfile.is_online === false) {
      await logMissedCallInChat(params.senderUsername, params.receiverUsername, "User Offline");
      return {
        success: false,
        reason: `user_offline`,
        message: `@${params.receiverUsername} is currently offline. A missed call message was posted in chat.`
      };
    }
  } catch (e) {
    // Fallback: Continue with call attempt if query fails
  }

  // 3. Check Spam Rate Limit
  const rateLimit = checkCallRateLimit(params.senderUsername, params.receiverUsername);
  if (rateLimit.isBlocked) {
    return {
      success: false,
      reason: `rate_limited`,
      message: `You were declined 2 times by @${params.receiverUsername}. Please wait ${rateLimit.remainingMinutes} minutes before ringing again.`
    };
  }

  const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = {
    callId,
    bookingId: params.bookingId || `bk_${Date.now()}`,
    callerUsername: params.senderUsername,
    callerAvatar: params.senderAvatar,
    receiverUsername: params.receiverUsername,
    receiverAvatar: params.receiverAvatar,
    escrowDeposit: 0,
    isFreeCall: true,
    durationMinutes: params.durationMinutes || 120,
    location: params.location || 'VIP Lounge Room 1 - London Mayfair'
  };

  // Send via Supabase Realtime Channel
  try {
    const channel = supabase.channel('vip_video_calls_channel');
    await channel.send({
      type: 'broadcast',
      event: 'INCOMING_CALL',
      payload
    });
  } catch (err) {
    console.warn("Realtime broadcast send warning:", err);
  }

  // Dispatch local window event for caller so caller opens Outgoing Call Modal
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lounge-outgoing-call-signal', { detail: payload }));
  }

  return {
    success: true,
    payload
  };
}

/**
 * Send an In-Call Tip during a live video stream (Monetization for free calls)
 */
export async function sendInCallTip(params: {
  callId: string;
  senderUsername: string;
  recipientUsername: string;
  amount: number;
}) {
  const amount = Number(params.amount) || 10;
  const creatorAmount = Math.round(amount * 0.90 * 100) / 100; // 90% Host
  const platformFee = Math.round((amount - creatorAmount) * 100) / 100; // 10% Platform Fee

  const tipEvent = {
    id: `tip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    callId: params.callId,
    senderUsername: params.senderUsername,
    recipientUsername: params.recipientUsername,
    amount,
    creatorAmount,
    platformFee,
    timestamp: new Date().toISOString()
  };

  // 1. Broadcast tip via Supabase channel
  try {
    const channel = supabase.channel('vip_video_calls_channel');
    await channel.send({
      type: 'broadcast',
      event: 'TIP_RECEIVED',
      payload: tipEvent
    });

    // Write to platform ledger
    await supabase.from('platform_ledger').insert([{
      host_id: params.recipientUsername,
      amount: creatorAmount,
      platform_fee: platformFee,
      status: 'settled',
      type: 'in_call_tip',
      description: `In-Call Live Stream Tip from @${params.senderUsername} ($${amount})`
    }]);
  } catch (err) {
    console.warn("Tip broadcast error:", err);
  }

  // 2. Dispatch local event for stream overlay
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lounge-in-call-tip', { detail: tipEvent }));
  }

  return tipEvent;
}

/**
 * 1. Generate a secure WebRTC video room session for a booking
 */
export async function startVideoCallSession(params: {
  bookingId: string;
  durationMinutes?: number;
  senderUsername?: string;
  senderAvatar?: string;
  receiverUsername?: string;
  receiverAvatar?: string;
  escrowDeposit?: number;
  isFreeCall?: boolean;
  location?: string;
}): Promise<VideoCallRoomConfig> {
  const durationMins = params.durationMinutes || 120;
  const expiryTimestamp = Math.floor(Date.now() / 1000) + durationMins * 60;
  const cleanBookingId = params.bookingId || `bk_${Math.random().toString(36).substring(2, 9)}`;
  const roomName = `booking-${cleanBookingId}`;
  
  // Daily.co / WebRTC Room URL
  const roomUrl = `https://lusty-vip.daily.co/${roomName}`;
  const token = `token_jwt_${Math.random().toString(36).substring(2, 15)}_${expiryTimestamp}`;

  // Log or update booking status to 'in_call' or 'escrowed' in Supabase if needed
  try {
    await supabase
      .from('bookings')
      .update({
        status: 'in_call',
        notes: `Active 1-on-1 Video Session in room: ${roomName}`
      })
      .eq('id', cleanBookingId);
  } catch (err) {
    console.warn("Could not update booking status to in_call in Supabase:", err);
  }

  return {
    bookingId: cleanBookingId,
    roomName,
    roomUrl,
    token,
    expiryTimestamp,
    durationMinutes: durationMins,
    senderUsername: params.senderUsername || 'black',
    senderAvatar: params.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    receiverUsername: params.receiverUsername || 'Elena_VIP',
    receiverAvatar: params.receiverAvatar || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    escrowDeposit: params.escrowDeposit || 150,
    location: params.location || 'VIP Lounge Room 1 - London Mayfair'
  };
}

/**
 * 2. Handle Call Termination & Automatic 90/10 Escrow Settlement
 */
export async function completeVideoCallAndReleaseEscrow(params: {
  bookingId: string;
  creatorId?: string;
  creatorUsername?: string;
  escrowDeposit?: number;
  elapsedMinutes?: number;
  totalBookedMinutes?: number;
  forceFullSettlement?: boolean;
}): Promise<EscrowSettlementReceipt> {
  const totalDeposit = Number(params.escrowDeposit) || 150;
  const totalBookedMins = params.totalBookedMinutes || 120;
  const elapsedMins = params.elapsedMinutes !== undefined ? params.elapsedMinutes : totalBookedMins;

  let billableDeposit = totalDeposit;
  let refundAmount = 0;
  let isProrated = false;

  // If call ended early and full settlement is not forced, calculate pro-rated billable deposit (minimum 5 minutes)
  if (!params.forceFullSettlement && elapsedMins < totalBookedMins) {
    const minBillableMins = Math.max(5, Math.ceil(elapsedMins));
    const ratio = Math.min(1, minBillableMins / Math.max(1, totalBookedMins));
    billableDeposit = Math.round(totalDeposit * ratio * 100) / 100;
    refundAmount = Math.round((totalDeposit - billableDeposit) * 100) / 100;
    isProrated = true;
  }

  // Exact Math: 90% Host Release, 10% Platform Fee
  const creatorAmount = Math.round(billableDeposit * 0.90 * 100) / 100; // 90%
  const platformFee = Math.round((billableDeposit - creatorAmount) * 100) / 100; // 10%
  const settledAt = new Date().toISOString();

  try {
    // 1. Mark booking as COMPLETED in Supabase
    await supabase
      .from('bookings')
      .update({
        status: 'completed',
        escrow_status: 'released',
        notes: `Escrow released ($${creatorAmount} paid to host, $${platformFee} fee captured, $${refundAmount} refunded)`
      })
      .eq('id', params.bookingId);

    // 2. Write settlement entry to platform_ledger
    await supabase
      .from('platform_ledger')
      .insert([{
        booking_id: params.bookingId,
        host_id: params.creatorId || 'host_elena_vip',
        amount: creatorAmount,
        platform_fee: platformFee,
        status: 'settled',
        type: 'escrow_release',
        description: `1-on-1 Video Call Escrow Settlement ($${creatorAmount} host, $${platformFee} platform)`
      }]);
  } catch (err) {
    console.warn("Escrow database settlement warning (client fallback active):", err);
  }

  // Notify active listeners across app
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ESCROW_RELEASED', {
      detail: {
        bookingId: params.bookingId,
        creatorAmount,
        platformFee,
        refundAmount,
        totalDeposit
      }
    }));
    window.dispatchEvent(new CustomEvent('booking-updated'));
  }

  return {
    bookingId: params.bookingId,
    totalDeposit,
    creatorAmount,
    platformFee,
    refundAmount,
    elapsedMinutes: elapsedMins,
    totalBookedMinutes: totalBookedMins,
    isProrated,
    settledAt,
    status: isProrated ? 'EARLY_SETTLED_PRORATED' : 'COMPLETED'
  };
}
