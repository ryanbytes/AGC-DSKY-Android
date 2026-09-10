(() => {
  'use strict';

  const api = window.AGCDSKYPWA = window.AGCDSKYPWA || {};
  const displayFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const standalone = displayFullscreen || displayStandalone || window.navigator.standalone === true;

  api.standalone = standalone;
  api.fullscreen = displayFullscreen || Boolean(document.fullscreenElement);
  api.serviceWorker = 'unsupported';
  api.offlineReady = false;

  function publish() {
    try {
      window.dispatchEvent(new CustomEvent('agcdsky-pwa-status', {detail: {...api}}));
    } catch (_) {}
  }

  // Brave Android cannot mint a WebAPK, so its install action may create a
  // browser shortcut instead of a standalone app. In that case, use the
  // Fullscreen API on the first user gesture to remove browser chrome.
  const androidBrowserMode = /Android/i.test(navigator.userAgent || '') && !standalone;
  let fullscreenSucceeded = false;

  function tryAndroidFullscreen() {
    if (!androidBrowserMode || fullscreenSucceeded || document.fullscreenElement) return;
    const root = document.documentElement;
    if (!document.fullscreenEnabled || !root || typeof root.requestFullscreen !== 'function') return;

    try {
      const request = root.requestFullscreen({navigationUI: 'hide'});
      if (request && typeof request.then === 'function') {
        request.then(() => {
          fullscreenSucceeded = true;
          api.fullscreen = true;
          publish();
        }).catch(() => {});
      }
    } catch (_) {}
  }

  if (androidBrowserMode) {
    document.addEventListener('pointerdown', tryAndroidFullscreen, {capture: true, passive: true});
    document.addEventListener('touchstart', tryAndroidFullscreen, {capture: true, passive: true});
  }

  document.addEventListener('fullscreenchange', () => {
    api.fullscreen = Boolean(document.fullscreenElement) || displayFullscreen;
    if (document.fullscreenElement) fullscreenSucceeded = true;
    publish();
  });

  if (!('serviceWorker' in navigator)) {
    publish();
    return;
  }

  api.serviceWorker = 'registering';
  publish();

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {scope: './'});
      api.serviceWorker = 'registered';
      api.registration = registration;
      await navigator.serviceWorker.ready;
      api.offlineReady = true;
      publish();
    } catch (error) {
      api.serviceWorker = 'error';
      api.error = String(error && error.message ? error.message : error);
      publish();
    }
  }, {once: true});

  window.addEventListener('appinstalled', () => {
    api.standalone = true;
    api.installedAt = Date.now();
    publish();
  });

  window.addEventListener('online', publish, {passive: true});
  window.addEventListener('offline', publish, {passive: true});
})();
