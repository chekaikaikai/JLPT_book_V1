/* ことば卡 Service Worker（網路優先：有網路時載入最新版，離線時使用快取）
 * 所有路徑皆相對於 sw.js 所在位置，因此可在 GitHub Pages 子路徑（/repo-name/）運作。
 * 新增檔案時請加進 SHELL，並調高 CACHE_VERSION。 */
const CACHE_VERSION = 'kotobaka-v5';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'data/words.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match('index.html'))
      )
  );
});
