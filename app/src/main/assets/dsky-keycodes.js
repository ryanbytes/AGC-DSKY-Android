(() => {
  'use strict';

  if (window.AGCDSKY_KEY_CODES) return;

  // Standalone shared copy of the 18 normal Block II DSKY/Pinball keycodes.
  // app.js still carries the same legacy table until its input path is split;
  // tools/dsky-keycode-consistency-smoke.js locks the two copies together.
  // PRO is intentionally absent because it is a separate channel-032 contact.
  window.AGCDSKY_KEY_CODES = Object.freeze({
    '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
    V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
  });
})();
