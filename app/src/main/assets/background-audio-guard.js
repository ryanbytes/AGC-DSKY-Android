'use strict';

// Late lifecycle guards. This file loads after the hardware and relay-identity
// layers, so it is also the right place to prevent stale relay/UI state from
// repainting the visible DSKY after those layers have initialized.
(() => {
  const audibleNow = () => !dream && !document.hidden && appVisible;

  if (typeof emitTick === 'function') {
    const audibleEmitTick = emitTick;
    emitTick = function guardedRelayTick(ctx, when, strength) {
      if (!audibleNow()) return;
      return audibleEmitTick(ctx, when, strength);
    };
  }

  if (typeof playRelayBurst === 'function') {
    const audiblePlayRelayBurst = playRelayBurst;
    playRelayBurst = function guardedRelayBurst(count) {
      if (!audibleNow()) return;
      return audiblePlayRelayBurst(count);
    };
  }

  /*
   * PHONE CLOCK uses clockDigits as its visual source of truth. The physical
   * relay layer still updates agcDisplay at the 20-ms settle boundary because
   * the same bank model is shared with real AGC operation. Without this guard,
   * that update can briefly repaint a lower register from stale/partially
   * unrelated agcDisplay contents immediately before the clockDigits callback
   * repaints it again. During normal clock operation, route any such register
   * render back to clockDigits. Synthetic V35 is exempt because it deliberately
   * displays the relay-test state while lampTestActive is true.
   */
  if (typeof renderAgcReg === 'function' && typeof renderClockReg === 'function') {
    const settledAgcRender = renderAgcReg;
    renderAgcReg = function sourceConsistentRegisterRender(name) {
      if (typeof mode !== 'undefined' && mode === 'clock' &&
          !(typeof lampTestActive !== 'undefined' && lampTestActive)) {
        return renderClockReg(name);
      }
      return settledAgcRender(name);
    };
  }

  /*
   * A saved AGC snapshot contains both the physical relay words and a cached UI
   * projection. The relay words are authoritative; restoring the cached display
   * independently can resurrect a transient/inconsistent character state. Build
   * agcDisplay from the saved relay banks instead and reject malformed snapshots
   * rather than trusting duplicate visual state.
   */
  function snapshotWord(words, row) {
    if (!Object.prototype.hasOwnProperty.call(words, row) &&
        !Object.prototype.hasOwnProperty.call(words, String(row))) return 0;
    const raw = Object.prototype.hasOwnProperty.call(words, row) ? words[row] : words[String(row)];
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`snapshot relay row ${row} is invalid`);
    return value & 0o3777;
  }

  function clearSnapshotDisplayProjection() {
    agcDisplay.prog.fill(' ');
    agcDisplay.verb.fill(' ');
    agcDisplay.noun.fill(' ');
    for (const name of ['r1','r2','r3']) {
      agcDisplay[name].digits.fill(' ');
      agcDisplay[name].plus = false;
      agcDisplay[name].minus = false;
    }
  }

  function rebuildSnapshotDisplayFromRelays(words) {
    clearSnapshotDisplayProjection();

    let w = snapshotWord(words, 11);
    agcDisplay.prog[0] = relayDigit((w >> 5) & 0o37);
    agcDisplay.prog[1] = relayDigit(w & 0o37);

    w = snapshotWord(words, 10);
    agcDisplay.verb[0] = relayDigit((w >> 5) & 0o37);
    agcDisplay.verb[1] = relayDigit(w & 0o37);

    w = snapshotWord(words, 9);
    agcDisplay.noun[0] = relayDigit((w >> 5) & 0o37);
    agcDisplay.noun[1] = relayDigit(w & 0o37);

    w = snapshotWord(words, 8);
    agcDisplay.r1.digits[0] = relayDigit(w & 0o37);

    w = snapshotWord(words, 7);
    agcDisplay.r1.plus = !!((w >> 10) & 1);
    agcDisplay.r1.digits[1] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r1.digits[2] = relayDigit(w & 0o37);

    w = snapshotWord(words, 6);
    agcDisplay.r1.minus = !!((w >> 10) & 1);
    agcDisplay.r1.digits[3] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r1.digits[4] = relayDigit(w & 0o37);

    w = snapshotWord(words, 5);
    agcDisplay.r2.plus = !!((w >> 10) & 1);
    agcDisplay.r2.digits[0] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r2.digits[1] = relayDigit(w & 0o37);

    w = snapshotWord(words, 4);
    agcDisplay.r2.minus = !!((w >> 10) & 1);
    agcDisplay.r2.digits[2] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r2.digits[3] = relayDigit(w & 0o37);

    w = snapshotWord(words, 3);
    agcDisplay.r2.digits[4] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r3.digits[0] = relayDigit(w & 0o37);

    w = snapshotWord(words, 2);
    agcDisplay.r3.plus = !!((w >> 10) & 1);
    agcDisplay.r3.digits[1] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r3.digits[2] = relayDigit(w & 0o37);

    w = snapshotWord(words, 1);
    agcDisplay.r3.minus = !!((w >> 10) & 1);
    agcDisplay.r3.digits[3] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r3.digits[4] = relayDigit(w & 0o37);
  }

  if (typeof applySnapshotUi === 'function') {
    applySnapshotUi = function relayAuthoritativeSnapshotUi(ui) {
      if (!ui || typeof ui !== 'object' || !ui.relayWords || typeof ui.relayWords !== 'object') {
        throw new Error('snapshot UI is missing authoritative relay words');
      }

      Object.keys(agcRelayWords).forEach(key => delete agcRelayWords[key]);
      for (let row = 1; row <= 12; row++) {
        if (Object.prototype.hasOwnProperty.call(ui.relayWords, row) ||
            Object.prototype.hasOwnProperty.call(ui.relayWords, String(row))) {
          agcRelayWords[row] = snapshotWord(ui.relayWords, row);
        }
      }

      rebuildSnapshotDisplayFromRelays(agcRelayWords);
      agcCh11 = Number(ui.ch11) & 0o77777;
      agcCh13 = Number(ui.ch13) & 0o77777;
      agcCh163 = Number(ui.ch163) & 0o77777;
      return true;
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !dream && typeof stopClockQueue === 'function') {
      stopClockQueue();
    }
  });
})();
