'use strict';

(() => {
  const params = new URLSearchParams(location.search);
  const isDream = params.get('dream') === '1';
  const key = 'screenOnly';
  let enabled = isDream;
  if (!isDream) {
    try { enabled = localStorage.getItem(key) === '1'; } catch (_) {}
  }

  const controls = document.getElementById('controls');
  const modeText = document.getElementById('mode');
  const button = document.createElement('button');
  button.id = 'screen';
  button.type = 'button';
  if (controls) controls.insertBefore(button, modeText || null);

  function remember() {
    if (isDream) return;
    try { localStorage.setItem(key, enabled ? '1' : '0'); } catch (_) {}
  }

  function apply() {
    document.body.classList.toggle('screen-only', enabled);
    // SCREEN and the older cropped DISPLAY mode are mutually exclusive.
    if (enabled) document.body.classList.remove('display-only');
    button.textContent = enabled ? 'FULL DSKY' : 'SCREEN';
    remember();
  }

  button.addEventListener('click', () => {
    enabled = !enabled;
    apply();
    if (!enabled && typeof showControls === 'function') showControls();
  });

  // SCREEN hides its controls. Match the existing display-only escape gesture:
  // hold anywhere for 1.8 s to return to the full DSKY in the normal app.
  let hold = 0;
  document.addEventListener('pointerdown', () => {
    if (isDream || !enabled) return;
    clearTimeout(hold);
    hold = setTimeout(() => {
      enabled = false;
      apply();
      if (typeof showControls === 'function') showControls();
    }, 1800);
  }, { passive: true });
  document.addEventListener('pointerup', () => clearTimeout(hold), { passive: true });
  document.addEventListener('pointercancel', () => clearTimeout(hold), { passive: true });

  // DreamService always gets the borderless readout regardless of the normal
  // app's saved view choice.
  if (isDream) enabled = true;
  apply();
})();
