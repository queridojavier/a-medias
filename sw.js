const CACHE = 'a-medias-v2.2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/styles.css',
  './js/constants.js',
  './js/utils.js',
  './js/toast.js',
  './js/sync.js',
  './js/calculator.js',
  './js/reimbursements.js',
  './js/split.js',
  './js/app.js'
];

// CDNs permitidos para cache runtime
const ALLOWED_CDN = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estrategia cache-first con revalidación en segundo plano
const cacheFirstWithRevalidate = (req) => {
  return caches.match(req).then(cached => {
    const fetchPromise = fetch(req).then(res => {
      if (res.ok) {
        caches.open(CACHE).then(cache => cache.put(req, res.clone()));
      }
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  });
};

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Origen propio o CDNs permitidos: cache-first con revalidación
  if (url.origin === location.origin || ALLOWED_CDN.includes(url.hostname)) {
    event.respondWith(cacheFirstWithRevalidate(req));
  }
});
