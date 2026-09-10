(() => {
  'use strict';

  const api = window.AGCDSKYPWA = window.AGCDSKYPWA || {};
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  api.standalone = standalone;
  api.serviceWorker = 'unsupported';
  api.offlineReady = false;

  function publish() {
    try {
      window.dispatchEvent(new CustomEvent('agcdsky-pwa-status', {detail: {...api}}));
    } catch (_) {}
  }

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
