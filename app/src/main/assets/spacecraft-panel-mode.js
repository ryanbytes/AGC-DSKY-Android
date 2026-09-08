'use strict';

// CM-only build: there is no LM scene or mission switch.
(() => {
  function applySpacecraftPanelMode() {
    try { localStorage.setItem('agcMission','comanche055'); } catch (_) {}
    document.body.classList.add('spacecraft-cm');
    if (window.AGCDSKY && typeof window.AGCDSKY.syncSpacecraftPanel === 'function') {
      requestAnimationFrame(window.AGCDSKY.syncSpacecraftPanel);
    }
  }
  applySpacecraftPanelMode();
  if (window.AGCDSKY) window.AGCDSKY.applySpacecraftPanelMode = applySpacecraftPanelMode;
})();
