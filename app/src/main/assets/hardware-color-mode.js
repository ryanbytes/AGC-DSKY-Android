'use strict';
(() => {
  if (window.__DSKY_HARDWARE_COLOR_MODE__) return;
  window.__DSKY_HARDWARE_COLOR_MODE__ = true;

  const body = document.body;
  if (!body) return;

  // FS595 hardware palette is the only supported presentation. Clear the old
  // preference so upgrades cannot restore the former default-color mode.
  try { localStorage.removeItem('dskyHardwareColorMode'); } catch (_) {}
  body.classList.add('authentic-colors');

  const controller = Object.freeze({
    authentic: () => true
  });
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_HARDWARE_COLOR_MODE',controller,'hardware-color-mode publication');
})();
