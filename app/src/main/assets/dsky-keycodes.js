(() => {
  'use strict';

  if (window.AGCDSKY_KEY_CODES) return;

  // Single source of truth for the 18 normal Block II DSKY/Pinball keycodes.
  // This script is parser-loaded before app.js so the app and every extracted
  // input layer consume the same frozen map. PRO is intentionally absent
  // because it is a separate maintained contact on channel 032.
  window.AGCDSKY_KEY_CODES = Object.freeze({
    '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
    V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
  });
})();
