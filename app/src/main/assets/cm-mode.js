'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
// CM hardware/presentation features are parser-ordered directly in index.html;
// this module owns configuration only and performs no script injection.
(() => {
  const shell=window.AGCDSKY_SHELL;
  if(!shell||!shell.store||typeof shell.store.set!=='function')throw new Error('Application shell storage service unavailable');

  function applyCmMode() {
    shell.store.set('agcMission','comanche055');
    document.body.classList.add('spacecraft-cm');
    return true;
  }

  const service=Object.freeze({apply:applyCmMode});
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_CM_MODE',service,'cm-mode publication');
  applyCmMode();
})();
