'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/src/main/assets/relay-visual-coupling.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');

function fail(message) {
  console.error(`RELAY VISUAL COUPLING FAIL: ${message}`);
  process.exit(1);
}

try { new vm.Script(source, {filename:'relay-visual-coupling.js'}); }
catch (error) { fail(`syntax error: ${error.message}`); }

const identityAt = index.indexOf('<script src="relay-identity-audio.js"></script>');
const visualAt = index.indexOf('<script src="relay-visual-coupling.js"></script>');
if (!(identityAt >= 0 && visualAt > identityAt)) {
  fail('visual coupling must load after relay identity profiles');
}
if (!index.includes('<button id="relay-timing">')) {
  fail('relay timing switch missing from controls');
}

const timers = [];
const rendered = [];
const baseCalls = [];
const storage = new Map();
const buttonListeners = {};
const timingButton = {
  textContent:'', title:'', attrs:{},
  addEventListener(type, fn) { buttonListeners[type] = fn; },
  setAttribute(name, value) { this.attrs[name] = String(value); }
};
const hardware = {latches:{10:0}};
const context = {
  console,
  window: {
    AGCDSKY: {
      hardware: () => ({latches:{...hardware.latches}})
    },
    DSKY_RELAY_AUDIO: {
      profileFor: (_row, bit) => ({
        setTravelMs: bit === 0 ? 5 : bit === 5 ? 11 : 8,
        resetTravelMs: bit === 0 ? 6 : bit === 5 ? 12 : 9
      })
    },
    DSKY_RELAY_MATRIX: {
      segmentsForCode: () => ''
    }
  },
  document: {
    getElementById: id => id === 'relay-timing' ? timingButton : null
  },
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  showControls: () => {},
  decodeChannel10: value => { baseCalls.push(value); },
  agcRelayWords: {10:0},
  agcDisplay: {
    prog:[' ',' '], verb:[' ',' '], noun:[' ',' '],
    r1:{plus:false,minus:false,digits:[' ',' ',' ',' ',' ']},
    r2:{plus:false,minus:false,digits:[' ',' ',' ',' ',' ']},
    r3:{plus:false,minus:false,digits:[' ',' ',' ',' ',' ']}
  },
  relayDigit: code => code === 0 ? ' ' : String(code),
  set2: (id, text) => rendered.push({id, text}),
  renderAgcReg: id => rendered.push({id, text:'reg'}),
  setLamp: (id, on) => rendered.push({id, on}),
  setTimeout: (fn, ms) => { timers.push({fn, ms}); return timers.length; }
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, {filename:'relay-visual-coupling.js'});

const api = context.window.DSKY_RELAY_VISUAL;
if (!api) fail('diagnostic API not exported');
if (api.mode !== 'individual-contact-coupled') fail('wrong visual coupling mode');
if (api.finalSettleMs !== 20) fail('20-ms final settle contract lost');
if (api.getTimingMode() !== 'authentic') fail('default timing mode must be authentic');
if (timingButton.textContent !== 'RELAY VISUAL AUTHENTIC') fail('authentic button label missing');
if (typeof buttonListeners.click !== 'function') fail('timing switch click handler missing');

// Row 10 is VERB. D-K1 is bit 0 and C-K1 is bit 5. In authentic mode the
// visual layer must use their actual individual 5-ms and 11-ms travel times.
const command = (10 << 11) | (1 << 5) | 1;
context.decodeChannel10(command);
if (baseCalls.length !== 1 || baseCalls[0] !== command) fail('base channel-010 path not preserved');
if (timers.length !== 2) fail(`expected 2 authentic relay timers, got ${timers.length}`);
timers.sort((a,b) => a.ms - b.ms);
if (timers[0].ms !== 5 || timers[1].ms !== 11) {
  fail(`authentic relay profile timing not used: ${timers.map(x=>x.ms).join(',')}`);
}
timers[0].fn();
let last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== ' 1') {
  fail(`first authentic relay did not produce intermediate VERB state: ${JSON.stringify(last)}`);
}
timers[1].fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '11') {
  fail(`second authentic relay did not complete VERB state: ${JSON.stringify(last)}`);
}

// Switch to stretched presentation. The actual channel-010 path still runs
// immediately, but visual-only timers restore the prior face just after the
// 20-ms physical settle and replay the two contacts on separate phone frames.
buttonListeners.click();
if (api.getTimingMode() !== 'stretched') fail('switch did not enter stretched mode');
if (storage.get('relayVisualTimingV1') !== 'stretched') fail('stretched preference not persisted');
if (timingButton.textContent !== 'RELAY VISUAL STRETCHED') fail('stretched button label missing');

timers.length = 0;
rendered.length = 0;
hardware.latches[10] = 0;
context.agcRelayWords[10] = 0;
context.decodeChannel10(command);
if (baseCalls.length !== 2 || baseCalls[1] !== command) fail('stretched mode bypassed base channel-010 path');
if (timers.length !== 3) fail(`expected reset + 2 stretched timers, got ${timers.length}`);
timers.sort((a,b) => a.ms - b.ms);
const stretchedTimes = timers.map(x => x.ms);
if (stretchedTimes[0] !== 20.5 || stretchedTimes[1] !== 38 || stretchedTimes[2] !== 60) {
  fail(`wrong stretched timing: ${stretchedTimes.join(',')}`);
}

timers[0].fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '  ') {
  fail(`stretched reset did not restore prior VERB state: ${JSON.stringify(last)}`);
}
timers[1].fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== ' 1') {
  fail(`first stretched relay did not produce intermediate VERB state: ${JSON.stringify(last)}`);
}
timers[2].fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '11') {
  fail(`second stretched relay did not complete VERB state: ${JSON.stringify(last)}`);
}
if (api.presentationDurationMs(2) !== 60) fail('stretched duration diagnostic wrong');

buttonListeners.click();
if (api.getTimingMode() !== 'authentic') fail('switch did not return to authentic mode');
if (storage.get('relayVisualTimingV1') !== 'authentic') fail('authentic preference not persisted');

console.log('Relay visual coupling smoke: PASS');
console.log('  authentic mode keeps physical contact timing; stretched mode preserves order while making relay changes screen-visible');
