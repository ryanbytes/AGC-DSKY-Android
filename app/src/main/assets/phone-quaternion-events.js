'use strict';

/*
 * Native phone quaternion -> presentation event adapter.
 *
 * Android owns the native SensorManager feed and phone-icdu.js owns the AGC
 * sensor callback. Presentation consumers must not replace that callback.
 * This adapter is the single compatibility boundary: it preserves the existing
 * AGC callback, validates/normalizes the raw Android quaternion, then publishes
 * a read-only CustomEvent for presentation-only consumers such as parallax.
 */
(() => {
  const api = window.AGCDSKY;
  if (!api || typeof api.nativePhoneQuaternion !== 'function') return;

  const prior = api.nativePhoneQuaternion;
  if (prior.__agcdskyQuaternionEventAdapter) return;

  const wrapped = function(w, x, y, z, displayAngle = 0) {
    prior.call(api, w, x, y, z, displayAngle);

    const values = [w, x, y, z].map(Number);
    if (!values.every(Number.isFinite)) return;
    const norm = Math.hypot(values[0], values[1], values[2], values[3]);
    if (!(norm > 0)) return;

    const rawQuaternion = values.map(value => value / norm);
    const numericAngle = Number(displayAngle);
    const angle = Number.isFinite(numericAngle)
      ? ((numericAngle % 360) + 360) % 360
      : 0;

    try {
      window.dispatchEvent(new CustomEvent('agcdsky-phonequaternion', {
        detail: Object.freeze({
          rawQuaternion: Object.freeze(rawQuaternion),
          displayAngle: angle,
          source: 'android-native'
        })
      }));
    } catch (_) {}
  };

  try {
    Object.defineProperty(wrapped, '__agcdskyQuaternionEventAdapter', {value:true});
  } catch (_) {
    wrapped.__agcdskyQuaternionEventAdapter = true;
  }

  api.nativePhoneQuaternion = wrapped;
})();
