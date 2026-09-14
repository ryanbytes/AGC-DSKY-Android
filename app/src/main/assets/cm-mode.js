'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
// CM hardware/presentation features are parser-ordered directly in index.html;
// this module owns configuration only and performs no script injection.
(() => {
  function applyCmMode() {
    try { localStorage.setItem('agcMission','comanche055'); } catch (_) {}
    document.body.classList.add('spacecraft-cm');
  }

  applyCmMode();
  if (window.AGCDSKY) window.AGCDSKY.applyCmMode = applyCmMode;
})();
