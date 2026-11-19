/* AI Share of Voice Calculator: offline support for the installed app.
   Network first, so updates show right away; the saved copy is used only when offline.
   Nothing you paste is sent anywhere: calculator data stays in this browser's storage. */
const CACHE = 'sov-app-v1';
const CORE = [
  '/ai-share-of-voice-calculator',
  '/assets/site.css?v=2',
  '/assets/services.css',
  '/assets/sov-calculator.css?v=5',
  '/assets/site.js',
  '/assets/sov-calculator.js?v=5',
  '/favicon.svg',
  '/images/app/icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameSite = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameSite && !fonts) return; // analytics and everything else go straight to the network

  // The app page: one saved copy, whatever the query string (?source=app and so on)
  const isPage = req.mode === 'navigate';
  const key = isPage ? '/ai-share-of-voice-calculator' : req;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key, { ignoreSearch: isPage }))
  );
});
