'use strict';

const CACHE_PREFIX = 'agc-dsky-pwa-';
const CACHE_NAME = CACHE_PREFIX + '__CACHE_VERSION__';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-bootstrap.js',
  './pwa-sensor-parity.js',
  './pwa-auto-dim.js',
  './pwa-clock-guard.js',
  './analytics.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './style.css',
  './controls-layout.css',
  './agc-state.css',
  './main-panel-surround.css',
  './cm-dsky-finish.css',
  './screen-only.css',
  './optics.css',
  './cheatsheet.css',
  './diagnostics.css',
  './legal.css',
  './agc-core.js',
  './spacecraft-default.js',
  './startup-defaults.js',
  './app.js',
  './clock-behavior.js',
  './clock-behavior-v2.js',
  './phone-icdu.js',
  './apollo-stars.js',
  './optics.js',
  './cm-mode.js',
  './flight-hardware-ui.js',
  './keyboard-electrical-interlock.js',
  './lighting-electrical-model.js',
  './relay-audio-refine.js',
  './dsky-geometry.js',
  './dsky-relay-matrix.js',
  './hardware-fidelity.js',
  './relay-identity-audio.js',
  './relay-show.js',
  './background-audio-guard.js',
  './screen-only.js',
  './cheatsheet.js',
  './diagnostics.js',
  './legal.js',
  './dream-agc.js',
  './BUILD_SOURCE.txt',
  './LICENSE-GPL-2.0.txt',
  './PRIVACY_POLICY.txt',
  './SOURCE_CODE.txt',
  './THIRD_PARTY_NOTICES.txt',
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