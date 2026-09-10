(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api) return;

  // Clock mode remains visually passive. COMP ACTY is not synthesized here;
  // once the real AGC is active, app.js owns that lamp from channel 011.
  const AGC_KEY = Object.freeze({
    '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
    V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
  });
  const pendingKeys = [];
  let promoting = false;

  async function promoteClockInput(key) {
    pendingKeys.push(key);
    if (promoting) return;
    promoting = true;

    try {
      await api.enterAgc();
      const core = api.getCore && api.getCore();
      const status = api.appStatus();
      if (!core || status.mode !== 'agc') {
        pendingKeys.length = 0;
        return;
      }
      while (pendingKeys.length) {
        const next = pendingKeys.shift();
        const code = AGC_KEY[next];
        if (code !== undefined) core.keyPress(code);
      }
      if (typeof api.scheduleAgcAutosave === 'function') api.scheduleAgcAutosave('clock keypad handoff');
    } catch (error) {
      pendingKeys.length = 0;
      console.error('Clock-to-AGC keypad handoff', error);
    } finally {
      promoting = false;
    }
  }

  document.addEventListener('pointerdown', event => {
    const key = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!key) return;
    let mode = '';
    try { mode = api.appStatus().mode; } catch (_) { return; }
    if (mode !== 'clock' && mode !== 'agc-loading') return;

    // Stop app.js's local clock-entry handler from consuming the key. Other
    // capture listeners on document still receive the completed user gesture.
    event.preventDefault();
    event.stopPropagation();
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 90);
    promoteClockInput(key.dataset.key);
  }, {capture:true, passive:false});

  window.AGCDSKY_CLOCK_BEHAVIOR = {
    promoteClockInput,
    isPromoting: () => promoting,
    pendingCount: () => pendingKeys.length
  };
})();
