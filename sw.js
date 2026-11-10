/* 修改页面或资源后同步提升 CACHE 版本。 */
const CACHE = 'duoduo-garden-v2';
const ASSETS = [
  './',
  './index.html',
  './camellia.html',
  './garden.css',
  './styles.css',
  './garden.js',
  './src/pwa.js',
  './src/main.js',
  './src/flower.js',
  './src/flowerGeometry.js',
  './src/bouquet.js',
  './src/backdrop.js',
  './src/handTracker.js',
  './src/handPreview.js',
  './src/skeleton.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/duoduo-garden-mascot.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon.ico',
  './docs/bouquet-preview.png',
  './vendor/three/three.module.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const request = event.request;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => {
          if (cached) return cached;
          return caches.match(new URL(request.url).pathname.endsWith('/camellia.html')
            ? './camellia.html'
            : './index.html');
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
