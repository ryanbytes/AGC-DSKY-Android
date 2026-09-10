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
  './phone-icdu.js',
  './apollo-stars.js',
  './optics.js',
  './cm-mode.js',
  './relay-audio-refine.js',
  './dsky-geometry.js',
  './hardware-fidelity.js',
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
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
