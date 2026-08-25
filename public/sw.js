// Service Worker for Push, Background Notifications, Assets Caching and Offline Mode
const SW_VERSION = '1.2.0';
const CACHE_NAME_STATIC = 'lusty-global-static-v10';
const CACHE_NAME_API = 'lusty-global-api-v10';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
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
  if (path.includes('manifest.json')) return false;
  return (
    url.origin === self.location.origin &&
    (path === '/' ||
     path === '/index.html' ||
     path.endsWith('.json') ||
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

  // Skip non-GET requests, and completely ignore manifest.json to let the browser load it directly
  if (request.method !== 'GET' || url.pathname.includes('manifest.json')) {
    return;
  }

  // Bypass Service Worker for Supabase REST APIs (except profile cache), Auth, and video stream requests
  if (
    (url.pathname.includes('/rest/v1/') && !isProfilesApiRequest(request)) ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.webm') ||
    url.pathname.includes('/storage/v1/object/public/videos/')
  ) {
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
              cache.put(request, responseClone).catch((err) => {
                console.warn('[Service Worker] Failed to write API response to cache:', err);
              });
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

  // Case 1.5: Supabase Storage/Assets (Network-First with fallback to cached logo.png or safe silent audio)
  if (url.hostname === 'vtmaffcyvhnnmfibfswm.supabase.co') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch((err) => {
          console.warn('[Service Worker] Supabase asset fetch failed for:', url.pathname);
          // If it is an audio request or ends with .mp3, return a clean empty response with a 204 status to prevent browser audio issues
          if (url.pathname.endsWith('.mp3') || request.destination === 'audio') {
            return new Response(null, { status: 204 });
          }
          // If it is an image, fall back to cached logo.png
          return caches.match('/logo.png').then((fallback) => {
            if (fallback) return fallback;
            return new Response('', { status: 404, statusText: 'Offline Fallback Unavailable' });
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
                cache.put(request, responseClone).catch((err) => {
                  console.warn('[Service Worker] Failed to write static asset to cache:', err);
                });
              });
            }
            return networkResponse;
          });

        if (cachedResponse) {
          // Silent background update catch so it doesn't log standard network interruptions as fatal errors
          fetchPromise.catch((err) => {
            console.log('[Service Worker] Running in offline/cached fallback mode.');
          });
          return cachedResponse;
        }

        return fetchPromise.catch((err) => {
          console.warn('[Service Worker] Fetch failed for static asset offline:', url.pathname);
          // If it is an image request, fallback to logo.png
          if (request.destination === 'image' || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg')) {
            return caches.match('/logo.png').then((fallback) => {
              if (fallback) return fallback;
              throw err;
            });
          }
          throw err;
        });
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
