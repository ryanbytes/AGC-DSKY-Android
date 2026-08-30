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
