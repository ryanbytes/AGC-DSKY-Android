(() => {
  'use strict';
  document.getElementById('pwa-print-action')?.addEventListener('click', () => {
    try { window.print(); } catch (_) {}
  });
  document.getElementById('pwa-print-close')?.addEventListener('click', () => window.close());
  if (!document.body.classList.contains('pwa-android-imposed')) {
    setTimeout(() => { try { window.print(); } catch (_) {} }, 350);
  }
})();
