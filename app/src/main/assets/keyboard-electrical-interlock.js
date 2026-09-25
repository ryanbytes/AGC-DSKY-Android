'use strict';

/*
 * Apollo Block II DSKY normal-key electrical interlock.
 *
 * Primary hardware descriptions state that the 18 keycoded pushbuttons are
 * interconnected in series so only one keycode can be produced at a time.
 * KEYRST is restored only after the keyboard has returned to the all-released
 * state.  PRO is not part of this matrix; it remains a separate maintained
 * active-low input on channel 032.
 *
 * This listener lives on window capture, ahead of the older document-level
 * mechanical handler. It owns the 18 keycoded switches and CLOCK -> AGC
 * first-contact handoff. dsky-input-runtime.js owns channel-015 make/KEYRST;
 * runtime-transitions.js owns CLOCK-entry cleanup ordering.
 */
(() => {
  const DSKY_KEY_CODE = window.AGCDSKY_KEY_CODES;
  if (!DSKY_KEY_CODE) throw new Error('Shared DSKY keycode table unavailable');
  if (window.__DSKY_KEYBOARD_ELECTRICAL_INTERLOCK__) return;
  window.__DSKY_KEYBOARD_ELECTRICAL_INTERLOCK__ = true;

  const api = window.AGCDSKY;
  const runtime = api?.runtimeTransitions;
  const input = api?.inputRuntime;
  if (!api || !runtime || !input
      || typeof runtime.mode !== 'function'
      || typeof runtime.core !== 'function'
      || typeof runtime.clockRequested !== 'function'
      || typeof runtime.requestAgc !== 'function'
      || typeof runtime.onBeforeClock !== 'function'
      || typeof input.ready !== 'function'
      || typeof input.keyMake !== 'function'
      || typeof input.keyReset !== 'function'
      || !runtime.modes) {
    throw new Error('Shared AGC runtime/input authority unavailable');
  }

  const FALLBACK_CONTACT_MS = 36;
  const FALLBACK_RETURN_MS = 18;
  const MIN_KEYCODE_HOLD_MS = 12;
  // Desktop/PWA hardware-keyboard aliases. These feed the same channel-015
  // electrical interlock as pointer input; they are not a second input model.
  const KEYBOARD_MAP = Object.freeze({
    '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
    'v':'V','n':'N','e':'E','c':'C','r':'R','k':'K','+':'+','-':'-',
    'Enter':'E','Escape':'C'
  });

  const pointers = new Map();
  let cycleLatched = false;
  let electricalCore = null;
  let electricalKeyCode = 0;
  let electricalMade = false;
  let electricalMadeAt = 0;
  let keyResetTimer = 0;
  let clockHandoffPending = false;
  let keyboardState = null;

  function normalButton(event) {
    const button = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!button || button.dataset.key === 'P') return null;
    return button;
  }

  function personality(button) {
    const key = button?.dataset?.key || '?';
    try {
      const all = api.hardwarePersonality?.();
      const p = all?.keys?.[key];
      if (p) return p;
    } catch (_) {}
    return {contactMs:FALLBACK_CONTACT_MS, returnSoundMs:FALLBACK_RETURN_MS,
      makePitch:520, returnPitch:330, soundGain:1};
  }

  function tactileService() {
    try { return window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_KEY_TACTILE'); }
    catch (_) { return null; }
  }

  function keyHaptic(button, returning = false) {
    const service = tactileService();
    if (!service) return false;
    const key = button?.dataset?.key || '?';
    try {
      const fn = returning ? service.release : service.make;
      return typeof fn === 'function' ? !!fn(key) : false;
    } catch (_) {
      return false;
    }
  }

  function keySound(button, returning = false) {
    let ctx = null;
    try {
      if (localStorage.getItem('audioTickV4') === '0') return;
      ctx = typeof window.ensureAudio === 'function' ? window.ensureAudio() : null;
    } catch (_) { return; }
    if (!ctx) return;
    const p = personality(button);
    const fire = () => {
      const when = ctx.currentTime + 0.001;
      const osc = ctx.createOscillator();
      const body = ctx.createGain();
      const startHz = returning ? (p.returnPitch || 330) : (p.makePitch || 520);
      const endHz = returning ? startHz * 0.64 : startHz * 0.48;
      const gain = (returning ? .028 : .052) * (p.soundGain || 1);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(startHz, when);
      osc.frequency.exponentialRampToValueAtTime(endHz, when + (returning ? .010 : .007));
      body.gain.setValueAtTime(gain, when);
      body.gain.exponentialRampToValueAtTime(.0001, when + (returning ? .014 : .011));
      osc.connect(body); body.connect(ctx.destination); osc.start(when); osc.stop(when + .016);
    };
    if (ctx.state === 'running') fire(); else ctx.resume().then(fire).catch(() => {});
  }

  function currentMode() {
    try { return String(runtime.mode() || ''); }
    catch (_) { return ''; }
  }

  function registerElectricalMake(code) {
    if (runtime.clockRequested() || !input.ready()) return false;
    let core = null;
    try { core = runtime.core(); } catch (_) { return false; }
    if (!core) return false;
    const accepted = input.keyMake(code);
    if (!(accepted > 0)) return false;
    electricalCore = core;
    electricalKeyCode = code;
    electricalMade = true;
    electricalMadeAt = performance.now();
    if (typeof api.scheduleAgcAutosave === 'function') {
      api.scheduleAgcAutosave('DSKY key make');
    }
    return true;
  }

  async function promoteClockContact(state, code) {
    try {
      await runtime.requestAgc('keyboard electrical contact');
      if (state.cancelled || !clockHandoffPending || runtime.clockRequested()) return;
      if (currentMode() !== runtime.modes.AGC || !input.ready()) {
        throw new Error('AGC input runtime not ready after clock handoff');
      }
      if (!registerElectricalMake(code)) throw new Error('AGC rejected clock-handoff keycode');

      clockHandoffPending = false;
      if (!state.down) assertKeyResetIfReady();
    } catch (error) {
      clockHandoffPending = false;
      if (!state.cancelled && !runtime.clockRequested()) {
        console.error('DSKY clock-to-AGC key handoff failed', error);
      }
      if (!state.down && allNormalKeysReleased()) clearElectricalCycle();
    }
  }

  function makeContact(state) {
    if (!state || !state.down || state.made) return;
    if (runtime.clockRequested()) {
      state.cancelled = true;
      return;
    }
    state.made = true;
    keySound(state.button, false);
    if (state.source === 'pointer') keyHaptic(state.button, false);
    if (!state.accepted) return;

    const key = state.button.dataset.key;
    const code = DSKY_KEY_CODE[key];
    if (code === undefined) return;
    try {
      const modeNow = currentMode();
      if (modeNow === runtime.modes.CLOCK || modeNow === runtime.modes.AGC_LOADING) {
        if (!clockHandoffPending) {
          clockHandoffPending = true;
          void promoteClockContact(state, code);
        }
        return;
      }

      if (modeNow === runtime.modes.AGC && input.ready()) {
        registerElectricalMake(code);
      }
    } catch (error) {
      console.error('DSKY series-key contact failed', error);
    }
  }

  function allNormalKeysReleased() {
    for (const state of pointers.values()) if (state.down) return false;
    if (keyboardState && keyboardState.down) return false;
    return true;
  }

  function clearElectricalCycle() {
    electricalCore = null;
    electricalKeyCode = 0;
    electricalMade = false;
    electricalMadeAt = 0;
    clockHandoffPending = false;
    cycleLatched = false;
  }

  function assertKeyResetIfReady() {
    if (!allNormalKeysReleased()) return;
    if (clockHandoffPending && !electricalMade) return;

    if (electricalMade) {
      const elapsed = Math.max(0, performance.now() - electricalMadeAt);
      const remaining = MIN_KEYCODE_HOLD_MS - elapsed;
      if (remaining > 0.01) {
        if (!keyResetTimer) {
          keyResetTimer = setTimeout(() => {
            keyResetTimer = 0;
            assertKeyResetIfReady();
          }, remaining);
        }
        return;
      }
      try {
        if (electricalCore) input.keyReset(electricalCore);
        else if (input.ready()) input.keyReset();
      } catch (error) {
        console.error('DSKY KEYRST failed', error);
      }
    }
    if (keyResetTimer) clearTimeout(keyResetTimer);
    keyResetTimer = 0;
    clearElectricalCycle();
  }

  function clearPointers() {
    for (const state of Array.from(pointers.values())) {
      clearTimeout(state.timer);
      state.cancelled = true;
      state.down = false;
      state.button.classList.remove('pressed');
      try { state.button.releasePointerCapture(state.pointerId); } catch (_) {}
      pointers.delete(state.pointerId);
    }
  }

  function clearKeyboard() {
    if (!keyboardState) return;
    clearTimeout(keyboardState.timer);
    keyboardState.cancelled = true;
    keyboardState.down = false;
    if (keyboardState.button) keyboardState.button.classList.remove('pressed');
    keyboardState = null;
  }

  function releaseEverything() {
    clearPointers();
    clearKeyboard();
    if (clockHandoffPending && !electricalMade) {
      clearElectricalCycle();
      return;
    }
    assertKeyResetIfReady();
  }

  function releaseForClock() {
    clearPointers();
    clearKeyboard();
    if (keyResetTimer) clearTimeout(keyResetTimer);
    keyResetTimer = 0;
    if (electricalMade) {
      try {
        if (electricalCore) input.keyReset(electricalCore);
        else if (input.ready()) input.keyReset();
      } catch (error) {
        console.error('DSKY KEYRST before CLOCK failed', error);
      }
    }
    clearElectricalCycle();
  }

  function onPointerDown(event) {
    const button = normalButton(event);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (runtime.clockRequested()) return;
    if (pointers.has(event.pointerId)) return;
    const accepted = !cycleLatched;
    if (accepted) cycleLatched = true;
    const p = personality(button);
    const state = {
      button, pointerId:event.pointerId, source:'pointer', down:true, accepted, made:false, cancelled:false, timer:0
    };
    pointers.set(event.pointerId, state);
    button.classList.add('pressed');
    try { button.setPointerCapture(event.pointerId); } catch (_) {}
    state.timer = setTimeout(() => makeContact(state), Math.max(0, Number(p.contactMs) || FALLBACK_CONTACT_MS));
  }

  function finishPointer(event, cancelled) {
    const state = pointers.get(event.pointerId);
    if (!state) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    clearTimeout(state.timer);
    if (!cancelled && !state.made) makeContact(state);
    state.down = false;
    state.button.classList.remove('pressed');
    if (state.made) {
      const p = personality(state.button);
      setTimeout(() => {
        keySound(state.button, true);
        if (state.source === 'pointer') keyHaptic(state.button, true);
      }, Math.max(0, Number(p.returnSoundMs) || FALLBACK_RETURN_MS));
    }
    try { state.button.releasePointerCapture(state.pointerId); } catch (_) {}
    pointers.delete(event.pointerId);
    assertKeyResetIfReady();
    return true;
  }

  function keyboardKey(event) {
    const target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''))) return null;
    const raw = event.key && event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return KEYBOARD_MAP[raw] || null;
  }

  function onKeyDown(event) {
    const key = keyboardKey(event);
    if (!key) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || keyboardState || runtime.clockRequested()) return;
    const button = document.querySelector('[data-key="' + key + '"]');
    if (!button || key === 'P') return;
    const accepted = !cycleLatched;
    if (accepted) cycleLatched = true;
    const p = personality(button);
    keyboardState = {button, source:'keyboard', down:true, accepted, made:false, cancelled:false, timer:0, key};
    button.classList.add('pressed');
    keyboardState.timer = setTimeout(() => makeContact(keyboardState), Math.max(0, Number(p.contactMs) || FALLBACK_CONTACT_MS));
  }

  function onKeyUp(event) {
    const key = keyboardKey(event);
    if (!key || !keyboardState || keyboardState.key !== key) return;
    event.preventDefault();
    event.stopPropagation();
    const state = keyboardState;
    clearTimeout(state.timer);
    if (!state.made) makeContact(state);
    state.down = false;
    state.button.classList.remove('pressed');
    if (state.made) {
      const p = personality(state.button);
      setTimeout(() => keySound(state.button, true), Math.max(0, Number(p.returnSoundMs) || FALLBACK_RETURN_MS));
    }
    keyboardState = null;
    assertKeyResetIfReady();
  }

  window.addEventListener('pointerdown', onPointerDown, {capture:true, passive:false});
  window.addEventListener('keydown', onKeyDown, {capture:true});
  window.addEventListener('keyup', onKeyUp, {capture:true});
  window.addEventListener('pointerup', event => finishPointer(event, false), {capture:true, passive:false});
  window.addEventListener('pointercancel', event => finishPointer(event, true), {capture:true, passive:false});
  window.addEventListener('click', event => {
    if (!normalButton(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, {capture:true, passive:false});
  window.addEventListener('blur', releaseEverything, {passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseEverything(); }, {capture:true});

  runtime.onBeforeClock(releaseForClock);

  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_KEYBOARD_ELECTRICAL',Object.freeze({
    state: () => ({
      cycleLatched,
      down:pointers.size + (keyboardState && keyboardState.down ? 1 : 0),
      electricalMade,
      electricalKeyCode,
      electricalMadeAt,
      keyResetPending:!!keyResetTimer,
      clockHandoffPending,
      minKeycodeHoldMs:MIN_KEYCODE_HOLD_MS,
      keys:Array.from(pointers.values()).map(s => ({key:s.button.dataset.key, accepted:s.accepted, made:s.made})).concat(keyboardState ? [{key:keyboardState.key, accepted:keyboardState.accepted, made:keyboardState.made, source:'keyboard'}] : [])
    }),
    releaseAll: releaseEverything
  }),'keyboard-electrical-interlock publication');
})();
