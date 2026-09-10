#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/clock-behavior.js'), 'utf8');
const fail = message => { console.error('CLOCK MODE BEHAVIOR FAIL: ' + message); process.exit(1); };

for (const marker of [
  "api.appStatus().mode === 'clock'",
  "[data-lamp=\"comp\"]",
  'randomBetween(45, 165)',
  'randomBetween(260, 620)',
  "mode !== 'clock' && mode !== 'agc-loading'",
  'await api.enterAgc()',
  'core.keyPress(code)',
  "scheduleAgcAutosave('clock keypad handoff')"
]) {
  if (!source.includes(marker)) fail('missing behavior marker: ' + marker);
}
if (/fetch\s*\(/.test(source) || /XMLHttpRequest/.test(source)) fail('COMP ACTY must not be tied to network activity');

let mode = 'clock';
const keyPresses = [];
const classes = new Set();
const handlers = {};
const timers = [];
const comp = {classList:{
  toggle(name,on){ if(on) classes.add(name); else classes.delete(name); },
  remove(name){ classes.delete(name); }
}};
const key = {
  dataset:{key:'V'},
  classList:{add(){},remove(){}},
  closest(selector){ return selector === '[data-key]' ? this : null; }
};
const core = {keyPress(code){ keyPresses.push(code); }};
const AGCDSKY = {
  appStatus(){ return {mode}; },
  async enterAgc(){ mode = 'agc-loading'; await Promise.resolve(); mode = 'agc'; },
  getCore(){ return core; },
  scheduleAgcAutosave(reason){ AGCDSKY.savedReason = reason; }
};
const windowObject = {AGCDSKY};
const documentObject = {
  querySelector(selector){ return selector === '[data-lamp="comp"]' ? comp : null; },
  addEventListener(name,fn){ handlers[name] = fn; }
};
const mathObject = Object.create(Math);
mathObject.random = () => 0.5;
const context = {
  window:windowObject,
  document:documentObject,
  console,
  Math:mathObject,
  setTimeout(fn,delay){ timers.push({fn,delay}); return timers.length; },
  clearTimeout(){},
  Promise
};

try { vm.runInNewContext(source, context, {filename:'clock-behavior.js'}); }
catch (error) { fail('script execution failed: ' + error.stack); }

(async () => {
  if (!timers.length) fail('clock COMP ACTY scheduler did not start');
  timers.shift().fn();
  if (!classes.has('on')) fail('clock COMP ACTY burst did not light the lamp');
  if (!timers.length) fail('clock COMP ACTY on-duration timer missing');
  const onTimer = timers.shift();
  if (onTimer.delay < 45 || onTimer.delay > 620) fail('clock COMP ACTY on duration outside intended range');
  onTimer.fn();
  if (classes.has('on')) fail('clock COMP ACTY burst did not extinguish the lamp');

  mode = 'clock';
  let prevented = false, stopped = false;
  handlers.pointerdown({
    target:key,
    preventDefault(){ prevented = true; },
    stopPropagation(){ stopped = true; }
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  if (!prevented || !stopped) fail('clock keypad event was not intercepted');
  if (mode !== 'agc') fail('clock keypad entry did not hand off to AGC mode');
  if (keyPresses.length !== 1 || keyPresses[0] !== 0o21) fail('original VERB key was not forwarded to the AGC');
  if (AGCDSKY.savedReason !== 'clock keypad handoff') fail('handoff did not schedule AGC autosave');

  // A pending synthetic clock timer must not take ownership of COMP ACTY once
  // real AGC mode is active.
  classes.delete('on');
  if (timers.length) timers.shift().fn();
  if (classes.has('on')) fail('clock COMP ACTY touched lamp after AGC handoff');

  console.log('Clock mode behavior: PASS');
  console.log('  synthetic COMP ACTY timing and first-key AGC handoff verified');
})().catch(error => fail(error.stack || String(error)));
