// ════════════════════════════════════════════════
//  BAŞKENTRAY — Service Worker v4.0
//  - display:standalone garantisi
//  - Manifest + HTML her zaman network-first
//  - Kurulum sonrası buton bir daha gösterilmez
// ════════════════════════════════════════════════

const CACHE_VERSION = 'v6';
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
      .then(() => {
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
        });
      })
  );
});

// ── Fetch ────────────────────────────────────────
if (event.request.url.includes('favicon.ico')) return;
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/')
  ) return;

  const isNetworkFirst =
    event.request.destination === 'document' ||
    event.request.destination === 'manifest' ||
    event.request.destination === 'image' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('sw.js');

  // Eski hali yerine bunu kullan:
if (isNetworkFirst) {
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (!response || response.status !== 200) return response;

        // Clone işlemini bir değişkene atayıp önce onu kullanıyoruz
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, responseToCache));

        return response; // Orijinal response'u döndürüyoruz
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
  return;
}

  // Eski hali yerine bunu kullan:
event.respondWith(
  caches.match(event.request).then(cached => {
    if (cached) return cached;

    return fetch(event.request).then(response => {
      if (!response || response.status !== 200) return response;

      // BURASI KRİTİK: Önce clone alıyoruz
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(c => c.put(event.request, responseToCache));

      return response;
    }).catch(() => null);
  })
);

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Başkentray', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
