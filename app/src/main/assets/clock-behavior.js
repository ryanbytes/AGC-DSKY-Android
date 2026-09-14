(() => {
  'use strict';

  const api = window.AGCDSKY;
  const transitions = api?.runtimeTransitions;
  const AGC_KEY = window.AGCDSKY_KEY_CODES;
  if (!api || !transitions
      || typeof transitions.requestAgc !== 'function'
      || typeof transitions.mode !== 'function'
      || typeof transitions.core !== 'function'
      || !AGC_KEY) return;

  // This layer owns only the document-level CLOCK keypad fallback. The live
  // CM electrical interlock normally captures physical normal keys earlier at
  // window capture and uses the same shared runtime transition service/key map.
  // Runtime mode/core authority also stays in runtime-transitions.js so this
  // fallback cannot grow a second appStatus/getCore interpretation.
  const pendingKeys = [];
  let promotionPromise = null;

  async function drainClockInput() {
    try {
      await transitions.requestAgc('clock keypad fallback');
      const core = transitions.core();
      if (!core || transitions.mode() !== transitions.modes.AGC) {
        throw new Error('AGC core unavailable after clock keypad handoff');
      }
      while (pendingKeys.length) {
        const next = pendingKeys.shift();
        const code = AGC_KEY[next];
        if (code !== undefined) core.keyPress(code);
      }
      if (typeof api.scheduleAgcAutosave === 'function') {
        api.scheduleAgcAutosave('clock keypad handoff');
      }
    } catch (error) {
      pendingKeys.length = 0;
      console.error('Clock-to-AGC keypad handoff', error);
    } finally {
      promotionPromise = null;
    }
  }

  function promoteClockInput(key) {
    pendingKeys.push(key);
    if (!promotionPromise) promotionPromise = drainClockInput();
    return promotionPromise;
  }

  document.addEventListener('pointerdown', event => {
    const key = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!key) return;
    let currentMode;
    try { currentMode = transitions.mode(); } catch (_) { return; }
    if (currentMode !== transitions.modes.CLOCK && currentMode !== transitions.modes.AGC_LOADING) return;

    // Before the CM electrical interlock is dynamically installed, this keeps
    // app.js's synthetic clock editor from consuming a normal DSKY contact.
    event.preventDefault();
    event.stopPropagation();
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 90);
    void promoteClockInput(key.dataset.key);
  }, {capture:true, passive:false});

  const clockBehavior = Object.freeze({
    promoteClockInput,
    isPromoting:() => !!promotionPromise,
    pendingCount:() => pendingKeys.length,
    snapshot:() => ({
      mode:transitions.mode(),
      promotionInFlight:!!promotionPromise,
      pendingKeys:pendingKeys.slice()
    })
  });
  window.AGCDSKY_CLOCK_BEHAVIOR = clockBehavior;
  api.clockBehavior = clockBehavior;
})();
