'use strict';

// Keep a deterministic first-run mode before the application shell reads
// persistent state. Other startup responsibilities live in dedicated modules.
(() => {
  try {
    if (localStorage.getItem('runMode') === null) {
      localStorage.setItem('runMode', 'clock');
    }
  } catch (_) {
    // localStorage may be unavailable outside the packaged WebView.
  }
})();
