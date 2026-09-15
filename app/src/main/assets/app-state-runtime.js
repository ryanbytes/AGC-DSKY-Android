'use strict';

// Explicit application-state bootstrap. Session/presentation fields and AGC
// core-lifecycle fields are separate sealed objects and are never mirrored onto
// Window as bare compatibility properties.
(() => {
  if (!window.AGCDSKY_APP_STATE) {
    window.AGCDSKY_APP_STATE = Object.seal({
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
  }
  if (!window.AGCDSKY_CORE_SESSION) {
    window.AGCDSKY_CORE_SESSION = Object.seal({
      core:null,
      loadedMission:'',
      suspendedForClock:false,
      pausedForVisibility:false
    });
  }
})();
