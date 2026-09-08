'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
(() => {
  function applyCmMode() {
    try { localStorage.setItem('agcMission','comanche055'); } catch (_) {}
    document.body.classList.add('spacecraft-cm');
  }
  applyCmMode();
  if (window.AGCDSKY) window.AGCDSKY.applyCmMode = applyCmMode;
})();
