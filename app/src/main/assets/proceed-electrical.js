'use strict';

/*
 * Apollo Block II DSKY PRO maintained-contact controller.
 *
 * PRO is electrically separate from the 18-key channel-015 matrix. The AGC
 * interface exposes it as active-low input channel 032 bit 020000: held = 0,
 * released = 020000. This layer owns only the physical pointer/lifecycle
 * contact. AgcCore.proceedKey() remains the electrical primitive.
 */
(() => {
  if (window.__DSKY_PROCEED_ELECTRICAL__) return;
  window.__DSKY_PROCEED_ELECTRICAL__ = true;

  const api = window.AGCDSKY;
  const pro = document.querySelector('[data-key="P"]');
  let proPointer = null;

  function currentMode() {
    try {
      if (api && typeof api.appStatus === 'function') {
        return String(api.appStatus().mode || '');
      }
    } catch (_) {}
    try { return typeof mode !== 'undefined' ? String(mode) : ''; }
    catch (_) { return ''; }
  }

  function currentCore() {
    try {
      return api && typeof api.getCore === 'function' ? api.getCore() : null;
    } catch (_) { return null; }
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
    const core = currentCore();
    if (currentMode() === 'agc' && core) {
      try { core.proceedKey(false); }
      catch (error) { reportFailure(error); }
    }
    return true;
  }

  function onPointerDown(event) {
    if (currentMode() !== 'agc') return;
    const core = currentCore();
    if (!core || typeof core.proceedKey !== 'function') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (proPointer !== null) return;

    proPointer = event.pointerId;
    pro.classList.add('pressed');
    try { if (pro.setPointerCapture) pro.setPointerCapture(event.pointerId); } catch (_) {}
    try { core.proceedKey(true); }
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
  if (api) api.proceedElectrical = controller;
})();
