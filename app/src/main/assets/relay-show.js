'use strict';

/*
 * RELAY SHOW
 *
 * Presentation-mode choreography for the Block II DSKY relay model. The show
 * deliberately uses the same channel-010 relay path, per-relay manufacturing
 * fingerprints, contact-bounce audio and 20-ms settled display boundary as the
 * normal DSKY. It does not add any brightness flare or fake segment animation.
 *
 * AGC execution is paused, never reset, while the show owns the DSKY. At the
 * end (or after STOP) the previously latched relay state and discrete outputs
 * are physically driven back in, then the exact previous clock/AGC task is
 * resumed.
 */
(() => {
  const button = document.getElementById('relay-show');
  if (!button || !window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;

  const ROWS_DOWN = Object.freeze([12,11,10,9,8,7,6,5,4,3,2,1]);
  const DISPLAY_ROWS_DOWN = Object.freeze([11,10,9,8,7,6,5,4,3,2,1]);
  const DISPLAY_ROWS_UP = Object.freeze([1,2,3,4,5,6,7,8,9,10,11]);
  const NON_DECIMAL_CODES = Object.freeze([1,2,4,5,6,7,8,9,10,11,12,13,14,16,17,18,20,22,23,24,26]);
  const V35_PLUS_ROWS = new Set([7,5,2]);
  const SHOW_TEMPO = 2.0;

  let active = false;
  let stopRequested = false;
  let saved = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  // Slow only the presentation choreography. Hardware settle/preflight and
  // task-restoration timing stay at their physical/safety values.
  const showSleep = ms => sleep(ms * SHOW_TEMPO);
  const status = text => { const el = document.getElementById('mode'); if (el) el.textContent = text; };
  const pair = (c, d, plus = false) => ((plus ? 1 : 0) << 10) | ((c & 0x1f) << 5) | (d & 0x1f);
  const v35Word = digit => pair(DIGIT_RELAY[String(digit)] || 0, DIGIT_RELAY[String(digit)] || 0, false);

  function ensureRunningDemo() {
    if (stopRequested) throw new Error('relay-show-stop');
  }

  function drive(row, low11) {
    decodeChannel10(((row & 0x0f) << 11) | (low11 & 0x7ff));
  }

  async function driveState(state, order = ROWS_DOWN, gapMs = 40) {
    for (const row of order) {
      ensureRunningDemo();
      drive(row, state[row] || 0);
      await showSleep(gapMs);
    }
  }

  function blankState() {
    const state = {};
    for (let row = 1; row <= 12; row++) state[row] = 0;
    return state;
  }

  function digitState(digit) {
    const code = DIGIT_RELAY[String(digit)] || 0;
    const state = {12:0};
    for (let row = 1; row <= 11; row++) {
      state[row] = pair(code, code, V35_PLUS_ROWS.has(row));
    }
    return state;
  }

  function fullState() {
    const state = digitState(8);
    // All six channel-010 condition-light outputs exercised by this face.
    state[12] = 0o674;
    return state;
  }

  function contactMatrixState(frame) {
    const state = {12:0};
    for (let row = 1; row <= 11; row++) {
      const a = NON_DECIMAL_CODES[(frame + row * 2) % NON_DECIMAL_CODES.length];
      const b = NON_DECIMAL_CODES[(frame * 3 + row * 5 + 4) % NON_DECIMAL_CODES.length];
      state[row] = pair(a, b, ((frame + row) & 1) === 0);
    }
    return state;
  }

  function captureSettledState() {
    const hardware = window.AGCDSKY.hardware();
    const latches = {};
    for (let row = 1; row <= 12; row++) {
      const hwWord = hardware && hardware.latches && hardware.latches[row];
      const fallback = agcRelayWords[row];
      latches[row] = (hwWord !== undefined ? hwWord : (fallback !== undefined ? fallback : 0)) & 0x7ff;
    }
    return {
      mode,
      modeLabel: document.getElementById('mode') ? document.getElementById('mode').textContent : '',
      coreRunning: !!(agcCore && agcCore.running),
      tickSound,
      verb,
      noun,
      entryMode,
      entry,
      clockDigits: JSON.parse(JSON.stringify(clockDigits)),
      clockRelayWords: {...clockRelayWords},
      ch11: agcCh11,
      ch13: agcCh13,
      ch163: agcCh163,
      latches
    };
  }

  async function preflight() {
    if (mode === 'agc-loading' || mode === 'relay-show' || dream) throw new Error('relay-show-unavailable');

    // Capture the scheduler state before pausing it.  The settled DSKY relay
    // snapshot is intentionally taken after the stop, but agcCore.stop() clears
    // agcCore.running, so reading that flag afterward would make restore think
    // the AGC had already been idle and leave the DSKY frozen after the show.
    const coreWasRunning = !!(mode === 'agc' && agcCore && agcCore.running);

    cancelLampTest();
    if (mode === 'agc' && agcCore) {
      // Durable checkpoint in case Android kills the process during a show.
      try { saveAgcState('relay show checkpoint'); } catch (_) {}
      agcCore.stop();
    }
    stopClockQueue();
    lampTestActive = true;

    // Let an already energized bank reach the documented 20-ms settled state
    // before we capture what must be restored after the show.
    await sleep(28);
    saved = captureSettledState();
    saved.coreRunning = coreWasRunning;

    mode = 'relay-show';
    stopRequested = false;
    button.textContent = 'STOP RELAY SHOW';

    // RELAY SHOW is explicitly an audible demonstration. Temporarily enable
    // relay sound without changing the user's saved RELAY CLICKS preference.
    tickSound = true;
    try { ensureAudio(); } catch (_) {}
  }

  async function bankSweep() {
    status('RELAY SHOW · BANK SWEEP');
    decodeChannel11(0);
    decodeChannel163(0);
    await driveState(blankState(), ROWS_DOWN, 32);
    await showSleep(120);

    const target = fullState();
    for (const row of ROWS_DOWN) {
      ensureRunningDemo();
      drive(row, target[row]);
      status(`RELAY SHOW · BANK ${row}`);
      await showSleep(52);
    }
    await showSleep(180);
  }

  async function digitChase() {
    status('RELAY SHOW · DIGIT CHASE');
    for (let digit = 0; digit <= 9; digit++) {
      const target = digitState(digit);
      for (const row of DISPLAY_ROWS_DOWN) {
        ensureRunningDemo();
        drive(row, target[row]);
        status(`RELAY SHOW · DIGIT ${digit} · BANK ${row}`);
        await showSleep(28);
      }
      await showSleep(65);
    }
  }

  async function contactBurst() {
    status('RELAY SHOW · CONTACT MATRIX');
    for (let frame = 0; frame < 8; frame++) {
      const target = contactMatrixState(frame);
      for (const row of DISPLAY_ROWS_DOWN) {
        ensureRunningDemo();
        drive(row, target[row]);
        await showSleep(26);
      }
      await showSleep(70);
    }
  }

  async function finale() {
    status('RELAY SHOW · FINALE');
    decodeChannel11(0);
    decodeChannel163(0);
    await driveState(blankState(), ROWS_DOWN, 30);
    await showSleep(90);

    const target = fullState();
    // Build upward through the numeric banks so the face fills in a visible
    // crescendo, then pull in the condition/annunciator relays last.
    for (const row of DISPLAY_ROWS_UP) {
      ensureRunningDemo();
      drive(row, target[row]);
      await showSleep(54);
    }
    drive(12, target[12]);
    await showSleep(70);
    decodeChannel11(0o46); // COMP ACTY, UPLINK ACTY, FLASH relay.
    await showSleep(80);
    decodeChannel163(0o730); // TEMP, KEY REL, OPR ERR, RESTART, STBY.
    await showSleep(1000);
  }

  async function restorePreviousTask() {
    if (!saved) return;
    status('RELAY SHOW · RESTORING PREVIOUS TASK');

    // Restore through the same physical bank path rather than teleporting the
    // SVG. That means the return cascade has authentic relay identities/sound.
    for (const row of ROWS_DOWN) {
      drive(row, saved.latches[row] || 0);
      await sleep(40);
    }
    decodeChannel11(saved.ch11 || 0);
    decodeChannel163(saved.ch163 || 0);
    agcCh13 = saved.ch13 || 0;
    await sleep(45);

    verb = saved.verb;
    noun = saved.noun;
    entryMode = saved.entryMode;
    entry = saved.entry;
    clockDigits = JSON.parse(JSON.stringify(saved.clockDigits));
    clockRelayWords = {...saved.clockRelayWords};
    tickSound = saved.tickSound;
    lampTestActive = false;
    mode = saved.mode;

    if (saved.mode === 'clock') {
      // The return cascade restores the exact prior face first. Normal clock
      // service then catches up to current NTP-corrected time on its next pass.
      stopClockQueue();
    } else if (saved.mode === 'agc' && agcCore && saved.coreRunning && appVisible) {
      // stop()/start() does not reset yaAGC memory. Execution resumes the exact
      // flight-software task that was running when RELAY SHOW was pressed.
      agcCore.start(1);
    }

    status(saved.modeLabel || (saved.mode === 'clock' ? clockTimeLabel() : 'AGC'));
  }

  async function runShow() {
    if (active) {
      stopRequested = true;
      status('RELAY SHOW · RESTORING PREVIOUS TASK');
      return;
    }

    active = true;
    try {
      await preflight();
      await bankSweep();
      await digitChase();
      await contactBurst();
      await finale();
    } catch (error) {
      if (!error || (error.message !== 'relay-show-stop' && error.message !== 'relay-show-unavailable')) {
        console.error('Relay show failed', error);
      }
    } finally {
      try { await restorePreviousTask(); }
      catch (error) { console.error('Relay show restore failed', error); }
      stopRequested = false;
      active = false;
      saved = null;
      button.textContent = 'RELAY SHOW';
      try { showControls(); } catch (_) {}
    }
  }

  button.addEventListener('click', () => {
    runShow();
    try { showControls(); } catch (_) {}
  });

  window.AGCDSKY.relayShow = Object.freeze({
    start: runShow,
    stop: () => { if (active) stopRequested = true; },
    active: () => active
  });
})();
