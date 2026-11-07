const CACHE_NAME = 'incha-pos-v3';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/incha-logo.svg',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Hanya proses method GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Permintaan Dokumen HTML / Navigasi SPA: SELALU JARINGAN DULU (Network-First)
  // Ini mencegah layar putih akibat index.html lawas merujuk ke chunk JS yang sudah berganti di Vercel
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Hanya fallback ke cache jika perangkat kasir sedang benar-benar offline (tanpa sinyal)
          return caches.match(event.request).then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // 2. Aset Statis Ber-hash (/assets/...): Cache First dengan Network Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        });
    })
  );
});
