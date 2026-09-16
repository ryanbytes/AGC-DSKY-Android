'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
// Phase 37 adds its presentation extension as a separate late asset so the
// underlying AGC/DSKY runtime and native sensor bridge remain untouched.
(() => {
  function applyCmMode() {
    try { localStorage.setItem('agcMission','comanche055'); } catch (_) {}
    document.body.classList.add('spacecraft-cm');
  }

  function loadPhase37Presentation() {
    if (document.querySelector('script[data-feature="phase37-presentation"]')) return;
    const script = document.createElement('script');
    script.src = 'phase37-presentation.js';
    script.dataset.feature = 'phase37-presentation';
    document.head.appendChild(script);
  }

  applyCmMode();
  loadPhase37Presentation();
  if (window.AGCDSKY) window.AGCDSKY.applyCmMode = applyCmMode;
})();
