'use strict';

/*
 * Apollo Block II DSKY PRO maintained-contact controller.
 *
 * PRO is electrically separate from the 18-key channel-015 matrix. The AGC
 * interface exposes it as active-low input channel 032 bit 020000: held = 0,
 * released = 020000. This layer owns only physical pointer/lifecycle state;
 * dsky-input-runtime.js owns the electrical primitive.
 */
(() => {
  if (window.__DSKY_PROCEED_ELECTRICAL__) return;
  window.__DSKY_PROCEED_ELECTRICAL__ = true;

  const api = window.AGCDSKY;
  const runtime = api?.runtimeTransitions;
  const input = api?.inputRuntime;
  if (!api || !runtime || !input
      || typeof runtime.mode !== 'function'
      || typeof input.ready !== 'function'
      || typeof input.proceed !== 'function') return;

  const pro = document.querySelector('[data-key="P"]');
  let proPointer = null;

  function currentMode() {
    try { return String(runtime.mode() || ''); }
    catch (_) { return ''; }
  }

  function reportFailure(error) {
    try {
      if (typeof agcFailure === 'function') agcFailure(error);
      else console.error('DSKY PRO contact failed', error);
    } catch (_) {
      console.error('DSKY PRO contact failed', error);
    }
  }

  function releaseProceed() {
    if (proPointer === null) return false;
    proPointer = null;
    if (pro) pro.classList.remove('pressed');
    if (currentMode() === runtime.modes.AGC && input.ready()) {
      try { input.proceed(false); }
      catch (error) { reportFailure(error); }
    }
    return true;
  }

  function onPointerDown(event) {
    if (currentMode() !== runtime.modes.AGC || !input.ready()) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (proPointer !== null) return;

    proPointer = event.pointerId;
    pro.classList.add('pressed');
    try { if (pro.setPointerCapture) pro.setPointerCapture(event.pointerId); } catch (_) {}
    try { input.proceed(true); }
    catch (error) {
      releaseProceed();
      reportFailure(error);
    }
  }

  function onPointerUp(event) {
    if (event.pointerId !== proPointer) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    releaseProceed();
  }

  function onPointerCancel(event) {
    if (event.pointerId !== proPointer) return;
    event.stopImmediatePropagation();
    releaseProceed();
  }

  if (pro) {
    pro.addEventListener('pointerdown', onPointerDown, true);
    pro.addEventListener('pointerup', onPointerUp, true);
    pro.addEventListener('pointercancel', onPointerCancel, true);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseProceed();
  });

  // Preserve the historical invariant that entering CLOCK releases PRO before
  // app.js changes mode. app.js is a classic script; replacing the global
  // enterClock binding therefore updates its already-installed callers too.
  if (typeof window.enterClock === 'function') {
    const baseEnterClock = window.enterClock;
    window.enterClock = function proceedSafeEnterClock(...args) {
      releaseProceed();
      return baseEnterClock.apply(this, args);
    };
  }

  const controller = Object.freeze({
    release:releaseProceed,
    state:() => ({
      held:proPointer !== null,
      pointerId:proPointer,
      mode:currentMode()
    })
  });
  window.AGCDSKY_PROCEED = controller;
  api.proceedElectrical = controller;
})();
