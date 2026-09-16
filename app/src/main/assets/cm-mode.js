'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
// The recovered v1.1.21+ FS595 palette is loaded here; glass geometry and
// parallax remain owned by the dedicated physical-depth presentation layer.
(() => {
  function ensureHardwarePalette() {
    if (window.__DSKY_HARDWARE_PALETTE_LINKED__) return;
    if (!document.head || typeof document.createElement !== 'function') return;
    window.__DSKY_HARDWARE_PALETTE_LINKED__ = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'hardware-color-mode.css';
    if (typeof link.setAttribute === 'function') link.setAttribute('data-dsky-hardware-colors','1');
    document.head.appendChild(link);
  }

  function applyCmMode() {
    try {
      localStorage.setItem('agcMission','comanche055');
      localStorage.removeItem('dskyHardwareColorMode');
    } catch (_) {}
    ensureHardwarePalette();
    document.body.classList.add('spacecraft-cm');
    document.body.classList.add('authentic-colors');
  }

  applyCmMode();
  if (window.AGCDSKY) window.AGCDSKY.applyCmMode = applyCmMode;
})();
