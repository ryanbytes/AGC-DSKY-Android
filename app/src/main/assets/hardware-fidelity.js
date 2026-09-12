'use strict';

/*
 * Apollo Block II DSKY hardware-fidelity layer.
 *
 * Timing model follows the Apollo AGC display timing model:
 *   - normal display service is phase-locked to the 120 ms T4RUPT cadence;
 *   - a selected relay row is driven for 20 ms so its latching relays settle;
 *   - the drive is then removed for 20 ms;
 *   - the next dirty row can therefore begin 40 ms after the previous row.
 *
 * In AGC mode V35 is not synthesized here: the real Comanche 055 program,
 * yaAGC I/O, and yaAGC DSKY hardware-state output are authoritative.  The
 * synthetic phone-clock V35 helpers below are retained only for legacy code
 * compatibility and are no longer reachable from clock-mode command entry.
 */
(() => {
  const T4_MS = 120;
  const RELAY_DRIVE_MS = 20;
  const DIRTY_ROW_START_MS = 40;
  const V35_HOLD_MS = 5000;
  const DSKY_FLASH_QUANTUM_MS = 320;
  const DSKY_FLASH_PHASES = 4; // 1.28 s, 75% on / 25% off.
  const V35_ORDER = Object.freeze([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  const t4Epoch = performance.now();
  const scalerEpoch = performance.now();

  const HAS_CLOCK_GROUPS = typeof CLOCK_GROUPS !== 'undefined';
  const CLOCK_ROWS = HAS_CLOCK_GROUPS
    ? CLOCK_GROUPS.map(group => ({ relay: group.relay, cells: group.cells, native: group }))
    : CLOCK_RELAYS.map(relay => ({
        relay,
        cells: (CHANNEL10_DIGITS[relay] || []).map(([name, index]) => [name, index]),
        native: relay
      }));

  function clockLow11(row, want) {
    return (HAS_CLOCK_GROUPS ? clockWord(row.native, want) : clockWord(row.relay, want)) & 0o3777;
  }

  function relayOfJob(job) {
    return job.group ? job.group.relay : job.relay;
  }

  function cellsOfJob(job) {
    if (job.group) return job.group.cells;
    return (CHANNEL10_DIGITS[job.relay] || []).map(([name, index]) => [name, index]);
  }

  const hw = {
    latches: Object.create(null),
    relayGeneration: Object.create(null),
    activeDrive: 0,
    timers: new Set(),
    clockToken: 0,
    v35Token: 0,
    v35FlashEnabled: false,
    v35DirectKeyRel: false,
    v35DirectOperErr: false,
    v35FlashTimer: 0,
    lastWrite: null,
    // Physical non-latching DSKY relays.  KEY REL and OPR ERR are driven by
    // pulse-modulated lines, so these states intentionally follow channel 163
    // rather than merely the raw channel-11 command bits.
    auxRelays: Object.assign(Object.create(null), {
      comp: false, uplink: false, temp: false, keyrel: false,
      oprerr: false, flash: false, restart: false, stby: false
    })
  };

  function later(fn, ms) {
    const id = setTimeout(() => {
      hw.timers.delete(id);
      fn();
    }, Math.max(0, ms));
    hw.timers.add(id);
    return id;
  }

  function clearHardwareTimers() {
    for (const id of hw.timers) clearTimeout(id);
    hw.timers.clear();
    if (hw.v35FlashTimer) clearTimeout(hw.v35FlashTimer);
    hw.v35FlashTimer = 0;
  }

  function phaseDelay(period, epoch) {
    const elapsed = Math.max(0, performance.now() - epoch);
    const phase = elapsed % period;
    return phase < 0.25 ? 0 : period - phase;
  }

  function nextT4Delay() {
    return phaseDelay(T4_MS, t4Epoch);
  }

  function popcount(value) {
    let v = value & 0o3777, n = 0;
    while (v) { v &= v - 1; n++; }
    return n;
  }

  // Individual latching relays do not all finish their mechanical travel at
  // exactly the same instant.  The DSKY interface allows a full 20 ms for the
  // selected bank to settle.  Use a fixed per-armature travel-time fingerprint
  // (rather than random/evenly spaced fake clicks) so a changed bank produces
  // the short irregular rattle heard from real relay hardware.
  const ARMATURE_SETTLE_MS = Object.freeze([
    6.2, 11.7, 8.4, 13.6, 7.1, 15.0, 9.5, 12.5, 5.6, 14.3, 10.5
  ]);

  function relayArmatureClack(bit, turningOn, delayMs) {
    if (!tickSound) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const schedule = () => {
      // Use the shared relay click synthesizer. relay-audio-refine.js replaces
      // emitTick() with the current dry/high-frequency contact sound, so the
      // hardware-fidelity layer must not add its own low-frequency body tone.
      const when = ctx.currentTime + Math.max(0.001, delayMs / 1000);
      const strength = turningOn ? 0.66 : 0.58;
      emitTick(ctx, when, strength);
    };
    if (ctx.state === 'running') schedule();
    else ctx.resume().then(schedule).catch(() => {});
  }

  function changedArmatures(prior, target) {
    const out = [];
    const diff = (prior ^ target) & 0o3777;
    for (let bit = 0; bit < 11; bit++) {
      const mask = 1 << bit;
      if (!(diff & mask)) continue;
      // Pair each bit with the measured-budget style travel time.  Sort below
      // so visible intermediate states follow actual armature completion.
      out.push({
        bit,
        mask,
        on: !!(target & mask),
        delay: ARMATURE_SETTLE_MS[bit]
      });
    }
    out.sort((a, b) => a.delay - b.delay || a.bit - b.bit);
    return out;
  }


  /*
   * The DSKY also contains non-latching relays for the discrete indicators and
   * flash control.  Unlike the 11-contact latching numeric banks, each of these
   * is a single relay and therefore produces one mechanical make/break event
   * when its coil state changes.  Multiple relays commanded on the same edge
   * are rendered as one composite clack with strength proportional to count.
   *
   * AGCIS 30-145C is explicit that KEY REL and OPR ERROR are pulse modulated,
   * while FLASH is a separate relay that merely enables the V/N flash circuit.
   * Therefore KEY REL/OPR ERR click on every 1.28-s flash edge, but the V/N
   * digits do NOT actuate a relay on every blink.  The FLASH relay clicks only
   * when flashing is enabled or disabled.
   */
  function auxRelayClack(engaging, releasing) {
    const count = Math.max(0, engaging | 0) + Math.max(0, releasing | 0);
    if (!tickSound || count <= 0) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const play = () => {
      // Auxiliary relays use the same dry contact synthesizer. No separate
      // armature/body oscillator or broadband thump is added here.
      const strength = Math.min(0.90, 0.62 + 0.08 * Math.sqrt(Math.min(6, count)));
      emitTick(ctx, ctx.currentTime + 0.001, strength);
    };
    if (ctx.state === 'running') play(); else ctx.resume().then(play).catch(() => {});
  }

  const AUX_VISUAL = Object.freeze({
    comp: 'comp', uplink: 'uplink', temp: 'temp', keyrel: 'keyrel',
    oprerr: 'oprerr', restart: 'restart', stby: 'stby'
  });

  function setAuxRelays(next, render = true) {
    let engaging = 0, releasing = 0;
    for (const [name, requested] of Object.entries(next || {})) {
      if (!Object.prototype.hasOwnProperty.call(hw.auxRelays, name)) continue;
      const on = !!requested;
      const before = !!hw.auxRelays[name];
      if (before !== on) {
        if (on) engaging++; else releasing++;
        hw.auxRelays[name] = on;
      }
      if (render && AUX_VISUAL[name]) setLamp(AUX_VISUAL[name], on);
    }
    auxRelayClack(engaging, releasing);
  }

  // PHONE CLOCK convenience deliberately leaves COMP ACTY quiescent.
  // The lamp is reserved for real AGC channel-011 output in AGC mode and
  // the explicit V35/lamp-test path in synthetic clock mode.

  function low11ForPair(text) {
    const s = String(text || '').padEnd(2, ' ').slice(0, 2);
    return ((DIGIT_RELAY[s[0]] || 0) << 5) | (DIGIT_RELAY[s[1]] || 0);
  }

  function targetClockState(commandVerb = verb, commandNoun = noun) {
    const want = desiredClockDigits();
    const state = {
      11: low11ForPair('00'),
      10: low11ForPair(commandVerb),
      9: low11ForPair(commandNoun),
      12: 0
    };
    for (const row of CLOCK_ROWS) state[row.relay] = clockLow11(row, want);
    return { state, want };
  }

  function currentClockLatchState(commandVerb = verb, commandNoun = noun) {
    const state = {
      11: low11ForPair('00'),
      10: low11ForPair(commandVerb),
      9: low11ForPair(commandNoun),
      12: Object.prototype.hasOwnProperty.call(hw.latches, 12) ? hw.latches[12] : 0
    };
    for (const row of CLOCK_ROWS) {
      state[row.relay] = (clockRelayWords[row.relay] ?? 0) & 0o3777;
    }
    return state;
  }

  function v35State() {
    const eight = DIGIT_RELAY['8'];
    const state = {};
    for (let relay = 1; relay <= 11; relay++) {
      const plus = relay === 2 || relay === 5 || relay === 7;
      state[relay] = (plus ? 0o2000 : 0) | (eight << 5) | eight;
    }
    // CM/Comanche 055 TSTCON2 state.
    state[12] = 0o650;
    return state;
  }

  function applyRelayLow11(relay, low11) {
    const b = (low11 >> 10) & 1;
    const c = (low11 >> 5) & 0o37;
    const d = low11 & 0o37;
    switch (relay) {
      case 12:
        setLamp('vel', !!(low11 & 0o00004));
        setLamp('noatt', !!(low11 & 0o00010));
        setLamp('alt', !!(low11 & 0o00020));
        setLamp('gimbal', !!(low11 & 0o00040));
        setLamp('tracker', !!(low11 & 0o00200));
        setLamp('prog', !!(low11 & 0o00400));
        break;
      case 11:
        agcDisplay.prog[0] = relayDigit(c); agcDisplay.prog[1] = relayDigit(d);
        set2('prog', agcDisplay.prog.join(''));
        break;
      case 10:
        agcDisplay.verb[0] = relayDigit(c); agcDisplay.verb[1] = relayDigit(d);
        set2('verb', agcDisplay.verb.join(''));
        break;
      case 9:
        agcDisplay.noun[0] = relayDigit(c); agcDisplay.noun[1] = relayDigit(d);
        set2('noun', agcDisplay.noun.join(''));
        break;
      case 8:
        agcDisplay.r1.digits[0] = relayDigit(d); renderAgcReg('r1');
        break;
      case 7:
        agcDisplay.r1.plus = !!b; agcDisplay.r1.digits[1] = relayDigit(c); agcDisplay.r1.digits[2] = relayDigit(d); renderAgcReg('r1');
        break;
      case 6:
        agcDisplay.r1.minus = !!b; agcDisplay.r1.digits[3] = relayDigit(c); agcDisplay.r1.digits[4] = relayDigit(d); renderAgcReg('r1');
        break;
      case 5:
        agcDisplay.r2.plus = !!b; agcDisplay.r2.digits[0] = relayDigit(c); agcDisplay.r2.digits[1] = relayDigit(d); renderAgcReg('r2');
        break;
      case 4:
        agcDisplay.r2.minus = !!b; agcDisplay.r2.digits[2] = relayDigit(c); agcDisplay.r2.digits[3] = relayDigit(d); renderAgcReg('r2');
        break;
      case 3:
        agcDisplay.r2.digits[4] = relayDigit(c); agcDisplay.r3.digits[0] = relayDigit(d); renderAgcReg('r2'); renderAgcReg('r3');
        break;
      case 2:
        agcDisplay.r3.plus = !!b; agcDisplay.r3.digits[1] = relayDigit(c); agcDisplay.r3.digits[2] = relayDigit(d); renderAgcReg('r3');
        break;
      case 1:
        agcDisplay.r3.minus = !!b; agcDisplay.r3.digits[3] = relayDigit(c); agcDisplay.r3.digits[4] = relayDigit(d); renderAgcReg('r3');
        break;
    }
  }

  function beginRelayDrive(relay, low11, render = true) {
    low11 &= 0o3777;
    const prior = Object.prototype.hasOwnProperty.call(hw.latches, relay) ? hw.latches[relay] : 0;
    const motions = changedArmatures(prior, low11);
    const changed = motions.length;
    const generation = (hw.relayGeneration[relay] || 0) + 1;
    hw.relayGeneration[relay] = generation;
    hw.activeDrive = relay;
    hw.lastWrite = { relay, low11, changed, at: performance.now() };

    // Do not invent visible sub-20-ms contact ordering.  The surviving Apollo
    // documentation specifies the relay-bank drive/settling interval but not a
    // per-armature optical transition chronology for this individual DSKY.
    // Keep the audible armature events inside that documented interval, but
    // expose only the guaranteed latched state at the 20-ms settle boundary.
    for (const motion of motions) relayArmatureClack(motion.bit, motion.on, motion.delay);

    later(() => {
      if (hw.relayGeneration[relay] !== generation) return;
      hw.latches[relay] = low11;
      agcRelayWords[relay] = low11;
      if (render) applyRelayLow11(relay, low11);
      if (hw.activeDrive === relay) hw.activeDrive = 0;
    }, RELAY_DRIVE_MS);
  }


  // Real yaAGC output: preserve the original software's timing.  Channel 010
  // value zero is the physical relay-drive-off word and must not be decoded as
  // an invalid row or as a display clear.
  decodeChannel10 = function hardwareDecodeChannel10(value) {
    const word = value & 0o77777;
    const relay = (word >> 11) & 0o17;
    if (relay === 0) {
      hw.activeDrive = 0;
      hw.lastWrite = { relay: 0, low11: 0, changed: 0, at: performance.now() };
      return true;
    }
    if (relay < 1 || relay > 12) return false;
    beginRelayDrive(relay, word & 0o3777, true);
    return true;
  };


  // Raw channel 11 directly controls COMP ACTY, UPLINK ACTY and the FLASH
  // relay.  The raw KEY REL/OPR ERR bits are not used for relay sound here:
  // their actual coil drive is pulse-modulated by hardware and appears in the
  // fictitious channel 163 output from yaAGC.
  const originalDecodeChannel11 = decodeChannel11;
  decodeChannel11 = function hardwareDecodeChannel11(value) {
    const word = value & 0o77777;
    setAuxRelays({
      comp: !!(word & 0o00002),
      uplink: !!(word & 0o00004),
      flash: !!(word & 0o00040)
    }, false);
    return originalDecodeChannel11.call(this, value);
  };

  // Channel 163 is yaAGC's post-hardware DSKY state.  Its KEY REL and OPR ERR
  // bits already include the 1.28-s / 75%-duty pulse modulation, so a transition
  // here is a real non-latching relay coil transition and should be audible.
  const originalDecodeChannel163 = decodeChannel163;
  decodeChannel163 = function hardwareDecodeChannel163(value) {
    const word = value & 0o77777;
    setAuxRelays({
      temp: !!(word & 0o00010),
      keyrel: !!(word & 0o00020),
      oprerr: !!(word & 0o00100),
      restart: !!(word & 0o00200),
      stby: !!(word & 0o00400)
    }, false);
    return originalDecodeChannel163.call(this, value);
  };

  const originalResetAgcFace = resetAgcFace;
  resetAgcFace = function hardwareResetAgcFace(...args) {
    for (const key of Object.keys(hw.latches)) delete hw.latches[key];
    for (const key of Object.keys(hw.relayGeneration)) delete hw.relayGeneration[key];
    hw.activeDrive = 0;
    for (const key of Object.keys(hw.auxRelays)) hw.auxRelays[key] = false;
    return originalResetAgcFace.apply(this, args);
  };

  // Synthetic phone-clock display uses the same T4/QUIKDSP physical cadence.
  const originalStopClockQueue = stopClockQueue;
  stopClockQueue = function hardwareStopClockQueue(...args) {
    hw.clockToken++;
    return originalStopClockQueue.apply(this, args);
  };

  runRelayQueue = function hardwareRunRelayQueue() {
    // A full DSPTAB pass loads DSPCNT=10 and scans downward, so the
    // corresponding relay words run 11 -> 1 (top of the DSKY downward).
    relayQueue.sort((a, b) => relayOfJob(b) - relayOfJob(a));
    const token = ++hw.clockToken;
    const startDelay = nextT4Delay();
    const step = () => {
      if (token !== hw.clockToken || mode !== 'clock' || lampTestActive) {
        relayBusy = false;
        return;
      }
      const job = relayQueue.shift();
      if (!job) {
        relayBusy = false;
        return;
      }
      const relay = relayOfJob(job);
      const low11 = job.newWord & 0o3777;
      const prior = Object.prototype.hasOwnProperty.call(hw.latches, relay)
        ? hw.latches[relay]
        : (clockRelayWords[relay] ?? 0);
      hw.latches[relay] = prior & 0o3777;
      // Use the exact same physical bank model as real channel-010 output.
      // applyRelayLow11 updates the corresponding clock-facing AGC display
      // cells progressively as individual armatures settle.
      beginRelayDrive(relay, low11, true);
      clockRelayWords[relay] = low11;

      // Keep the phone-clock backing digits synchronized at the guaranteed
      // 20-ms settle boundary so later dirty comparisons start from reality.
      later(() => {
        if (token !== hw.clockToken || mode !== 'clock' || lampTestActive) return;
        const touched = new Set();
        for (const [name, index] of cellsOfJob(job)) {
          clockDigits[name][index] = job.want[name][index];
          touched.add(name);
        }
        touched.forEach(renderClockReg);
      }, RELAY_DRIVE_MS);

      later(step, DIRTY_ROW_START_MS);
    };
    later(step, startDelay);
  };

  function flashPhaseOff() {
    const elapsed = Math.max(0, performance.now() - scalerEpoch);
    return Math.floor(elapsed / DSKY_FLASH_QUANTUM_MS) % DSKY_FLASH_PHASES === 0;
  }

  function applySyntheticFlash() {
    if (!lampTestActive || !hw.v35FlashEnabled) return;
    const off = flashPhaseOff();
    // yaAGC's hardware model: phase 0 blanks V/N when bit 6 is asserted.
    // The V/N blanking is electronic once the FLASH relay is pulled in, so
    // there is no repeated relay click for the digits themselves.
    document.body.classList.toggle('vn-flash-off', off);

    // KEY REL and OPR ERR are different: AGCIS specifies their DSKY relays as
    // pulse-modulated.  Their actual coils release during the 320-ms dark phase
    // and pull in again for the 960-ms bright phase.  Those edges are audible.
    setAuxRelays({
      keyrel: hw.v35DirectKeyRel && !off,
      oprerr: hw.v35DirectOperErr && !off
    }, true);
  }

  function scheduleSyntheticFlash() {
    if (!lampTestActive || !hw.v35FlashEnabled) return;
    applySyntheticFlash();
    const elapsed = Math.max(0, performance.now() - scalerEpoch);
    const until = DSKY_FLASH_QUANTUM_MS - (elapsed % DSKY_FLASH_QUANTUM_MS);
    hw.v35FlashTimer = setTimeout(() => {
      hw.v35FlashTimer = 0;
      scheduleSyntheticFlash();
    }, Math.max(1, until));
  }

  function seedPhoneLatches(state) {
    for (const relay of V35_ORDER) {
      const low11 = state[relay] ?? 0;
      hw.latches[relay] = low11 & 0o3777;
      agcRelayWords[relay] = low11 & 0o3777;
      applyRelayLow11(relay, low11 & 0o3777);
    }
  }

  function scheduleSyntheticRows(target, token, onComplete) {
    const start = nextT4Delay();
    V35_ORDER.forEach((relay, index) => {
      later(() => {
        if (token !== hw.v35Token || !lampTestActive) return;
        beginRelayDrive(relay, target[relay] ?? 0, true);
      }, start + index * DIRTY_ROW_START_MS);
    });
    later(() => {
      if (token !== hw.v35Token || !lampTestActive) return;
      if (onComplete) onComplete();
    }, start + (V35_ORDER.length - 1) * DIRTY_ROW_START_MS + RELAY_DRIVE_MS + 2);
  }

  const originalCancelLampTest = cancelLampTest;
  cancelLampTest = function hardwareCancelLampTest(...args) {
    hw.v35Token++;
    hw.v35FlashEnabled = false;
    hw.v35DirectKeyRel = false;
    hw.v35DirectOperErr = false;
    if (hw.v35FlashTimer) clearTimeout(hw.v35FlashTimer);
    hw.v35FlashTimer = 0;
    document.body.classList.remove('vn-flash-off');
    // RSET/cancellation removes any synthetic non-latching DSKY relay drive.
    // This is intentionally audible when a relay had actually been energized.
    if (mode === 'clock') {
      setAuxRelays({
        comp: false, uplink: false, temp: false, keyrel: false,
        oprerr: false, flash: false, restart: false, stby: false
      }, true);
    }
    return originalCancelLampTest.apply(this, args);
  };

  lampTest = function hardwareLampTest() {
    cancelLampTest();
    stopClockQueue();
    lampTestActive = true;
    const token = ++hw.v35Token;

    // The V35 executive job first asserts the non-latching channel-11/test
    // alarm signals immediately.  COMP ACTY is not part of TSTCON1.  FLASH is
    // itself a non-latching relay, so enabling the V/N flash circuit produces
    // one pull-in clack here; it remains energized through the test.
    setAuxRelays({
      comp: false,
      uplink: true,
      temp: true,
      restart: true,
      stby: true,
      flash: true
    }, true);
    hw.v35DirectKeyRel = true;
    hw.v35DirectOperErr = true;
    hw.v35FlashEnabled = true;
    scheduleSyntheticFlash();

    // At the instant ENTER starts V35 the command fields are V35 / current
    // noun and the phone clock already has its latching-relay state.
    const prior = currentClockLatchState(verb, noun);
    seedPhoneLatches(prior);
    const active = v35State();
    scheduleSyntheticRows(active, token, null);

    lampTestTimer = setTimeout(() => {
      lampTestTimer = 0;
      if (token !== hw.v35Token || mode !== 'clock') return;

      // TSTLTS3 clears UPLINK/TEMP/OPER ERR and TEST ALARM at five seconds.
      // KEY REL is released with the display system after the restored relay
      // sequence has completed, matching the Pinball cleanup ordering.
      setAuxRelays({
        uplink: false,
        temp: false,
        restart: false,
        stby: false,
        flash: false
      }, true);
      hw.v35DirectOperErr = false;
      hw.v35FlashEnabled = false;
      if (hw.v35FlashTimer) clearTimeout(hw.v35FlashTimer);
      hw.v35FlashTimer = 0;
      document.body.classList.remove('vn-flash-off');
      setAuxRelays({
        oprerr: false,
        keyrel: hw.v35DirectKeyRel
      }, true);

      const restoreData = targetClockState('16', '65');
      // Synthetic clock has no spacecraft channel-12 coarse-align inputs, so
      // all relay-12 condition lamps return to their quiescent state.
      restoreData.state[12] = 0;
      scheduleSyntheticRows(restoreData.state, token, () => {
        if (token !== hw.v35Token || mode !== 'clock') return;
        hw.v35DirectKeyRel = false;
        setAuxRelays({ keyrel: false, comp: false }, true);
        verb = '16'; noun = '65';
        clockDigits = {
          r1: restoreData.want.r1.slice(),
          r2: restoreData.want.r2.slice(),
          r3: restoreData.want.r3.slice()
        };
        for (const row of CLOCK_ROWS) clockRelayWords[row.relay] = restoreData.state[row.relay] & 0o3777;
        lampTestActive = false;
        $('mode').textContent = 'V16 N65 · PHONE CLOCK';
      });
    }, V35_HOLD_MS);
  };

  // Run yaAGC from the original 1024-kHz/12 machine-cycle rate while
  // draining peripheral output at 250 Hz.  The faster drain does not speed up
  // the AGC; it only reduces JavaScript delivery quantization of 20-ms OUT0
  // pulses compared with a 60-Hz browser-frame poll.
  if (window.AgcCore && AgcCore.prototype && !AgcCore.prototype.__dskyFidelityStart) {
    AgcCore.prototype.start = function fidelityStart(clockDivisor = 1) {
      if (this.running) return;
      this.clockDivisor = Math.max(0.05, Number(clockDivisor) || 1);
      this.running = true;
      this.totalSteps = 0;
      this.startTime = performance.now();
      const cycleMs = (1000 * 24) / 2048000; // exact Block II AGC MCT: 11.71875 microseconds
      this.timer = setInterval(() => {
        if (!this.running) return;
        try {
          const target = Math.floor((performance.now() - this.startTime) / cycleMs / this.clockDivisor);
          const diff = target - this.totalSteps;
          if (diff < 0 || diff > 100000) {
            this.startTime = performance.now();
            this.totalSteps = 0;
            return;
          }
          this.step(diff);
        } catch (error) {
          this.stop();
          this.onError(error);
        }
      }, 4);
    };
    AgcCore.prototype.__dskyFidelityStart = true;
  }

  // AGC PRO is a maintained contact, not a 120-ms synthetic pulse.  Capture
  // the real pointer hold in AGC mode and release on pointer-up/cancel/hidden.
  const pro = document.querySelector('[data-key="P"]');
  let proPointer = null;
  function releaseProceed() {
    if (proPointer === null) return;
    proPointer = null;
    if (pro) pro.classList.remove('pressed');
    if (mode === 'agc' && agcCore) {
      try { agcCore.proceedKey(false); } catch (error) { agcFailure(error); }
    }
  }
  if (pro) {
    pro.addEventListener('pointerdown', event => {
      if (mode !== 'agc' || !agcCore) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (proPointer !== null) return;
      proPointer = event.pointerId;
      pro.classList.add('pressed');
      try { if (pro.setPointerCapture) pro.setPointerCapture(event.pointerId); } catch (_) {}
      try { agcCore.proceedKey(true); } catch (error) { releaseProceed(); agcFailure(error); }
    }, true);
    pro.addEventListener('pointerup', event => {
      if (event.pointerId !== proPointer) return;
      event.preventDefault(); event.stopImmediatePropagation(); releaseProceed();
    }, true);
    pro.addEventListener('pointercancel', event => {
      if (event.pointerId !== proPointer) return;
      event.stopImmediatePropagation(); releaseProceed();
    }, true);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseProceed(); });

  const enterClockBeforeProceedGuard = enterClock;
  enterClock = function hardwareEnterClock(...args) {
    releaseProceed();
    return enterClockBeforeProceedGuard.apply(this, args);
  };

  // Seed the physical latch model and AGC-facing renderer from the already
  // visible phone-clock face.  There is no electrical drive or sound here; it
  // simply establishes the hardware's retained contact state at app startup.
  try { seedPhoneLatches(currentClockLatchState(verb, noun)); } catch (_) {}

  // Poll the synthetic phone-clock source at 20 ms.  This only marks dirty
  // rows; actual DSKY writes remain locked to the 120/20/20 ms hardware model.
  setInterval(() => {
    try { if (mode === 'clock' && !lampTestActive && !relayBusy) tick(); } catch (_) {}
  }, 20);

  // Expose timing/state snapshots for field verification without allowing a
  // caller to mutate the hardware model.
  if (window.AGCDSKY) {
    window.AGCDSKY.hardware = () => ({
      t4Ms: T4_MS,
      relayDriveMs: RELAY_DRIVE_MS,
      dirtyRowStartMs: DIRTY_ROW_START_MS,
      armatureSettleMs: ARMATURE_SETTLE_MS.slice(),
      v35Order: V35_ORDER.slice(),
      flashQuantumMs: DSKY_FLASH_QUANTUM_MS,
      flashPeriodMs: DSKY_FLASH_QUANTUM_MS * DSKY_FLASH_PHASES,
      activeDrive: hw.activeDrive,
      latches: Object.assign({}, hw.latches),
      auxRelays: Object.assign({}, hw.auxRelays),
      lastWrite: hw.lastWrite ? Object.assign({}, hw.lastWrite) : null,
      lampTestActive
    });
  }
})();
