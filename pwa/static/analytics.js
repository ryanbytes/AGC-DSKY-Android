(() => {
  'use strict';

  const ENDPOINT = __ANALYTICS_ENDPOINT_JSON__;
  const BUILD = __APP_VERSION_JSON__;
  const STORAGE_KEY = 'agcdsky.analytics.client.v1';
  const DISABLE_KEY = 'agcdsky.analytics.disabled';

  const api = window.AGCDSKYAnalytics = window.AGCDSKYAnalytics || {};

  function applyQueryPreference() {
    try {
      const value = new URLSearchParams(location.search).get('telemetry');
      if (value === 'off') localStorage.setItem(DISABLE_KEY, '1');
      if (value === 'on') localStorage.removeItem(DISABLE_KEY);
    } catch (_) {}
  }

  function telemetryEnabled() {
    if (!/^https:\/\//i.test(ENDPOINT)) return false;
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return false;
    try {
      if (localStorage.getItem(DISABLE_KEY) === '1') return false;
    } catch (_) {}
    return true;
  }

  function getClientId() {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = crypto.randomUUID
          ? crypto.randomUUID()
          : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
              (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch (_) {
      return null;
    }
  }

  function deviceClass() {
    const ua = navigator.userAgent || '';
    const touch = Number(navigator.maxTouchPoints || 0);
    if (/iPhone|iPod/i.test(ua)) return 'iphone';
    if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)) return 'ipad';
    if (/Android/i.test(ua)) return 'android';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Linux/i.test(ua)) return 'linux';
    return 'other';
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  async function send(eventName) {
    if (!telemetryEnabled()) return false;
    const clientId = getClientId();
    if (!clientId) return false;

    const payload = JSON.stringify({
      event: eventName,
      clientId,
      standalone: isStandalone(),
      device: deviceClass(),
      build: BUILD
    });

    try {
      const response = await fetch(`${ENDPOINT.replace(/\/$/, '')}/v1/event`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true,
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: payload
      });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  applyQueryPreference();
  api.enabled = telemetryEnabled();
  api.endpoint = api.enabled ? ENDPOINT : null;
  api.disable = () => {
    try { localStorage.setItem(DISABLE_KEY, '1'); } catch (_) {}
    api.enabled = false;
  };
  api.enable = () => {
    try { localStorage.removeItem(DISABLE_KEY); } catch (_) {}
    api.enabled = telemetryEnabled();
  };
  api.send = send;

  if (api.enabled) {
    window.addEventListener('load', () => { void send('launch'); }, {once: true});
    window.addEventListener('appinstalled', () => { void send('install'); }, {once: true});
  }
})();
