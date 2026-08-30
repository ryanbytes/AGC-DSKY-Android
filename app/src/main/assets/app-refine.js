'use strict';

// Small post-load refinements that deliberately wrap the existing app.js
// bindings rather than duplicating the DSKY/AGC implementation.
//
// Luminary's V35 FULLDSP word drives 01675 into every numeric relay row. Relay
// selector 8 only exposes its D field on the visible DSKY, but the unused C
// five-relay bank is still electrically driven to the digit-8 pattern. Keep the
// renderer's right-field-only behavior while preserving those physical relay
// transitions in the synthetic clock test.
const baseV35RelayWord = v35RelayWord;
v35RelayWord = function refinedV35RelayWord(relay) {
  const word = baseV35RelayWord(relay);
  return relay === 8 ? word | (DIGIT_RELAY['8'] << 5) : word;
};

function clockPairLow11(text) {
  const value = String(text || '').padEnd(2, ' ').slice(0, 2);
  const c = DIGIT_RELAY[value[0]] ?? 0;
  const d = DIGIT_RELAY[value[1]] ?? 0;
  return (c << 5) | d;
}

function clockRelay12Low11() {
  let value = 0;
  for (const [mask, name] of CHANNEL10_LAMPS) {
    const lamp = document.querySelector(`[data-lamp="${name}"]`);
    if (lamp && lamp.classList.contains('on')) value |= mask;
  }
  return value;
}

function captureClockRelaysBeforeV35() {
  const relays = {};
  for (const relay of CLOCK_RELAYS) {
    if (clockRelayWords[relay] !== undefined) relays[relay] = clockRelayWords[relay] & 0o3777;
  }
  // Phone-clock mode normally keeps PROG at 00. VERB/NOUN are captured from
  // their actual entry variables so V35 compares against the 35/65 state that
  // was visibly present immediately before ENTER executes the test.
  relays[11] = clockPairLow11('00');
  relays[10] = clockPairLow11(verb);
  relays[9] = clockPairLow11(noun);
  relays[12] = clockRelay12Low11();
  return relays;
}

let clockV35PriorRelays = null;

// app.js's AGC latch table is intentionally cleared before a fresh AGC face.
// Synthetic clock V35 also uses that decoder, however, so its first V35 write
// would otherwise appear to come from an unknown/empty state and produce no
// mechanical transition clicks. While V35 is starting, compare each first
// write against the captured phone-clock relay state, then let the ordinary
// AGC latch implementation own the new word.
const baseLatchAgcRelay = latchAgcRelay;
latchAgcRelay = function refinedLatchAgcRelay(relay, low11) {
  if (mode === 'clock' && lampTestActive
      && agcRelayWords[relay] === undefined
      && clockV35PriorRelays
      && Object.prototype.hasOwnProperty.call(clockV35PriorRelays, relay)) {
    const prior = clockV35PriorRelays[relay] & 0o3777;
    const next = low11 & 0o3777;
    const changed = popcount11(prior ^ next);
    if (tickSound && changed) playRelayBurst(changed);
  }
  return baseLatchAgcRelay(relay, low11);
};

const baseLampTest = lampTest;
lampTest = function refinedLampTest(...args) {
  if (mode !== 'clock') return baseLampTest.apply(this, args);
  clockV35PriorRelays = captureClockRelaysBeforeV35();
  try {
    return baseLampTest.apply(this, args);
  } finally {
    clockV35PriorRelays = null;
  }
};

// Clock-mode V35 owns the DSKY presentation for its five-second test. Ordinary
// keyboard input cannot repaint individual fields out from under it. RSET is
// the explicit escape and must cancel both the five-second teardown timeout and
// the 320-ms flash interval before restoring the normal clock face.
const baseDskyPress = press;
press = function refinedDskyPress(key) {
  if (mode === 'clock' && lampTestActive) {
    if (key !== 'R') return;
    cancelLampTest();
  }
  return baseDskyPress(key);
};

function restoreClockBeforeLeavingV35() {
  if (mode !== 'clock' || !lampTestActive) return;
  // Do not rely on app.js's base RSET to stop V35 timers; base RSET only resets
  // visible clock fields. Cancel the test explicitly first, then reuse the base
  // RSET path to clear annunciators and restore ordinary V16 N65 clock state.
  cancelLampTest();
  baseDskyPress('R');
}

// A synthetic V35 flash interval must never survive a mission-selection change.
const baseCycleMission = cycleMission;
cycleMission = function refinedCycleMission(...args) {
  restoreClockBeforeLeavingV35();
  return baseCycleMission.apply(this, args);
};

// Entering a real AGC mission does not need a synthetic clock redisplay first;
// the AGC path immediately clears/reinitializes the DSKY. Cancel V35 timers and
// let the authentic AGC reset/output sequence take over without generating a
// fake intermediate V16 N65 restore.
const baseEnterAgc = enterAgc;
enterAgc = function refinedEnterAgc(...args) {
  if (mode === 'clock' && lampTestActive) cancelLampTest();
  return baseEnterAgc.apply(this, args);
};

// Read-only diagnostics for device smoke tests and field debugging. These
// snapshots intentionally return copies: callers can inspect the physical
// relay model without being able to mutate app state through AGCDSKY.
function snapshotRelays() {
  return {
    mode,
    mission: selectedMission,
    clock: Object.assign({}, clockRelayWords),
    agc: Object.assign({}, agcRelayWords)
  };
}

const renderedDigitSegments = Object.freeze({
  abcdef: '0', bc: '1', abdeg: '2', abcdg: '3', bcfg: '4',
  acdfg: '5', acdefg: '6', abc: '7', abcdefg: '8', abcdfg: '9'
});
const diagnosticLampNames = Object.freeze([
  'comp', 'uplink', 'temp', 'noatt', 'gimbal', 'stby', 'prog',
  'keyrel', 'restart', 'oprerr', 'tracker', 'alt', 'vel'
]);

function readRenderedGlyph(glyphNode) {
  const key = Array.from(glyphNode.querySelectorAll('.el-seg.on[data-seg]'))
    .map((segment) => segment.dataset.seg)
    .sort()
    .join('');
  return renderedDigitSegments[key] || ' ';
}

function readRenderedDigits(id) {
  const element = document.getElementById(id);
  if (!element) return null;
  return Array.from(element.querySelectorAll('.el-glyph')).map(readRenderedGlyph).join('');
}

function readRenderedSign(id) {
  const element = document.getElementById(id);
  const sign = element && element.querySelector('.el-sign');
  if (!sign) return null;
  const onCount = sign.querySelectorAll('.el-seg.on').length;
  if (onCount >= 3) return '+';
  if (onCount === 1) return '-';
  return ' ';
}

function snapshotDsky() {
  const lamps = {};
  for (const name of diagnosticLampNames) {
    const element = document.querySelector(`[data-lamp="${name}"]`);
    lamps[name] = !!(element && element.classList.contains('on'));
  }
  return {
    relays: snapshotRelays(),
    lampTestActive,
    display: {
      prog: readRenderedDigits('prog'),
      verb: readRenderedDigits('verb'),
      noun: readRenderedDigits('noun'),
      r1: { sign: readRenderedSign('r1'), digits: readRenderedDigits('r1') },
      r2: { sign: readRenderedSign('r2'), digits: readRenderedDigits('r2') },
      r3: { sign: readRenderedSign('r3'), digits: readRenderedDigits('r3') }
    },
    lamps,
    vnBlanked: document.body.classList.contains('vn-flash-off'),
    elOff: document.body.classList.contains('el-off')
  };
}

if (window.AGCDSKY) {
  window.AGCDSKY.snapshotRelays = snapshotRelays;
  window.AGCDSKY.snapshotDsky = snapshotDsky;
}
