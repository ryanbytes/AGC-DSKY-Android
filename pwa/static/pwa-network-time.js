(() => {
  'use strict';

  const pwa = window.AGCDSKYPWA = window.AGCDSKYPWA || {};
  const SAMPLE_COUNT = 5;
  const PERIOD_MS = 15 * 60 * 1000;
  const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
  const TIMEOUT_MS = 4500;

  let lastStatus = {
    server: location.host || 'same-origin',
    transport: 'http-date',
    offsetMs: 0,
    lastSyncUtcMs: 0,
    roundTripMs: -1,
    ageMs: -1,
    state: 'unavailable'
  };
  let lastSyncLocalMs = 0;
  let syncPromise = null;
  let probeSerial = 0;

  function publish(next) {
    lastStatus = {...lastStatus, ...next};
    try {
      if (window.AGCDSKY && typeof window.AGCDSKY.nativeNtpStatus === 'function') {
        window.AGCDSKY.nativeNtpStatus(lastStatus);
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('agcdsky-network-time', {detail:{...lastStatus}}));
    } catch (_) {}
  }

  function ageNow() {
    return lastSyncLocalMs > 0 ? Math.max(0, Date.now() - lastSyncLocalMs) : -1;
  }

  function refreshAge() {
    const ageMs = ageNow();
    if (ageMs < 0) return;
    const state = ageMs > STALE_AFTER_MS ? 'stale' : 'synced';
    publish({ageMs, state});
  }

  async function fetchDateHeader() {
    const serial = ++probeSerial;
    const url = new URL('./', location.href);
    url.searchParams.set('agcdsky_time_probe', String(Date.now()) + '-' + String(serial));

    const attempt = async method => {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : 0;
      const startWall = Date.now();
      const startMono = performance.now();
      try {
        const response = await fetch(url.href, {
          method,
          cache:'no-store',
          credentials:'omit',
          redirect:'follow',
          signal:controller ? controller.signal : undefined,
          headers:{'Cache-Control':'no-cache'}
        });
        const endMono = performance.now();
        const endWall = Date.now();
        if (!response || !response.ok) throw new Error('HTTP ' + (response ? response.status : 'no response'));
        const text = response.headers && response.headers.get ? response.headers.get('date') : null;
        if (!text) throw new Error('Date header missing');
        const serverMs = Date.parse(text);
        if (!Number.isFinite(serverMs)) throw new Error('Date header invalid');
        const rttMs = Math.max(0, endMono - startMono);
        // HTTP Date has one-second resolution. Center that quantization window,
        // then compare it to the midpoint of the client request/response times.
        const clientMidpointMs = startWall + ((endWall - startWall) / 2);
        const offsetMs = (serverMs + 500) - clientMidpointMs;
        return {offsetMs, roundTripMs:rttMs, method};
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    try { return await attempt('HEAD'); }
    catch (headError) {
      try { return await attempt('GET'); }
      catch (getError) {
        const error = new Error(String(getError && getError.message ? getError.message : getError));
        error.headError = String(headError && headError.message ? headError.message : headError);
        throw error;
      }
    }
  }

  function median(values) {
    const sorted = values.slice().sort((a,b) => a-b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  async function synchronize(reason='periodic') {
    if (syncPromise) return syncPromise;
    syncPromise = (async () => {
      publish({state:lastSyncLocalMs ? lastStatus.state : 'syncing', reason});
      const samples = [];
      const errors = [];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        try { samples.push(await fetchDateHeader()); }
        catch (error) { errors.push(String(error && error.message ? error.message : error)); }
      }

      if (!samples.length) {
        const ageMs = ageNow();
        publish({
          ageMs,
          state:ageMs >= 0 && ageMs <= STALE_AFTER_MS ? 'synced' : ageMs > STALE_AFTER_MS ? 'stale' : 'unavailable',
          error:errors[errors.length - 1] || 'network time unavailable'
        });
        return {...lastStatus};
      }

      // Favor low-latency probes before taking the median offset. This limits
      // CDN/network asymmetry while retaining resistance to one bad Date value.
      const ranked = samples.slice().sort((a,b) => a.roundTripMs - b.roundTripMs);
      const accepted = ranked.slice(0, Math.min(3, ranked.length));
      const offsetMs = Math.round(median(accepted.map(sample => sample.offsetMs)));
      const bestRtt = Math.round(ranked[0].roundTripMs);
      lastSyncLocalMs = Date.now();
      publish({
        server:location.host || 'same-origin',
        transport:'http-date',
        offsetMs,
        lastSyncUtcMs:lastSyncLocalMs + offsetMs,
        roundTripMs:bestRtt,
        ageMs:0,
        state:'synced',
        samples:accepted.length,
        method:ranked[0].method,
        reason
      });
      if ('error' in lastStatus) {
        const clean = {...lastStatus};
        delete clean.error;
        lastStatus = clean;
        publish(lastStatus);
      }
      return {...lastStatus};
    })().finally(() => { syncPromise = null; });
    return syncPromise;
  }

  pwa.syncNetworkTime = synchronize;
  pwa.networkTimeStatus = () => ({...lastStatus});

  publish({state:'syncing', reason:'startup'});
  void synchronize('startup');

  setInterval(refreshAge, 30000);
  setInterval(() => { if (navigator.onLine !== false) void synchronize('periodic'); }, PERIOD_MS);
  window.addEventListener('online', () => void synchronize('online'), {passive:true});
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine !== false) void synchronize('visible');
  }, {passive:true});
})();