// Service Worker with Network-First Strategy
const CACHE_NAME = 'mutiari-garden-v' + new Date().toISOString().slice(0,10).replace(/-/g,'');
const STATIC_CACHE = 'static-' + CACHE_NAME;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...', CACHE_NAME);
  self.skipWaiting();
});

// Activate event - clean ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== STATIC_CACHE) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network First Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Skip API requests
  if (event.request.url.includes('supabase') || 
      event.request.url.includes('onidel') ||
      event.request.url.includes('s3')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Update cache with fresh response
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if offline
        console.log('[SW] Offline, serving from cache');
        return caches.match(event.request);
      })
  );
});

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
