/* 修改页面或资源后同步提升 CACHE 版本。 */
const CACHE = 'duoduo-garden-v14';
const ASSETS = [
  './',
  './index.html',
  './camellia.html',
  './snowflake.html',
  './garden.css',
  './styles.css',
  './snowflake.css',
  './garden.js',
  './src/pwa.js',
  './src/threeRuntime.js',
  './src/main.js',
  './src/flower.js',
  './src/flowerGeometry.js',
  './src/bouquet.js',
  './src/backdrop.js',
  './src/handTracker.js',
  './src/handPreview.js',
  './src/skeleton.js',
  './src/snowflakeExperience.js',
  './src/snowflake.js',
  './src/snowflakeGeometry.js',
  './src/snowflakeBackdrop.js',
  './src/snowfall.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/duoduo-garden-mascot.svg',
  './assets/icon-180.png',
  './assets/icon-180-opaque.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-192.png',
  './assets/icon-maskable-512.png',
  './assets/icon.ico',
  './docs/bouquet-preview.png',
  './docs/snowflake-preview.png',
  './docs/snowflake-preview-mobile.png',
  './vendor/three/three.module.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE && !key.startsWith('duoduo-hand-assets-'))
        .map((key) => caches.delete(key))))
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
      (async () => {
        const cached = await caches.match(request);
        if (cached) {
          fetch(request)
            .then((response) => {
              if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response));
            })
            .catch(() => {});
          return cached;
        }
        try {
          const response = await fetch(request);
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        } catch {
          const path = new URL(request.url).pathname;
          const page = path.endsWith('/snowflake.html')
            ? './snowflake.html'
            : path.endsWith('/camellia.html')
              ? './camellia.html'
              : './index.html';
          return caches.match(page);
        }
      })()
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
