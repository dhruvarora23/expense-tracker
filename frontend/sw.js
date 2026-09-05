const CACHE_NAME = 'expense-tracker-v1';
const APP_SHELL = ['./index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache the app shell (HTML/CSS/JS); always hit the network for
  // /api/ requests so expense data is never served stale.
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
