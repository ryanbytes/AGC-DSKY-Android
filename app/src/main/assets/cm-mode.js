'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
// The recovered v1.1.21+ FS595 palette is loaded here; glass geometry and
// parallax remain owned by the dedicated physical-depth presentation layer.
(() => {
  function ensureHardwarePalette() {
    if (document.querySelector('link[data-dsky-hardware-colors]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'hardware-color-mode.css';
    link.setAttribute('data-dsky-hardware-colors','1');
    document.head.appendChild(link);
  }

  function applyCmMode() {
    try {
      localStorage.setItem('agcMission','comanche055');
      localStorage.removeItem('dskyHardwareColorMode');
    } catch (_) {}
    ensureHardwarePalette();
    document.body.classList.add('spacecraft-cm','authentic-colors');
  }

  applyCmMode();
  if (window.AGCDSKY) window.AGCDSKY.applyCmMode = applyCmMode;
})();
