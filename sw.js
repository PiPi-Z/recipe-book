/* 甜心小厨 Service Worker */
const CACHE = 'sweetheart-kitchen-v1';
const PRECACHE = [
  './', './index.html', './manifest.json',
  './css/style.css', './js/store.js', './js/app.js',
  './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() =>
    Promise.all(PRECACHE.map(u => c.add(u).catch(() => null)))
  )).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
    if (res && res.status === 200) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
