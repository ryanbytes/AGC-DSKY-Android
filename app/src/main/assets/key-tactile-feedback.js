'use strict';

/*
 * K-03 DSKY tactile-event model.
 *
 * This deliberately does NOT map Apollo force values to vibration amplitude.
 * R-700 §3.10.1.5 establishes the key travel geometry, drawing 2004941 gives
 * the compression-spring rate, and SCD 1010901 bounds the sensitive switch,
 * but the surviving source set does not establish total installed finger
 * force. Haptics therefore mark the physical contact/release events only.
 *
 * Android uses View.performHapticFeedback(VIRTUAL_KEY / VIRTUAL_KEY_RELEASE),
 * which is device-calibrated and respects the user's system haptic setting.
 * Browser/PWA/Apple surfaces remain a clean no-op instead of inventing another
 * vibration model.
 */
(() => {
  if (window.__DSKY_KEY_TACTILE_FEEDBACK__) return;
  window.__DSKY_KEY_TACTILE_FEEDBACK__ = true;

  const registry = window.AGCDSKY_SERVICE_REGISTRY;
  if (!registry) throw new Error('AGC late-service registry unavailable');

  let makeCount = 0;
  let releaseCount = 0;
  let lastEvent = null;

  function bridge() {
    try {
      const candidate = window.HapticBridge;
      if (!candidate
          || typeof candidate.keyMake !== 'function'
          || typeof candidate.keyRelease !== 'function') return null;
      if (typeof candidate.available === 'function' && !candidate.available()) return null;
      return candidate;
    } catch (_) {
      return null;
    }
  }

  function fire(kind, key = '?') {
    const native = bridge();
    if (!native) return false;
    try {
      if (kind === 'make') native.keyMake();
      else native.keyRelease();
      if (kind === 'make') makeCount += 1;
      else releaseCount += 1;
      lastEvent = Object.freeze({kind, key:String(key || '?'), at:Date.now()});
      return true;
    } catch (_) {
      return false;
    }
  }

  function mechanicalSpec() {
    try {
      const service = registry.get('AGCDSKY_KEY_MECHANICAL_SPEC');
      return service && typeof service.spec === 'function' ? service.spec() : null;
    } catch (_) {
      return null;
    }
  }

  function status() {
    const spec = mechanicalSpec();
    const force = spec?.springForceEnvelope || {};
    return Object.freeze({
      nativeBridge: !!bridge(),
      platformEffects: Object.freeze({
        make:'VIRTUAL_KEY',
        release:'VIRTUAL_KEY_RELEASE',
        api26ReleaseFallback:'KEYBOARD_TAP'
      }),
      policy:'event-cue-only; no force-to-vibration amplitude mapping',
      actuationTravelIn: spec?.assembly?.actuationTravelIn ?? null,
      overtravelToBottomIn: spec?.assembly?.overtravelToBottomIn ?? null,
      totalTravelIn: spec?.assembly?.totalTravelIn ?? null,
      springRateLbPerInMin: spec?.compressionSpring?.rateLbPerInMin ?? null,
      springRateLbPerInMax: spec?.compressionSpring?.rateLbPerInMax ?? null,
      springForceIncreaseToActuationOzMin: force.forceIncreaseToActuationOzMin ?? null,
      springForceIncreaseToActuationOzMax: force.forceIncreaseToActuationOzMax ?? null,
      springForceIncreaseToBottomOzMin: force.forceIncreaseToBottomOzMin ?? null,
      springForceIncreaseToBottomOzMax: force.forceIncreaseToBottomOzMax ?? null,
      switchActuatingForceOzMax: spec?.sensitiveSwitch?.actuatingForceOzMax ?? null,
      switchReleaseForceOzMin: spec?.sensitiveSwitch?.releaseForceOzMin ?? null,
      totalFingerForceOz: null,
      makeCount,
      releaseCount,
      lastEvent
    });
  }

  registry.publish('AGCDSKY_KEY_TACTILE', Object.freeze({
    make: key => fire('make', key),
    release: key => fire('release', key),
    status
  }), 'key tactile feedback publication');
})();
