'use strict';

// Shared mutable application session state. Runtime modules use this object
// explicitly instead of relying on cross-script lexical globals for mode,
// mission, command fields, and NTP status.
(() => {
  if (window.AGCDSKY_APP_STATE) return;
  const state = Object.seal({
    mode:'clock',
    selectedMission:'comanche055',
    verb:'16',
    noun:'65',
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
