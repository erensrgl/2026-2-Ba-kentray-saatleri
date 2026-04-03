// ════════════════════════════════════════════════
//  BAŞKENTRAY — Service Worker v4.1 (FULL TAMİR)
//  - Eklenti (chrome-extension) hataları engellendi
//  - Supabase & Harita dışarıda tutuldu
//  - PWA/Çevrimdışı desteği optimize edildi
// ════════════════════════════════════════════════

const CACHE_VERSION = 'v7';
const CACHE_NAME = 'baskentray-' + CACHE_VERSION;

const STATIC_ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ── Kurulum: Temel dosyaları hafızaya al ──────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => console.warn('[SW] Kurulumda bazı dosyalar atlandı.'))
  );
});

// ── Aktivasyon: Eski cache'leri temizle ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// ── Fetch: İstekleri Yönet ve Hataları Engelle ────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. KRİTİK FİLTRE: Sadece http/https protokolünü işle (chrome-extension HATASINI ÇÖZER)
  if (!event.request.url.startsWith('http')) return;

  // 2. DIŞARIDA TUTULACAKLAR: Supabase, Harita Katmanları ve Favicon
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.pathname.includes('favicon.ico') ||
    event.request.method !== 'GET'
  ) return;

  // 3. STRATEJİ BELİRLE: HTML ve Manifest için Network-First
  const isNetworkFirst =
    event.request.destination === 'document' ||
    event.request.destination === 'manifest' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
  } else {
    // Diğer dosyalar (JS, CSS, Font) için Cache-First
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, resClone));
          return response;
        }).catch(() => null);
      })
    );
  }
});

// Mesaj Dinleyicisi
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
