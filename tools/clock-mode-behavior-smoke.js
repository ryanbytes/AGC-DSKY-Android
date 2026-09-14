#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/clock-behavior.js'), 'utf8');
const fail = message => { console.error('CLOCK MODE BEHAVIOR FAIL: ' + message); process.exit(1); };

for (const marker of [
  "mode !== 'clock' && mode !== 'agc-loading'",
  'await api.enterAgc()',
  'core.keyPress(code)',
  "scheduleAgcAutosave('clock keypad handoff')"
]) {
  if (!source.includes(marker)) fail('missing behavior marker: ' + marker);
}
for (const forbidden of [
  '[data-lamp="comp"]',
  'Math.random',
  'randomBetween',
  'startClockCompBurst',
  'scheduleClockCompIdle'
]) {
  if (source.includes(forbidden)) fail('clock COMP ACTY synthesis must remain disabled: ' + forbidden);
}
if (/fetch\s*\(/.test(source) || /XMLHttpRequest/.test(source)) fail('clock behavior must not be tied to network activity');

let mode = 'clock';
const keyPresses = [];
const handlers = {};
const timers = [];
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
  addEventListener(name,fn){ handlers[name] = fn; }
};
const context = {
  window:windowObject,
  document:documentObject,
  console,
  setTimeout(fn,delay){ timers.push({fn,delay}); return timers.length; },
  clearTimeout(){},
  Promise
};

try { vm.runInNewContext(source, context, {filename:'clock-behavior.js'}); }
catch (error) { fail('script execution failed: ' + error.stack); }

(async () => {
  if (timers.length) fail('clock mode started an unsolicited timer before keypad input');

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
  if (timers.length !== 1 || timers[0].delay !== 90) fail('only keypad press animation timer should remain');

  console.log('Clock mode behavior: PASS');
  console.log('  no synthetic COMP ACTY; first-key AGC handoff verified');
})().catch(error => fail(error.stack || String(error)));
