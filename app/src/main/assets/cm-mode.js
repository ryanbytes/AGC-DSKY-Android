'use strict';

// Retained compatibility module for the shared Apollo Block II DSKY finish.
// The application shell fixes the supported rope to Comanche 055; this module
// owns DSKY panel identity and performs no script injection.
(() => {
  function applyCmMode() {
    document.body.classList.add('apollo-block-ii');
    return true;
  }

  const service=Object.freeze({apply:applyCmMode});
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_CM_MODE',service,'cm-mode publication');
  applyCmMode();
})();
