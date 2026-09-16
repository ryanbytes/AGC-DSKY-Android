'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
// Presentation extensions load after the core CM mode and in phase order.
(() => {
  function applyCmMode() {
    try { localStorage.setItem('agcMission','comanche055'); } catch (_) {}
    document.body.classList.add('spacecraft-cm');
  }

  function loadPhase38GlassThickness() {
    if (document.querySelector('script[data-feature="phase38-glass-thickness"]')) return;
    const script = document.createElement('script');
    script.src = 'phase38-glass-thickness.js';
    script.dataset.feature = 'phase38-glass-thickness';
    document.head.appendChild(script);
  }

  function loadPhase37Presentation() {
    const existing = document.querySelector('script[data-feature="phase37-presentation"]');
    if (existing) {
      if (window.__DSKY_PHASE37_PRESENTATION__) loadPhase38GlassThickness();
      else existing.addEventListener('load', loadPhase38GlassThickness, {once:true});
      return;
    }
    const script = document.createElement('script');
    script.src = 'phase37-presentation.js';
    script.dataset.feature = 'phase37-presentation';
    script.addEventListener('load', loadPhase38GlassThickness, {once:true});
    document.head.appendChild(script);
  }

  applyCmMode();
  loadPhase37Presentation();
  if (window.AGCDSKY) window.AGCDSKY.applyCmMode = applyCmMode;
})();
