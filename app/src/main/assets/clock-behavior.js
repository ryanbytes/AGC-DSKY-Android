(() => {
  'use strict';

  const api = window.AGCDSKY;
  const transitions = api?.runtimeTransitions;
  const input = api?.inputRuntime;
  const AGC_KEY = window.AGCDSKY_KEY_CODES;
  if (!api || !transitions || !input
      || typeof transitions.requestAgc !== 'function'
      || typeof transitions.mode !== 'function'
      || typeof transitions.clockRequested !== 'function'
      || typeof transitions.onBeforeClock !== 'function'
      || typeof input.ready !== 'function'
      || typeof input.keyMake !== 'function'
      || !AGC_KEY) return;

  // This layer owns only the document-level CLOCK keypad fallback. The
  // parser-loaded CM electrical interlock normally captures physical normal
  // keys earlier at window capture. Both paths share the same transition,
  // keycode and electrical-input services, so this fallback cannot grow a
  // second app/runtime/core interpretation.
  const pendingKeys = [];
  let promotionPromise = null;
  let promotionEpoch = 0;

  function cancelClockInput() {
    pendingKeys.length = 0;
    promotionEpoch++;
    promotionPromise = null;
  }

  async function drainClockInput(epoch) {
    try {
      await transitions.requestAgc('clock keypad fallback');
      if (epoch !== promotionEpoch || transitions.clockRequested()) return;
      if (transitions.mode() !== transitions.modes.AGC || !input.ready()) {
        throw new Error('AGC input runtime unavailable after clock keypad handoff');
      }
      while (pendingKeys.length && epoch === promotionEpoch && !transitions.clockRequested()) {
        const next = pendingKeys.shift();
        const code = AGC_KEY[next];
        if (code !== undefined) input.keyMake(code);
      }
      if (epoch === promotionEpoch && !transitions.clockRequested()
          && typeof api.scheduleAgcAutosave === 'function') {
        api.scheduleAgcAutosave('clock keypad handoff');
      }
    } catch (error) {
      if (epoch === promotionEpoch && !transitions.clockRequested()) {
        pendingKeys.length = 0;
        console.error('Clock-to-AGC keypad handoff', error);
      }
    } finally {
      // A canceled old drain must never clear a newer promotion Promise.
      if (epoch === promotionEpoch) promotionPromise = null;
    }
  }

  function promoteClockInput(key) {
    if (transitions.clockRequested()) return Promise.resolve(false);
    pendingKeys.push(key);
    if (!promotionPromise) {
      const epoch = promotionEpoch;
      promotionPromise = drainClockInput(epoch);
    }
    return promotionPromise;
  }

  document.addEventListener('pointerdown', event => {
    const key = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!key) return;
    let currentMode;
    try { currentMode = transitions.mode(); } catch (_) { return; }
    if (currentMode !== transitions.modes.CLOCK && currentMode !== transitions.modes.AGC_LOADING) return;

    // This is a fallback only. In the live CM path the parser-loaded electrical
    // interlock owns window capture first and stops propagation before here.
    event.preventDefault();
    event.stopPropagation();
    if (transitions.clockRequested()) return;
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 90);
    void promoteClockInput(key.dataset.key);
  }, {capture:true, passive:false});

  // If CLOCK is selected while a fallback promotion is awaiting AGC readiness,
  // invalidate that queue immediately. Its async continuation may still settle,
  // but the epoch check prevents any stale keycode or autosave from reappearing.
  transitions.onBeforeClock(cancelClockInput);

  const clockBehavior = Object.freeze({
    promoteClockInput,
    cancel:cancelClockInput,
    isPromoting:() => !!promotionPromise,
    pendingCount:() => pendingKeys.length,
    snapshot:() => ({
      mode:transitions.mode(),
      clockRequested:transitions.clockRequested(),
      promotionInFlight:!!promotionPromise,
      promotionEpoch,
      pendingKeys:pendingKeys.slice()
    })
  });
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_CLOCK_BEHAVIOR',clockBehavior,'clock-behavior publication');
})();
