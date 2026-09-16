'use strict';
(() => {
  if (window.__DSKY_PHASE38_GLASS_THICKNESS__) return;
  window.__DSKY_PHASE38_GLASS_THICKNESS__ = true;

  const dsky = document.getElementById('dsky');
  if (!dsky) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'phase38-glass-thickness.css';
  link.dataset.feature = 'phase38-glass-thickness';
  document.head.appendChild(link);

  let glassBack = dsky.querySelector('.el-glass-back');
  if (!glassBack) {
    glassBack = document.createElement('div');
    glassBack.className = 'el-glass-back';
    glassBack.setAttribute('aria-hidden', 'true');
    dsky.appendChild(glassBack);
  }

  const controller = Object.freeze({
    rearSurface: () => glassBack
  });
  window.AGCDSKY_PHASE38_GLASS_THICKNESS = controller;
  const api = window.AGCDSKY = window.AGCDSKY || {};
  api.glassThickness = controller;
})();
