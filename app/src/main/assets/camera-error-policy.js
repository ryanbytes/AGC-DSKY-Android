'use strict';

// The prototype debug reporter records console.error. Expected camera permission
// and lifecycle failures are warnings; unexpected camera failures remain errors.
(() => {
  if (!window.console || typeof console.error !== 'function' || console.__agcCameraErrorsClassified) return;
  const nativeError = console.error.bind(console);
  const nativeWarn = typeof console.warn === 'function'
    ? console.warn.bind(console) : nativeError;
  console.error = (...args) => {
    if (args[0] === 'SXT camera' && args[1] && typeof args[1] === 'object') {
      const err = args[1];
      const name = err.name ? String(err.name) : 'CameraError';
      const message = err.message ? String(err.message) : '';
      const detail = message ? `${name}: ${message}` : name;
      if (name === 'AbortError' || name === 'NotAllowedError' || name === 'SecurityError') {
        nativeWarn('SXT camera', detail);
        return;
      }
      nativeError('SXT camera', detail);
      return;
    }
    nativeError(...args);
  };
  try {
    Object.defineProperty(console, '__agcCameraErrorsClassified', {
      value: true,
      enumerable: false
    });
  } catch (_) {}
})();
