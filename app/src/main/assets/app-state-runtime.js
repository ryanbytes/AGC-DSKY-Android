'use strict';

// Explicit application-state bootstrap. Session/presentation fields and AGC
// core-lifecycle fields remain separate sealed objects. This bootstrap also
// installs the one audited compatibility registry used by later classic-script
// fidelity layers; compatibility names are forwarded owner aliases or read-only
// views, never duplicate mutable application/service state.
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
        transport:'device',
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

  if (!window.AGCDSKY_COMPAT) {
    const entries = new Map();
    function assertName(name) {
      if (typeof name !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
        throw new TypeError(`Invalid compatibility name: ${String(name)}`);
      }
      if (entries.has(name)) throw new Error(`Compatibility name already registered: ${name}`);
    }
    function alias(name, getter, setter = null, versionGetter = null, historyGetter = null) {
      assertName(name);
      if (typeof getter !== 'function') throw new TypeError(`Getter required for ${name}`);
      if (setter !== null && typeof setter !== 'function') throw new TypeError(`Setter must be a function for ${name}`);
      if (versionGetter !== null && typeof versionGetter !== 'function') throw new TypeError(`Version getter must be a function for ${name}`);
      if (historyGetter !== null && typeof historyGetter !== 'function') throw new TypeError(`History getter must be a function for ${name}`);
      const entry = Object.freeze({
        kind:setter?'alias':'readonly-alias',
        get:getter,
        set:setter ? (next, reason='direct assignment') => {
          const prior = getter();
          setter(next, reason);
          return prior;
        } : undefined,
        version:()=>versionGetter ? (Number(versionGetter())||0) : 0,
        history:()=>historyGetter ? historyGetter().map(item=>({...item})) : []
      });
      entries.set(name, entry);
      Object.defineProperty(window, name, {
        configurable:false,
        enumerable:false,
        get:getter,
        set:setter ? next=>entry.set(next) : undefined
      });
      return entry;
    }
    function readonly(name, valueOrGetter) {
      assertName(name);
      const getter = typeof valueOrGetter === 'function' ? valueOrGetter : () => valueOrGetter;
      const entry = Object.freeze({
        kind:'readonly',
        get:getter,
        set:undefined,
        version:()=>0,
        history:()=>[]
      });
      entries.set(name, entry);
      Object.defineProperty(window, name, {
        configurable:false,
        enumerable:false,
        get:getter
      });
      return entry;
    }
    function get(name) {
      const entry = entries.get(name);
      if (!entry) throw new Error(`Unknown compatibility name: ${name}`);
      return entry.get();
    }
    function replace(name, next, reason = 'explicit replacement') {
      const entry = entries.get(name);
      if (!entry) throw new Error(`Unknown compatibility name: ${name}`);
      if (typeof entry.set !== 'function') throw new TypeError(`Compatibility name is read-only: ${name}`);
      return entry.set(next, reason);
    }
    function describe() {
      return Array.from(entries, ([name,entry]) => ({name,kind:entry.kind,version:entry.version()}));
    }
    window.AGCDSKY_COMPAT = Object.freeze({alias,readonly,get,replace,describe});
  }
})();