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
const timers = new Map();
let nextTimerId = 1;
const lamps = new Map();
for (const name of ['vel', 'noatt', 'alt', 'gimbal', 'tracker', 'prog']) {
  lamps.set(name, { classList: { contains: () => name === 'prog' } });
}

const context = {
  mode: 'clock',
  lampTestActive: false,
  lampTestTimer: 0,
  lampTestFlashTimer: 0,
  V35_TEST_MS: 5000,
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
  setTimeout(callback, ms) {
    const id = nextTimerId++;
    timers.set(id, { callback, ms });
    return id;
  },
  clearTimeout(id) {
    timers.delete(id);
  },
  clearInterval(id) {
    timers.delete(id);
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
    if (context.lampTestTimer) {
      context.clearTimeout(context.lampTestTimer);
      context.lampTestTimer = 0;
    }
    if (context.lampTestFlashTimer) {
      context.clearInterval(context.lampTestFlashTimer);
      context.lampTestFlashTimer = 0;
    }
    context.lampTestActive = false;
  },
  lampTest() {
    // Model the relevant synchronous portion of app.js's base lampTest.
    context.cancelLampTest();
    context.lampTestActive = true;
    for (const key of Object.keys(context.agcRelayWords)) delete context.agcRelayWords[key];
    for (const relay of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
      context.latchAgcRelay(relay, context.v35RelayWord(relay) & 0o3777);
    }
    context.latchAgcRelay(12, 0o674);
    // The base implementation historically installed its own five-second
    // teardown; the refinement must replace this handle, not stack another one.
    context.lampTestTimer = context.setTimeout(() => {
      calls.push(['obsoleteBaseV35Timeout']);
    }, 5000);
    return 'lamp-test-started';
  },
  press(key) {
    calls.push(['press', key]);
    if (key === 'R') {
      context.cancelLampTest();
      context.mode = 'clock';
      context.verb = '16';
      context.noun = '65';
    }
    return `pressed:${key}`;
  },
  enterAgc(...args) {
    // Mirror current app.js: entering AGC already cancels any clock V35 test.
    if (context.mode === 'clock') context.cancelLampTest();
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
const relay8 = context.v35RelayWord(8);
assert(((relay8 >> 5) & 0o37) === 0o35 && (relay8 & 0o37) === 0o35,
  'refined V35 relay 8 must drive both five-relay fields to digit 8');
assert((relay8 & 0o3777) === 0o1675,
  `refined V35 relay 8 low-11 word must be 01675, got 0${(relay8 & 0o3777).toString(8)}`);
assert((context.v35RelayWord(7) & 0o3777) === 0o3675,
  'V35 refinement must not disturb an ordinary plus-sign relay row');

// Starting V35 must be a physical transition from the clock latches that were
// actually displayed immediately before ENTER. Selectors 10/9 begin at VERB
// 35 / NOUN 65 and selector 12 begins with the currently lit condition lamps.
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

// The refinement must replace the base teardown timer with exactly one 5-second
// RSET-based teardown. Firing it must restore canonical V16 N65 and must never
// execute the obsolete base callback.
assert(timers.size === 1, `V35 must have exactly one teardown timer, found ${timers.size}`);
const [[naturalTimerId, naturalTimer]] = Array.from(timers.entries());
assert(naturalTimerId === context.lampTestTimer && naturalTimer.ms === 5000,
  'refined V35 teardown timer is not the active 5-second handle');
const naturalStart = calls.length;
naturalTimer.callback();
assert(JSON.stringify(calls.slice(naturalStart)) === JSON.stringify([
  ['press', 'R'],
  ['cancelLampTest']
]), `natural V35 teardown did not use base RSET exactly once: ${JSON.stringify(calls.slice(naturalStart))}`);
assert(!calls.some((entry) => entry[0] === 'obsoleteBaseV35Timeout'),
  'obsolete base V35 teardown callback survived refinement');
assert(context.lampTestActive === false && context.lampTestTimer === 0,
  'natural V35 teardown left active timer/test state');
assert(context.verb === '16' && context.noun === '65',
  `natural V35 teardown did not restore V16 N65: V${context.verb} N${context.noun}`);

// Start another test for key-isolation and control-transition checks.
relayBursts.length = 0;
context.verb = '35';
context.noun = '65';
context.lampTest();

// During synthetic clock V35, ordinary DSKY keys must not repaint the test.
const beforeBlocked = calls.length;
assert(context.press('5') === undefined, 'ordinary key must be ignored while clock V35 owns the display');
assert(calls.length === beforeBlocked, 'blocked V35 key leaked into the underlying press handler');

// RSET passes through exactly once; current app.js itself performs cancellation.
const resetStart = calls.length;
assert(context.press('R') === 'pressed:R', 'RSET must pass through during clock V35');
assert(JSON.stringify(calls.slice(resetStart)) === JSON.stringify([
  ['press', 'R'],
  ['cancelLampTest']
]), `RSET V35 base cancellation path changed: ${JSON.stringify(calls.slice(resetStart))}`);
assert(context.lampTestActive === false,
  'base RSET did not cancel V35 state');

// Ordinary input behavior must be unchanged outside the test.
assert(context.press('7') === 'pressed:7', 'ordinary clock key must pass through when V35 is inactive');
assert(calls.at(-1)[1] === '7', 'ordinary key did not reach base press handler');

// enterAgc is intentionally not wrapped because current app.js already owns
// V35 cancellation; no synthetic RSET/clock redisplay should be injected.
context.mode = 'clock';
context.lampTestActive = true;
const agcStart = calls.length;
assert(context.enterAgc('test') === 'entered-agc', 'base enterAgc return value changed');
assert(JSON.stringify(calls.slice(agcStart)) === JSON.stringify([
  ['cancelLampTest'],
  ['enterAgc', 'test']
]), `enterAgc V35 base cleanup path changed: ${JSON.stringify(calls.slice(agcStart))}`);
assert(context.lampTestActive === false,
  'AGC transition left synthetic V35 active');

// cycleMission does not own V35 cancellation, so the refinement routes through
// base RSET exactly once before changing the selected rope.
context.mode = 'clock';
context.lampTestActive = true;
const missionStart = calls.length;
assert(context.cycleMission('test') === 'cycled-mission', 'wrapped cycleMission return value changed');
assert(JSON.stringify(calls.slice(missionStart)) === JSON.stringify([
  ['press', 'R'],
  ['cancelLampTest'],
  ['cycleMission', 'test']
]), `cycleMission V35 cleanup path changed: ${JSON.stringify(calls.slice(missionStart))}`);
assert(context.lampTestActive === false,
  'mission transition left synthetic V35 active');

// Device diagnostics expose copies of the latched relay state. Mutating the
// returned object must not alter either production relay table.
assert(typeof context.window.AGCDSKY.snapshotRelays === 'function',
  'AGCDSKY.snapshotRelays diagnostic was not registered');
assert(typeof context.window.AGCDSKY.snapshotDsky === 'function',
  'AGCDSKY.snapshotDsky diagnostic was not registered');
const relays = context.window.AGCDSKY.snapshotRelays();
assert(relays.mode === 'clock' && relays.mission === 'luminary099',
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
console.log('  natural V35 timeout -> V16 N65: PASS');
console.log('  clock V35 ordinary-key isolation: PASS');
console.log('  base RSET/AGC + refined mission cancellation: PASS');
console.log('  read-only relay diagnostics: PASS');
