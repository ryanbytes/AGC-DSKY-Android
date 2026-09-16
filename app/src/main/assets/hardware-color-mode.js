'use strict';
(() => {
  if (window.__DSKY_HARDWARE_COLOR_MODE__) return;
  window.__DSKY_HARDWARE_COLOR_MODE__ = true;

  const body = document.body;
  if (!body) return;

  // v1.1.24 made the FS595 palette the canonical presentation. Keep upgrades
  // from reviving the retired palette toggle.
  try { localStorage.removeItem('dskyHardwareColorMode'); } catch (_) {}
  body.classList.add('authentic-colors');

  const controller = Object.freeze({ authentic: () => true });
  const api = window.AGCDSKY = window.AGCDSKY || {};
  api.hardwareColorMode = controller;
  window.AGCDSKY_HARDWARE_COLOR_MODE = controller;
})();
