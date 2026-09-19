/**
 * CountDown — Service Worker
 * Caches all assets for 100% offline use
 */

const CACHE = 'countdown-v6';
const PREFIX = 'countdown-';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './timer-core.js',
  './theme.js',
  './persian-cal.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './fonts/vazirmatn-arabic-400-normal.woff2',
  './fonts/vazirmatn-arabic-500-normal.woff2',
  './fonts/vazirmatn-arabic-700-normal.woff2',
  './fonts/vazirmatn-arabic-800-normal.woff2',
  './fonts/vazirmatn-latin-400-normal.woff2',
  './fonts/vazirmatn-latin-700-normal.woff2'
];

self.addEventListener('install', (event) => {
  // Wait for all tabs running the previous version to close before activating.
  // This avoids mixing a new worker with an old open editor.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // A query string must not break an offline home-screen launch.
      if (event.request.mode === 'navigate') {
        return (await cache.match('./index.html')) || fetch(event.request);
      }
      return (await cache.match(event.request)) || fetch(event.request);
    })()
  );
});
