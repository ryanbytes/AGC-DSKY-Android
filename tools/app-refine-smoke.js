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

console.log('app refinement smoke: PASS');
console.log('  clock V35 ordinary-key isolation: PASS');
console.log('  RSET escape and AGC/mission cleanup ordering: PASS');
