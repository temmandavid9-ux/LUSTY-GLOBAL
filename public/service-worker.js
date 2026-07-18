// Service Worker for Push, Background Notifications, Assets Caching and Offline Mode
const SW_VERSION = '1.1.0';
const CACHE_NAME_STATIC = 'lusty-global-static-v2';
const CACHE_NAME_API = 'lusty-global-api-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  console.log(`[Service Worker] Installed version ${SW_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME_STATIC).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Pre-caching failed or partial:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated and controlling clients');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME_STATIC && cacheName !== CACHE_NAME_API) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to determine if a request is a static asset
function isStaticAsset(url) {
  const path = url.pathname;
  return (
    url.origin === self.location.origin &&
    (path === '/' ||
     path === '/index.html' ||
     path.endsWith('.js') ||
     path.endsWith('.css') ||
     path.endsWith('.png') ||
     path.endsWith('.jpg') ||
     path.endsWith('.jpeg') ||
     path.endsWith('.svg') ||
     path.endsWith('.ico') ||
     path.includes('/assets/'))
  );
}

// Helper to determine if a request is for Google Fonts or external Stylesheets/Fonts
function isFontOrStylesheet(url) {
  return (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf')
  );
}

// Helper to determine if request is a Supabase profiles API query
function isProfilesApiRequest(request) {
  const url = new URL(request.url);
  return (
    request.method === 'GET' &&
    (url.pathname.includes('/rest/v1/profiles') || url.href.includes('/rest/v1/profiles'))
  );
}

// Intercept Fetch Requests for Caching and Offline Mode
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Case 1: Supabase Profiles API Call (Network-First, with Cache-Fallback)
  if (isProfilesApiRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME_API).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch((err) => {
          console.log('[Service Worker] Offline - serving profile from API cache for:', url.href);
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback JSON
            return new Response(
              JSON.stringify([{
                id: 'offline',
                bio: 'You are currently offline. Viewing cached profile.',
                offline: true
              }]),
              {
                headers: { 'Content-Type': 'application/json' },
                status: 200
              }
            );
          });
        })
    );
    return;
  }

  // Case 2: Static Assets & Fonts (Stale-While-Revalidate)
  if (isStaticAsset(url) || isFontOrStylesheet(url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME_STATIC).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch((err) => {
            console.log('[Service Worker] Fetch failed for static asset offline:', url.pathname);
          });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// 1. Listen for background standard Web Push events
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push event received', event);
  
  let data = { title: 'Lounge Notification', body: 'You have a new update.' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { title: 'Lounge Notification', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'You have a new alert',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'lounge-notification-tag',
    renotify: data.renotify !== false,
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Open Lounge' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 2. Listen for postMessage from the React client (super useful for reliable tab-background alerts)
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received from client:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, data } = event.data.payload;
    
    const options = {
      body: body || '',
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: tag || 'lounge-msg-tag',
      renotify: true,
      data: data || {},
      actions: [
        { action: 'open', title: 'Open Lounge' }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// 3. Listen for notification click actions
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked', event);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }

  // Focus on existing window or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Look for any existing active client tab
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // If no open client tab, open the app's root URL
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
