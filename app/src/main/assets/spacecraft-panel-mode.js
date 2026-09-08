'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
// The photographic spacecraft-panel compositor was removed from the DSKY-only app.
(() => {
  function applySpacecraftPanelMode() {
    try { localStorage.setItem('agcMission','comanche055'); } catch (_) {}
    document.body.classList.add('spacecraft-cm');
  }
  applySpacecraftPanelMode();
  if (window.AGCDSKY) window.AGCDSKY.applySpacecraftPanelMode = applySpacecraftPanelMode;
})();
