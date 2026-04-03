// ════════════════════════════════════════════════
//  BAŞKENTRAY — Service Worker v4.0 (TAMİR EDİLDİ)
// ════════════════════════════════════════════════

const CACHE_VERSION = 'v7';
const CACHE_NAME = 'baskentray-' + CACHE_VERSION;

const STATIC_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ── Kurulum ──────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Bazı kaynaklar önbelleğe alınamadı:', err);
      }))
  );
});

// ── Aktivasyon ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (DÜZELTİLEN KISIM) ──────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Favicon veya Supabase/Harita isteklerini pas geç (Cache'leme)
  if (
    url.pathname.includes('favicon.ico') ||
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('openstreetmap.org')
  ) return;

  const isNetworkFirst =
    event.request.destination === 'document' ||
    event.request.destination === 'manifest' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('sw.js');

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (!response || response.status !== 200) return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, responseToCache));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, responseToCache));
          return response;
        }).catch(() => null);
      })
    );
  }
});

// Diğer Dinleyiciler
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
