/**
 * CountDown — Service Worker
 * Caches all assets for 100% offline use
 */

const CACHE = 'countdown-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
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

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
