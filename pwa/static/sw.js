'use strict';

const CACHE_PREFIX = 'agc-dsky-pwa-';
const CACHE_NAME = CACHE_PREFIX + '__CACHE_VERSION__';

// These source-backed flight-hardware layers are explicit because the shared
// hardware smoke verifies their offline contract directly from this source.
const REQUIRED_SHARED_ASSETS = [
  './flight-hardware-ui.js',
  './lighting-rheostat-stop.js',
  './key-mechanical-spec.js',
  './keyboard-electrical-interlock.js'
];

// build-site.sh expands the marker below from app/src/main/assets so every
// other shared frontend file is automatically offline-capable. Keep PWA-only
// and external runtime files explicit here.
const CORE_ASSETS = [
  './',
  ...REQUIRED_SHARED_ASSETS,
  /*__SHARED_ASSET_PRECACHE__*/
  './manifest.webmanifest',
  './pwa-bootstrap.js',
  './pwa-sensor-parity.js',
  './pwa-auto-dim.js',
  './pwa-clock-guard.js',
  './analytics.js',
  './clock-behavior-v2.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './yaAGC.wasm',
  './Comanche055.bin'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({type:'window', includeUncontrolled:true}))
      .then(clients => Promise.all(clients.map(client => {
        try { return client.navigate(client.url); }
        catch (_) { return null; }
      })))
  );
});

function cacheResponse(request, response) {
  if (!response || !response.ok) return response;
  const copy = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
  return response;
}

function networkFirst(request, fallbackRequest = request) {
  return fetch(request)
    .then(response => {
      if (!response || !response.ok) throw new Error('HTTP ' + (response ? response.status : 'no response'));
      return cacheResponse(request, response);
    })
    .catch(() => caches.match(fallbackRequest).then(cached => cached || caches.match(request)));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML, JavaScript and CSS are always network-first. This prevents an old
  // installed PWA worker from mixing stale geometry/runtime files with a newly
  // deployed index.html. Offline use still falls back to the versioned cache.
  const isCodeAsset = request.mode === 'navigate'
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css')
    || url.pathname.endsWith('.html');

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (isCodeAsset) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Large immutable payloads and images remain cache-first for fast startup.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => cacheResponse(request, response));
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});