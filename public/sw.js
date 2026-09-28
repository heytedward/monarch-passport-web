// Monarch Passport service worker: fast repeat opens and an offline screen.
//
// - Built files (/assets/*, content-hashed) plus fonts, icons and splash
//   images are cache-first: a hashed file never changes, so a cached copy is
//   always correct and the app opens without re-downloading it. Keeping old
//   hashes around also means a tab still on the previous deploy can load its
//   chunks.
// - Pages (navigations) are network-first so every open gets the latest
//   deploy; with no connection they fall back to /offline.html.
// - Everything else (the API, Privy, Supabase, Stripe, any other origin) is
//   not touched: WNGS, taps and login always go to the network.
const VERSION = 'v1';
const SHELL_CACHE = `passport-shell-${VERSION}`;
const ASSET_CACHE = 'passport-assets';
const MAX_ASSETS = 300;
const PRECACHE = [
  '/offline.html',
  '/fonts/unbounded.css',
  '/fonts/unbounded-latin.woff2',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('passport-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    cache.put(request, res.clone()).then(() => trim(cache));
  }
  return res;
}

async function networkFirstPage(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match('/offline.html');
    return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (/^\/(assets|fonts|icons|splash)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
