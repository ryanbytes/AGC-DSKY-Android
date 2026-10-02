'use strict';

// Retained compatibility module for the shared Apollo Block II DSKY finish.
// Mission selection and rope persistence belong to the application shell;
// this parser-ordered module performs no script injection.
(() => {
  function applyCmMode() {
    document.body.classList.add('apollo-block-ii');
    return true;
  }

  const service=Object.freeze({apply:applyCmMode});
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_CM_MODE',service,'cm-mode publication');
  applyCmMode();
})();
