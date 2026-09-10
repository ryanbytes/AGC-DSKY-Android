(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api) return;

  // Clock mode is intentionally synthetic.  In AGC mode COMP ACTY remains
  // exclusively channel-011 driven by app.js; this helper never touches it.
  const comp = document.querySelector('[data-lamp="comp"]');
  let compTimer = 0;

  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const clockMode = () => {
    try { return api.appStatus().mode === 'clock'; }
    catch (_) { return false; }
  };

  function setClockComp(on) {
    if (!comp || !clockMode()) return;
    comp.classList.toggle('on', !!on);
  }

  function scheduleClockCompIdle() {
    clearTimeout(compTimer);
    const longPause = Math.random() < 0.14;
    const delay = longPause ? randomBetween(2200, 5200) : randomBetween(260, 1450);
    compTimer = setTimeout(startClockCompBurst, delay);
  }

  function startClockCompBurst() {
    if (!clockMode()) {
      // Do not clear or otherwise drive COMP ACTY outside clock mode.  The
      // real AGC/channel decoder owns the lamp there.
      compTimer = setTimeout(startClockCompBurst, 500);
      return;
    }

    let pulses = 1 + Math.floor(Math.random() * 5);
    const pulse = () => {
      if (!clockMode()) {
        compTimer = setTimeout(startClockCompBurst, 500);
        return;
      }

      setClockComp(true);
      const held = Math.random() < 0.12
        ? randomBetween(260, 620)
        : randomBetween(45, 165);
      compTimer = setTimeout(() => {
        if (!clockMode()) {
          compTimer = setTimeout(startClockCompBurst, 500);
          return;
        }
        setClockComp(false);
        pulses--;
        if (pulses <= 0) {
          scheduleClockCompIdle();
          return;
        }
        compTimer = setTimeout(pulse, randomBetween(28, 135));
      }, held);
    };
    pulse();
  }

  // The clock is a passive display.  The first DSKY keypad entry hands the
  // panel to the real AGC and forwards that same key once Comanche is ready.
  // Keys arriving while the WASM/rope load is in progress are queued in order.
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

    // Prevent a synthetic clock COMP pulse from visually leaking into the
    // AGC handoff. app.js takes ownership from this point forward.
    if (comp && clockMode()) comp.classList.remove('on');

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

  scheduleClockCompIdle();
})();
