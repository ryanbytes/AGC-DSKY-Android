(() => {
  'use strict';

  if (window.AGCDSKY_KEY_CODES) return;

  // app.js currently owns the canonical 18-key Pinball table. Export one
  // immutable shared copy for later runtime layers instead of letting each
  // input layer maintain its own duplicate octal mapping. PRO is intentionally
  // absent because hardware-fidelity.js owns its separate channel-032 contact.
  if (typeof AGC_KEY !== 'object' || !AGC_KEY) {
    throw new Error('Canonical DSKY keycode table unavailable');
  }

  window.AGCDSKY_KEY_CODES = Object.freeze({...AGC_KEY});
})();
