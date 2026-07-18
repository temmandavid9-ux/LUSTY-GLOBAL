import { useState, useEffect, useCallback } from 'react';

export interface PushNotificationHookResult {
  isSupported: boolean;
  permission: NotificationPermission;
  isRegistered: boolean;
  subscription: PushSubscription | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  sendLocalTestNotification: (title: string, body: string, delayMs?: number) => void;
}

export function usePushNotifications(): PushNotificationHookResult {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial capability checks
  useEffect(() => {
    const supported = 
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'Notification' in window;
    
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      
      // Check if service worker is already registered
      navigator.serviceWorker.getRegistration('/service-worker.js').then((reg) => {
        if (reg) {
          setIsRegistered(true);
          reg.pushManager.getSubscription().then((sub) => {
            setSubscription(sub);
          }).catch(err => {
            console.warn('[Push Hook] Failed to fetch existing push subscription:', err);
          });
        }
      });
    }
  }, []);

  // 2. Request permission and register service worker
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Service Workers and Notifications are not supported in this environment.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Step A: Request Permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        throw new Error('Notification permission was denied by the user.');
      }

      console.log('[Push Hook] Notification permission granted. Registering Service Worker...');

      // Step B: Register the Service Worker
      // Try first with service-worker.js, fallback to sw.js if any issue
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      
      console.log('[Push Hook] Service Worker registered successfully:', registration);
      setIsRegistered(true);

      // Step C: Try to establish a local Push Subscription (VAPID key simulation/registration)
      try {
        let sub = await registration.pushManager.getSubscription();
        if (!sub) {
          // Standard dummy public VAPID key to simulate standard browser push registration
          const applicationServerKey = 'BEl62vSTUQrYki65aD78W9-IruqZ686qyv33sZ6K4mK8Pst-96yL9uS39Vd6FqyGg29FvL59G6R8W9-7z9Y=';
          
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
          });
        }
        
        console.log('[Push Hook] Established active PushSubscription node:', sub);
        setSubscription(sub);
        
        // Persist the mock subscription payload in local storage to simulate backend server sync
        localStorage.setItem('lounge_push_subscription', JSON.stringify(sub));
      } catch (subErr: any) {
        // Some sandboxed browser environments or iframes block pushManager but allow standard notification + SW message API.
        // We catch this gracefully so notifications still work!
        console.warn('[Push Hook] PushManager subscription not fully supported/allowed in this iframe/sandbox:', subErr.message);
      }

      setLoading(false);
      return true;
    } catch (err: any) {
      console.error('[Push Hook] Error registering push notifications:', err);
      setError(err.message || 'Failed to complete registration.');
      setLoading(false);
      return false;
    }
  }, [isSupported]);

  // 3. Helper to trigger local test notification via Service Worker after a short delay (so user can minimize app to test background)
  const sendLocalTestNotification = useCallback((title: string, body: string, delayMs = 3000) => {
    if (!isSupported || permission !== 'granted') {
      console.warn('[Push Hook] Cannot send test notification. Either not supported or permission not granted.');
      return;
    }

    console.log(`[Push Hook] Queueing background test notification: "${title}" in ${delayMs}ms. Minimize the window now!`);
    
    setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg) {
          // If the page is currently hidden (minimized), use SW registration to display it
          if (document.visibilityState === 'hidden') {
            // Post message to Service Worker so it handles it in the background
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                payload: {
                  title,
                  body,
                  icon: '/favicon.ico',
                  tag: 'test-background-alert',
                  data: { timestamp: Date.now() }
                }
              });
            } else {
              // Fallback to direct registration display
              reg.showNotification(title, {
                body,
                icon: '/favicon.ico',
                tag: 'test-background-fallback',
                renotify: true
              } as any);
            }
          } else {
            // If the page is active, show it via normal system notification as a fallback
            new Notification(title, {
              body,
              icon: '/favicon.ico',
              tag: 'test-foreground-alert'
            });
          }
        }
      } catch (err) {
        console.error('[Push Hook] Error dispatching test notification:', err);
      }
    }, delayMs);
  }, [isSupported, permission]);

  return {
    isSupported,
    permission,
    isRegistered,
    subscription,
    loading,
    error,
    requestPermission,
    sendLocalTestNotification
  };
}
