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

const calls = [];
const context = {
  mode: 'clock',
  lampTestActive: true,
  selectedMission: 'luminary099',
  clockRelayWords: { 8: 0o35, 7: 0o2000 },
  agcRelayWords: { 11: 0o1234 },
  DIGIT_RELAY: { '8': 0o35 },
  window: { AGCDSKY: {} },
  v35RelayWord(relay) {
    const eight = 0o35;
    const c = relay === 8 ? 0 : eight;
    const b = [7, 5, 2].includes(relay) ? 1 : 0;
    return (relay << 11) | (b << 10) | (c << 5) | eight;
  },
  press(key) {
    calls.push(['press', key]);
    if (key === 'R') context.lampTestActive = false;
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

// During synthetic clock V35, ordinary DSKY keys must not repaint the test.
const beforeBlocked = calls.length;
assert(context.press('5') === undefined, 'ordinary key must be ignored while clock V35 owns the display');
assert(calls.length === beforeBlocked, 'blocked V35 key leaked into the underlying press handler');

// RSET remains the explicit operator escape from the five-second test.
assert(context.press('R') === 'pressed:R', 'RSET must pass through during clock V35');
assert(calls.at(-1)[0] === 'press' && calls.at(-1)[1] === 'R', 'RSET did not reach base press handler');
assert(context.lampTestActive === false, 'base RSET did not terminate test state in smoke harness');

// Ordinary input behavior must be unchanged outside the test.
assert(context.press('7') === 'pressed:7', 'ordinary clock key must pass through when V35 is inactive');
assert(calls.at(-1)[1] === '7', 'ordinary key did not reach base press handler');

// Entering real AGC mode while V35 is active must first execute the real clock
// RSET path, which cancels timers, clears test annunciators, and restores the
// ordinary display before the mode transition begins.
context.mode = 'clock';
context.lampTestActive = true;
const agcStart = calls.length;
assert(context.enterAgc('test') === 'entered-agc', 'wrapped enterAgc return value changed');
const agcCalls = calls.slice(agcStart);
assert(JSON.stringify(agcCalls) === JSON.stringify([
  ['press', 'R'],
  ['enterAgc', 'test']
]), `enterAgc V35 cleanup order changed: ${JSON.stringify(agcCalls)}`);

// Mission selection gets the same cleanup barrier so the synthetic flashing
// interval cannot survive a mission-control action in phone-clock mode.
context.mode = 'clock';
context.lampTestActive = true;
const missionStart = calls.length;
assert(context.cycleMission('test') === 'cycled-mission', 'wrapped cycleMission return value changed');
const missionCalls = calls.slice(missionStart);
assert(JSON.stringify(missionCalls) === JSON.stringify([
  ['press', 'R'],
  ['cycleMission', 'test']
]), `cycleMission V35 cleanup order changed: ${JSON.stringify(missionCalls)}`);

// The wrapper is intentionally clock-test-specific; AGC mode must not invent
// a synthetic RSET before a real mode action.
context.mode = 'agc';
context.lampTestActive = true;
const realAgcStart = calls.length;
context.enterAgc('toggle');
assert(JSON.stringify(calls.slice(realAgcStart)) === JSON.stringify([
  ['enterAgc', 'toggle']
]), 'AGC-mode transition unexpectedly injected synthetic RSET');

// Device diagnostics expose copies of the latched relay state. Mutating the
// returned object must not alter either production relay table.
assert(typeof context.window.AGCDSKY.snapshotRelays === 'function',
  'AGCDSKY.snapshotRelays diagnostic was not registered');
assert(typeof context.window.AGCDSKY.snapshotDsky === 'function',
  'AGCDSKY.snapshotDsky diagnostic was not registered');
const relays = context.window.AGCDSKY.snapshotRelays();
assert(relays.mode === 'agc' && relays.mission === 'luminary099',
  'relay snapshot omitted current mode/mission');
assert(relays.clock[8] === 0o35 && relays.agc[11] === 0o1234,
  'relay snapshot did not copy clock/AGC latch words');
relays.clock[8] = 0;
relays.agc[11] = 0;
assert(context.clockRelayWords[8] === 0o35 && context.agcRelayWords[11] === 0o1234,
  'relay diagnostic leaked mutable production relay state');

console.log('app refinement smoke: PASS');
console.log('  FULLDSP relay-8 physical drive: PASS');
console.log('  clock V35 ordinary-key isolation: PASS');
console.log('  RSET escape and AGC/mission cleanup ordering: PASS');
console.log('  read-only relay diagnostics: PASS');
