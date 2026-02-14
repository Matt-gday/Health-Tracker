/* ============================================
   Heart & Health Tracker — Service Worker
   Offline-first caching strategy
   ============================================ */

const CACHE_NAME = 'heart-tracker-v2.2.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
  './css/styles.css',
  './js/db.js',
  './js/demo.js',
  './js/app.js',
  './js/ui.js',
  './js/charts.js',
  './js/export.js',
  './js/notifications.js',
  './img/icon-192.png',
  './img/icon-512.png',
  'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'
];

// Install: Pre-cache all assets — skip waiting so new SW activates immediately
self.addEventListener('install', (event) => {
  console.log('SW: Installing', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching assets');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up ALL old caches, then claim all clients immediately
self.addEventListener('activate', (event) => {
  console.log('SW: Activating', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('SW: Deleting old cache', key);
              return caches.delete(key);
            })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for skip-waiting message from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: Cache-first for known assets, network-first for dynamic
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Version check should always go to network
  if (url.pathname.endsWith('version.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
      .catch(() => {
        // Fallback for HTML requests
        if (event.request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
        // Return a proper empty response for non-HTML requests (e.g. favicon)
        return new Response('', { status: 408, statusText: 'Offline' });
      })
  );
});
