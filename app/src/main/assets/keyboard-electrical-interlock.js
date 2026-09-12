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
 * mechanical handler.  It therefore owns the 18 keycoded switches without
 * changing PRO or the rest of flight-hardware-ui.js.  Because it owns the
 * earliest normal-key event, it also owns CLOCK -> AGC handoff so the first
 * physical contact is not swallowed before the older document listener sees it.
 */
(() => {
  if (window.__DSKY_KEYBOARD_ELECTRICAL_INTERLOCK__) return;
  window.__DSKY_KEYBOARD_ELECTRICAL_INTERLOCK__ = true;

  const DSKY_KEY_CODE = Object.freeze({
    '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
    V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
  });
  const FALLBACK_CONTACT_MS = 36;
  const FALLBACK_RETURN_MS = 18;
  // Best-estimate minimum electrical dwell, not a measured switch spec.
  // Block II keyboard lines enter the AGC through noise-filtering D circuits;
  // surviving descriptions place a valid sustained keyboard input around the
  // 10-ms region.  Twelve milliseconds prevents an unrealistically short
  // touchscreen tap from making and resetting in the same JS turn while still
  // being far below an ordinary human key hold.
  const MIN_KEYCODE_HOLD_MS = 12;

  const pointers = new Map();
  let cycleLatched = false;
  let electricalCore = null;
  let electricalKeyCode = 0;
  let electricalMade = false;
  let electricalMadeAt = 0;
  let keyResetTimer = 0;
  let clockHandoffPending = false;

  function normalButton(event) {
    const button = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!button || button.dataset.key === 'P') return null;
    return button;
  }

  function personality(button) {
    const key = button?.dataset?.key || '?';
    try {
      const all = window.AGCDSKY?.hardwarePersonality?.();
      const p = all?.keys?.[key];
      if (p) return p;
    } catch (_) {}
    return {contactMs:FALLBACK_CONTACT_MS, returnSoundMs:FALLBACK_RETURN_MS,
      makePitch:520, returnPitch:330, soundGain:1};
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

  function currentCore() {
    try { return window.AGCDSKY && typeof window.AGCDSKY.getCore === 'function' ? window.AGCDSKY.getCore() : null; }
    catch (_) { return null; }
  }

  function currentMode() {
    try {
      if (window.AGCDSKY && typeof window.AGCDSKY.appStatus === 'function') {
        return String(window.AGCDSKY.appStatus().mode || '');
      }
    } catch (_) {}
    try { return typeof mode !== 'undefined' ? String(mode) : ''; }
    catch (_) { return ''; }
  }

  function registerElectricalMake(core, code) {
    const accepted = typeof core.keyPress === 'function'
      ? core.keyPress(code)
      : (typeof core.writeIo === 'function' ? core.writeIo(0o15, code) : 0);
    if (!(accepted > 0)) return false;
    electricalCore = core;
    electricalKeyCode = code;
    electricalMade = true;
    electricalMadeAt = performance.now();
    if (window.AGCDSKY && typeof window.AGCDSKY.scheduleAgcAutosave === 'function') {
      window.AGCDSKY.scheduleAgcAutosave('DSKY key make');
    }
    return true;
  }

  function waitForAgcLoad(api) {
    return new Promise((resolve, reject) => {
      const check = () => {
        let status;
        try { status = api.appStatus(); }
        catch (error) { reject(error); return; }
        if (status && status.mode === 'agc') { resolve(); return; }
        if (!status || status.mode !== 'agc-loading') {
          reject(new Error(`AGC handoff ended in ${status?.mode || 'unknown'} mode`));
          return;
        }
        setTimeout(check, 10);
      };
      check();
    });
  }

  async function promoteClockContact(state, code) {
    const api = window.AGCDSKY;
    try {
      if (!api || typeof api.enterAgc !== 'function' || typeof api.appStatus !== 'function') {
        throw new Error('AGC mode API unavailable');
      }

      // enterAgc() is the authoritative transition.  If another caller already
      // has the core in agc-loading, enterAgc() intentionally returns early;
      // wait for that in-flight load rather than dropping this physical key.
      await api.enterAgc();
      if (currentMode() === 'agc-loading') await waitForAgcLoad(api);

      const core = currentCore();
      if (!core || currentMode() !== 'agc') throw new Error('AGC core not ready after clock handoff');
      if (!registerElectricalMake(core, code)) throw new Error('AGC rejected clock-handoff keycode');

      clockHandoffPending = false;
      // A touchscreen tap may have physically returned while the WASM/rope was
      // loading.  In that case the make still happened, so assert its keycode
      // first and then let the normal minimum-dwell/KEYRST path release it.
      if (!state.down) assertKeyResetIfReady();
    } catch (error) {
      clockHandoffPending = false;
      console.error('DSKY clock-to-AGC key handoff failed', error);
      if (!state.down && allNormalKeysReleased()) clearElectricalCycle();
    }
  }

  function makeContact(state) {
    if (!state || !state.down || state.made) return;
    state.made = true;
    keySound(state.button, false);

    // A mechanically depressed second key is real, but the series contact
    // network prevents it from generating another keycode until every normal
    // key has first returned to released.  It must not become the new owner
    // merely because the original key is subsequently released.
    if (!state.accepted) return;

    const key = state.button.dataset.key;
    const code = DSKY_KEY_CODE[key];
    if (code === undefined) return;
    try {
      const modeNow = currentMode();
      if (modeNow === 'clock' || modeNow === 'agc-loading') {
        // The window-capture electrical layer stops propagation before
        // clock-behavior.js can see the pointer.  Promote here, at the real
        // contact point, and preserve this same contact through AGC startup.
        if (!clockHandoffPending) {
          clockHandoffPending = true;
          void promoteClockContact(state, code);
        }
        return;
      }

      const core = currentCore();
      if (core && modeNow === 'agc') {
        registerElectricalMake(core, code);
        return;
      }
      if (typeof window.press === 'function') window.press(key);
    } catch (error) {
      console.error('DSKY series-key contact failed', error);
    }
  }

  function allNormalKeysReleased() {
    for (const state of pointers.values()) if (state.down) return false;
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
    // While CLOCK -> AGC startup is in flight, retain ownership of this
    // physical cycle.  Clearing it here would let the async handoff assert a
    // keycode after KEYRST had already been declared, leaving channel 015 held.
    if (clockHandoffPending && !electricalMade) return;

    // KEYRST exists only at the all-released state. If the accepted contact
    // was made only moments ago (possible on a touchscreen fast tap), retain
    // the keycode through a short D-input-filter dwell before restoring KEYRST.
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
      const core = electricalCore || currentCore();
      try {
        if (core && typeof core.keyRelease === 'function') core.keyRelease();
        else if (core && typeof core.writeIo === 'function') core.writeIo(0o15, 0);
      } catch (error) {
        console.error('DSKY KEYRST failed', error);
      }
    }
    if (keyResetTimer) clearTimeout(keyResetTimer);
    keyResetTimer = 0;
    clearElectricalCycle();
  }

  function onPointerDown(event) {
    const button = normalButton(event);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (pointers.has(event.pointerId)) return;
    const accepted = !cycleLatched;
    if (accepted) cycleLatched = true;
    const p = personality(button);
    const state = {
      button, pointerId:event.pointerId, down:true, accepted, made:false, timer:0
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
    if (!cancelled && !state.made) makeContact(state); // fast tap still closes its switch
    state.down = false;
    state.button.classList.remove('pressed');
    if (state.made) {
      const p = personality(state.button);
      setTimeout(() => keySound(state.button, true), Math.max(0, Number(p.returnSoundMs) || FALLBACK_RETURN_MS));
    }
    try { state.button.releasePointerCapture(state.pointerId); } catch (_) {}
    pointers.delete(event.pointerId);
    assertKeyResetIfReady();
    return true;
  }

  function releaseEverything() {
    for (const state of Array.from(pointers.values())) {
      clearTimeout(state.timer);
      state.down = false;
      state.button.classList.remove('pressed');
      try { state.button.releasePointerCapture(state.pointerId); } catch (_) {}
      pointers.delete(state.pointerId);
    }
    assertKeyResetIfReady();
  }

  // Window capture executes before the document-capture handler in
  // flight-hardware-ui.js. PRO is deliberately allowed to continue downward.
  window.addEventListener('pointerdown', onPointerDown, {capture:true, passive:false});
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

  window.AGCDSKY = window.AGCDSKY || {};
  window.AGCDSKY.keyboardElectrical = Object.freeze({
    state: () => ({
      cycleLatched,
      down:pointers.size,
      electricalMade,
      electricalKeyCode,
      electricalMadeAt,
      keyResetPending:!!keyResetTimer,
      clockHandoffPending,
      minKeycodeHoldMs:MIN_KEYCODE_HOLD_MS,
      keys:Array.from(pointers.values()).map(s => ({key:s.button.dataset.key, accepted:s.accepted, made:s.made}))
    }),
    releaseAll: releaseEverything
  });
})();