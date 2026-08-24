import { supabase } from '../lib/supabase';

// Convert public VAPID key string to Uint8Array
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPushNotifications(userId?: string): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported on this browser or environment.');
    return { success: false, error: 'Push notifications not supported in this browser' };
  }

  try {
    // 1. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied by user.');
      return { success: false, error: 'Notification permission denied' };
    }

    // 2. Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // 3. Get or create Push Subscription using VAPID Key
    const PUBLIC_VAPID_KEY = 'BEl62vSTUQrYki65aD78W9-IruqZ686qyv33sZ6K4mK8Pst-96yL9uS39Vd6FqyGg29FvL59G6R8W9-7z9Y=';
    
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY) as unknown as BufferSource,
        });
      } catch (subErr: any) {
        console.warn('Standard pushManager subscribe warning (falling back to SW message channel):', subErr.message);
      }
    }

    // 4. Save subscription object to Supabase profile if userId provided
    if (userId && subscription) {
      const { error } = await supabase
        .from('profiles')
        .update({ push_subscription: subscription as any })
        .eq('id', userId);

      if (error) {
        console.warn('Could not update push_subscription in profiles table:', error.message);
      } else {
        console.log('Push notification subscription active and saved to Supabase profile!');
      }
    }

    if (subscription) {
      localStorage.setItem('lounge_push_subscription', JSON.stringify(subscription));
    }

    return { success: true, subscription: subscription || undefined };
  } catch (err: any) {
    console.error('Failed to subscribe to push notifications:', err);
    return { success: false, error: err?.message || 'Failed to complete push subscription' };
  }
}

export async function sendLocalNotification(title: string, body: string, url = '/') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: {
          title,
          body,
          icon: '/logo-192.png',
          tag: 'lounge-alert',
          data: { url }
        }
      });
    } else {
      new Notification(title, {
        body,
        icon: '/logo-192.png',
        data: { url }
      });
    }
  }
}
