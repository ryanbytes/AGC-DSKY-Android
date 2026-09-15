'use strict';

// Shared mutable application session state. Runtime and presentation modules
// bind this object explicitly; application state is not mirrored onto Window.
(() => {
  if (window.AGCDSKY_APP_STATE) return;
  const state = Object.seal({
    mode:'clock',
    selectedMission:'comanche055',
    verb:'16',
    noun:'65',
    dream:false,
    dreamMode:'dim',
    dim:false,
    tickSound:true,
    displayOnly:false,
    appVisible:!document.hidden,
    ntpStatus:{
      server:'time.cloudflare.com',
      offsetMs:0,
      lastSyncUtcMs:0,
      roundTripMs:-1,
      ageMs:-1,
      state:'unavailable'
    }
  });
  window.AGCDSKY_APP_STATE = state;
})();
