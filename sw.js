// Kavach service worker: cache the app shell so it works offline (and loads instantly).
const CACHE = 'kavach-v1';
const SHELL = [
  './', './index.html', './manifest.json',
  './css/styles.css',
  './js/util.js', './js/i18n.js', './js/store.js', './js/forensics.js', './js/shield.js',
  './js/vault.js', './js/report.js', './js/sahara.js', './js/app.js',
  './assets/logo.svg', './assets/hero.svg', './assets/sahara.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // never cache third-party / API traffic
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
