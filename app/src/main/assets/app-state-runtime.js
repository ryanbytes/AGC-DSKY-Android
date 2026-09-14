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
  // object when no global lexical binding shadows it. Keep legacy consumers
  // live without creating a second mutable state source.
  for (const name of [
    'mode','selectedMission','verb','noun','dream','dreamMode','dim',
    'tickSound','displayOnly','ntpStatus'
  ]) {
    Object.defineProperty(window, name, {
      configurable:true,
      enumerable:false,
      get(){ return state[name]; },
      set(value){ state[name] = value; }
    });
  }
})();
