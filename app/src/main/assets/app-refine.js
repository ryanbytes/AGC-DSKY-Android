'use strict';

// Small post-load refinements that deliberately wrap the existing app.js
// bindings rather than duplicating the DSKY/AGC implementation.
//
// Clock-mode V35 owns the DSKY presentation for its five-second test. On the
// real Pinball path ordinary keyboard input cannot repaint individual fields
// out from under the test. RSET remains the explicit way to terminate it.
const baseDskyPress = press;
press = function refinedDskyPress(key) {
  if (mode === 'clock' && lampTestActive && key !== 'R') return;
  return baseDskyPress(key);
};

function restoreClockBeforeLeavingV35() {
  if (mode === 'clock' && lampTestActive) baseDskyPress('R');
}

// A synthetic V35 flash interval must never survive a transition into a real
// AGC mission or a mission-selection change. Restore the ordinary clock face
// first so no V35 annunciator/timer state can leak into the next mode.
const baseEnterAgc = enterAgc;
enterAgc = function refinedEnterAgc(...args) {
  restoreClockBeforeLeavingV35();
  return baseEnterAgc.apply(this, args);
};

const baseCycleMission = cycleMission;
cycleMission = function refinedCycleMission(...args) {
  restoreClockBeforeLeavingV35();
  return baseCycleMission.apply(this, args);
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
