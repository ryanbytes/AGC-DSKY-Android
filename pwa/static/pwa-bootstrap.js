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

  // Brave Android can fall back to a browser shortcut rather than a standalone
  // WebAPK. If that happens, request document fullscreen on a completed user
  // gesture. Touchscreen activation is granted on pointerup/touchend/click,
  // not necessarily on pointerdown/touchstart.
  const androidBrowserMode = /Android/i.test(navigator.userAgent || '') && !standalone;
  let fullscreenSucceeded = false;
  let fullscreenPending = false;

  function tryAndroidFullscreen() {
    if (!androidBrowserMode || fullscreenSucceeded || fullscreenPending || document.fullscreenElement) return;

    const root = document.documentElement;
    const request = root && (
      (typeof root.requestFullscreen === 'function' && (() => root.requestFullscreen())) ||
      (typeof root.webkitRequestFullscreen === 'function' && (() => root.webkitRequestFullscreen()))
    );
    if (!request) return;
    if (document.fullscreenEnabled === false && document.webkitFullscreenEnabled === false) return;

    fullscreenPending = true;
    try {
      const result = request();
      if (result && typeof result.then === 'function') {
        result.then(() => {
          fullscreenSucceeded = true;
          fullscreenPending = false;
          api.fullscreen = true;
          delete api.fullscreenError;
          publish();
        }).catch(error => {
          fullscreenPending = false;
          api.fullscreenError = String(error && error.name ? error.name : 'request rejected');
          publish();
        });
      } else {
        fullscreenSucceeded = true;
        fullscreenPending = false;
        api.fullscreen = true;
        delete api.fullscreenError;
        publish();
      }
    } catch (error) {
      fullscreenPending = false;
      api.fullscreenError = String(error && error.name ? error.name : 'request failed');
      publish();
    }
  }

  if (androidBrowserMode) {
    // Capture the completed tap before DSKY button handlers consume it.
    for (const eventName of ['pointerup', 'touchend', 'click']) {
      document.addEventListener(eventName, tryAndroidFullscreen, {capture: true, passive: true});
    }
    document.addEventListener('keyup', tryAndroidFullscreen, {capture: true});
  }

  document.addEventListener('fullscreenchange', () => {
    fullscreenPending = false;
    api.fullscreen = Boolean(document.fullscreenElement) || displayFullscreen;
    if (document.fullscreenElement) fullscreenSucceeded = true;
    publish();
  });

  document.addEventListener('webkitfullscreenchange', () => {
    fullscreenPending = false;
    api.fullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement) || displayFullscreen;
    if (document.fullscreenElement || document.webkitFullscreenElement) fullscreenSucceeded = true;
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
