#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/app-refine.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function popcount11(value) {
  value &= 0o3777;
  let count = 0;
  while (value) {
    value &= value - 1;
    count++;
  }
  return count;
}

const calls = [];
const relayBursts = [];
const lamps = new Map();
for (const name of ['vel', 'noatt', 'alt', 'gimbal', 'tracker', 'prog']) {
  lamps.set(name, { classList: { contains: () => name === 'prog' } });
}

const context = {
  mode: 'clock',
  lampTestActive: false,
  selectedMission: 'luminary099',
  verb: '35',
  noun: '65',
  tickSound: true,
  CLOCK_RELAYS: [8, 7, 6, 5, 4, 3, 2, 1],
  CHANNEL10_LAMPS: [
    [0o00004, 'vel'], [0o00010, 'noatt'], [0o00020, 'alt'],
    [0o00040, 'gimbal'], [0o00200, 'tracker'], [0o00400, 'prog']
  ],
  DIGIT_RELAY: {
    ' ': 0, '0': 0o25, '1': 0o03, '3': 0o33, '5': 0o36,
    '6': 0o34, '8': 0o35
  },
  clockRelayWords: {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0
  },
  agcRelayWords: {},
  window: { AGCDSKY: {} },
  document: {
    querySelector(selector) {
      const match = selector.match(/^\[data-lamp="(.+)"\]$/);
      return match ? lamps.get(match[1]) || null : null;
    },
    getElementById() {
      return null;
    },
    body: { classList: { contains: () => false } }
  },
  popcount11,
  playRelayBurst(count) {
    relayBursts.push(count);
  },
  v35RelayWord(relay) {
    const eight = 0o35;
    const c = relay === 8 ? 0 : eight;
    const b = [7, 5, 2].includes(relay) ? 1 : 0;
    return (relay << 11) | (b << 10) | (c << 5) | eight;
  },
  latchAgcRelay(relay, low11) {
    calls.push(['latchAgcRelay', relay, low11]);
    context.agcRelayWords[relay] = low11;
  },
  cancelLampTest() {
    calls.push(['cancelLampTest']);
    context.lampTestActive = false;
  },
  lampTest() {
    // Model the relevant synchronous portion of app.js's base lampTest: clear
    // the AGC latch table, mark the synthetic test active, then feed the V35
    // channel-010 words through the current (possibly refined) latch function.
    context.cancelLampTest();
    context.lampTestActive = true;
    for (const key of Object.keys(context.agcRelayWords)) delete context.agcRelayWords[key];
    for (const relay of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
      context.latchAgcRelay(relay, context.v35RelayWord(relay) & 0o3777);
    }
    context.latchAgcRelay(12, 0o674);
    return 'lamp-test-started';
  },
  press(key) {
    calls.push(['press', key]);
    // Deliberately do NOT change lampTestActive here. app.js base RSET does not
    // own the V35 timer cancellation contract; the refinement must do it.
    return `pressed:${key}`;
  },
  enterAgc(...args) {
    calls.push(['enterAgc', ...args]);
    return 'entered-agc';
  },
  cycleMission(...args) {
    calls.push(['cycleMission', ...args]);
    return 'cycled-mission';
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'app-refine.js' });

// Luminary FULLDSP drives the otherwise-unconnected C bank on relay row 8.
// The visible decoder still ignores it; the physical relay model must not.
const relay8 = context.v35RelayWord(8);
assert(((relay8 >> 5) & 0o37) === 0o35 && (relay8 & 0o37) === 0o35,
  'refined V35 relay 8 must drive both five-relay fields to digit 8');
assert((relay8 & 0o3777) === 0o1675,
  `refined V35 relay 8 low-11 word must be 01675, got 0${(relay8 & 0o3777).toString(8)}`);
assert((context.v35RelayWord(7) & 0o3777) === 0o3675,
  'V35 refinement must not disturb an ordinary plus-sign relay row');

// Starting V35 must be a physical transition from the clock latches that were
// actually displayed immediately before ENTER. In particular, selectors 10/9
// begin at VERB 35 / NOUN 65 and selector 12 begins with the currently lit
// clock-mode condition lamps instead of an invented all-zero state.
const prior = {
  11: (0o25 << 5) | 0o25,
  10: (0o33 << 5) | 0o36,
  9: (0o34 << 5) | 0o36,
  8: 0, 7: 0, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
  12: 0o400
};
const expectedOrder = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 12];
const expectedBursts = expectedOrder.map((relay) => {
  const next = relay === 12 ? 0o674 : context.v35RelayWord(relay) & 0o3777;
  return popcount11(prior[relay] ^ next);
}).filter((count) => count > 0);

assert(context.lampTest() === 'lamp-test-started', 'refined lampTest changed base return value');
assert(context.lampTestActive === true, 'base V35 did not remain active after start');
assert(JSON.stringify(relayBursts) === JSON.stringify(expectedBursts),
  `clock-to-V35 relay transition counts changed: got ${JSON.stringify(relayBursts)}, expected ${JSON.stringify(expectedBursts)}`);
assert(context.agcRelayWords[8] === 0o1675,
  'synthetic V35 did not latch physical FULLDSP relay-8 state');
assert(context.agcRelayWords[12] === 0o674,
  'synthetic V35 did not latch Luminary relay-12 state');

// During synthetic clock V35, ordinary DSKY keys must not repaint the test.
const beforeBlocked = calls.length;
assert(context.press('5') === undefined, 'ordinary key must be ignored while clock V35 owns the display');
assert(calls.length === beforeBlocked, 'blocked V35 key leaked into the underlying press handler');

// RSET is the explicit escape. The refinement must cancel the real V35 timers
// before invoking app.js's base RSET, because base RSET only repaints state.
const resetStart = calls.length;
assert(context.press('R') === 'pressed:R', 'RSET must pass through during clock V35');
assert(JSON.stringify(calls.slice(resetStart)) === JSON.stringify([
  ['cancelLampTest'],
  ['press', 'R']
]), `RSET V35 cancellation order changed: ${JSON.stringify(calls.slice(resetStart))}`);
assert(context.lampTestActive === false,
  'RSET refinement did not cancel V35 state before base RSET');

// Ordinary input behavior must be unchanged outside the test.
assert(context.press('7') === 'pressed:7', 'ordinary clock key must pass through when V35 is inactive');
assert(calls.at(-1)[1] === '7', 'ordinary key did not reach base press handler');

// Entering real AGC mode while V35 is active should cancel the synthetic timers
// and hand the DSKY directly to the AGC reset/output path. It must not inject a
// fake V16 N65 RSET/redisplay between the light test and AGC startup.
context.mode = 'clock';
context.lampTestActive = true;
const agcStart = calls.length;
assert(context.enterAgc('test') === 'entered-agc', 'wrapped enterAgc return value changed');
const agcCalls = calls.slice(agcStart);
assert(JSON.stringify(agcCalls) === JSON.stringify([
  ['cancelLampTest'],
  ['enterAgc', 'test']
]), `enterAgc V35 cleanup order changed: ${JSON.stringify(agcCalls)}`);
assert(context.lampTestActive === false,
  'AGC transition left synthetic V35 active');

// Mission selection remains in phone-clock mode, so it does restore ordinary
// clock presentation through base RSET after cancelling the synthetic timers.
context.mode = 'clock';
context.lampTestActive = true;
const missionStart = calls.length;
assert(context.cycleMission('test') === 'cycled-mission', 'wrapped cycleMission return value changed');
const missionCalls = calls.slice(missionStart);
assert(JSON.stringify(missionCalls) === JSON.stringify([
  ['cancelLampTest'],
  ['press', 'R'],
  ['cycleMission', 'test']
]), `cycleMission V35 cleanup order changed: ${JSON.stringify(missionCalls)}`);
assert(context.lampTestActive === false,
  'mission transition left synthetic V35 active');

// The wrapper is deliberately clock-test-specific; AGC mode must not inject a
// synthetic cancellation/RSET before a real AGC mode action.
context.mode = 'agc';
context.lampTestActive = true;
const realAgcStart = calls.length;
context.enterAgc('toggle');
assert(JSON.stringify(calls.slice(realAgcStart)) === JSON.stringify([
  ['enterAgc', 'toggle']
]), 'AGC-mode transition unexpectedly injected synthetic V35 cleanup');

// Device diagnostics expose copies of the latched relay state. Mutating the
// returned object must not alter either production relay table.
assert(typeof context.window.AGCDSKY.snapshotRelays === 'function',
  'AGCDSKY.snapshotRelays diagnostic was not registered');
assert(typeof context.window.AGCDSKY.snapshotDsky === 'function',
  'AGCDSKY.snapshotDsky diagnostic was not registered');
const relays = context.window.AGCDSKY.snapshotRelays();
assert(relays.mode === 'agc' && relays.mission === 'luminary099',
  'relay snapshot omitted current mode/mission');
assert(relays.clock[8] === 0 && relays.agc[11] !== undefined,
  'relay snapshot did not copy clock/AGC latch words');
relays.clock[8] = 0o7777;
relays.agc[11] = 0;
assert(context.clockRelayWords[8] === 0 && context.agcRelayWords[11] !== 0,
  'relay diagnostic leaked mutable production relay state');

console.log('app refinement smoke: PASS');
console.log('  FULLDSP relay-8 physical drive: PASS');
console.log('  clock-to-V35 physical relay deltas: PASS');
console.log('  clock V35 ordinary-key isolation: PASS');
console.log('  RSET/AGC/mission V35 cancellation ordering: PASS');
console.log('  read-only relay diagnostics: PASS');
