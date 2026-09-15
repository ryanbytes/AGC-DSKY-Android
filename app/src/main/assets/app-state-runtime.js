'use strict';

// Explicit application-state bootstrap. Session/presentation fields and AGC
// core-lifecycle fields remain separate sealed objects. This bootstrap also
// installs the one audited compatibility registry used by later classic-script
// fidelity layers; compatibility names are accessor-backed service slots, not
// duplicate application state.
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

  if (!window.AGCDSKY_COMPAT) {
    const entries = new Map();
    function assertName(name) {
      if (typeof name !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
        throw new TypeError(`Invalid compatibility name: ${String(name)}`);
      }
      if (entries.has(name)) throw new Error(`Compatibility name already registered: ${name}`);
    }
    function mutable(name, initial, validate = null) {
      assertName(name);
      if (validate && !validate(initial)) throw new TypeError(`Invalid initial value for ${name}`);
      let value = initial, version = 0;
      const history = [];
      const entry = Object.freeze({
        kind:'mutable',
        get:()=>value,
        set(next, reason='direct assignment') {
          if (validate && !validate(next)) throw new TypeError(`Invalid value for ${name}`);
          const prior = value;
          value = next;
          version++;
          history.push(Object.freeze({version,reason:String(reason)}));
          return prior;
        },
        version:()=>version,
        history:()=>history.map(item=>({...item}))
      });
      entries.set(name, entry);
      Object.defineProperty(window, name, {
        configurable:false,
        enumerable:false,
        get:()=>value,
        set(next){ entry.set(next); }
      });
      return entry;
    }
    function accessor(name, getter, setter = null) {
      assertName(name);
      if (typeof getter !== 'function') throw new TypeError(`Getter required for ${name}`);
      if (setter !== null && typeof setter !== 'function') throw new TypeError(`Setter must be a function for ${name}`);
      let version = 0;
      const history = [];
      const entry = Object.freeze({
        kind:setter?'accessor':'readonly',
        get:getter,
        set: setter ? (next, reason='direct assignment') => {
          const prior = getter();
          setter(next);
          version++;
          history.push(Object.freeze({version,reason:String(reason)}));
          return prior;
        } : undefined,
        version:()=>version,
        history:()=>history.map(item=>({...item}))
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
      return accessor(name, typeof valueOrGetter === 'function' ? valueOrGetter : () => valueOrGetter, null);
    }
    function get(name) {
      const entry = entries.get(name);
      if (!entry) throw new Error(`Unknown compatibility name: ${name}`);
      return entry.get();
    }
    function describe() {
      return Array.from(entries, ([name,entry]) => ({name,kind:entry.kind,version:entry.version()}));
    }
    window.AGCDSKY_COMPAT = Object.freeze({mutable,accessor,readonly,get,describe});
  }
})();
