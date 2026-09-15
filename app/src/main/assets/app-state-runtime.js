'use strict';

// Shared mutable application session state. New runtime modules bind this
// object explicitly. Temporary Window accessors preserve classic-script bare
// identifier compatibility for late fidelity layers while they are migrated.
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

  // A browser classic-script bare identifier resolves through the Window
  // object when no global lexical binding shadows it. Keep only state names
  // that still have tracked legacy consumers; migrated audio code reads state
  // explicitly and no longer receives a tickSound compatibility global.
  for (const name of [
    'mode','selectedMission','verb','noun','dream','dreamMode','dim',
    'displayOnly','ntpStatus'
  ]) {
    Object.defineProperty(window, name, {
      configurable:true,
      enumerable:false,
      get(){ return state[name]; },
      set(value){ state[name] = value; }
    });
  }
})();
