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
if (!(identityAt >= 0 && visualAt > identityAt)) fail('visual coupling must load after relay identity profiles');
if (!index.includes('<button id="relay-timing">')) fail('relay timing switch missing from controls');

const timers = [];
const rendered = [];
const baseCalls = [];
const raf = [];
const storage = new Map();
const buttonListeners = {};
const timingButton = {
  textContent:'', title:'', attrs:{},
  addEventListener(type, fn) { buttonListeners[type] = fn; },
  setAttribute(name, value) { this.attrs[name] = String(value); }
};
const hardware = {latches:{10:0}};
function profile(bit) {
  if (bit === 0) return {
    setTravelMs:5, resetTravelMs:6,
    setStableMs:6, resetStableMs:7.1,
    setBounceCount:2, resetBounceCount:1,
    poleSkewUs:33
  };
  if (bit === 5) return {
    setTravelMs:11, resetTravelMs:12,
    setStableMs:13, resetStableMs:13.5,
    setBounceCount:4, resetBounceCount:2,
    poleSkewUs:-110
  };
  return {
    setTravelMs:8, resetTravelMs:9,
    setStableMs:9.2, resetStableMs:10,
    setBounceCount:3, resetBounceCount:2,
    poleSkewUs:71
  };
}
const context = {
  console,
  window: {
    AGCDSKY: { hardware: () => ({latches:{...hardware.latches}}) },
    DSKY_RELAY_AUDIO: { profileFor: (_row, bit) => profile(bit) },
    DSKY_RELAY_MATRIX: { segmentsForCode: () => '' }
  },
  document: { getElementById: id => id === 'relay-timing' ? timingButton : null },
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
  setTimeout: (fn, ms) => { timers.push({fn, ms}); return timers.length; },
  requestAnimationFrame: fn => { raf.push(fn); return raf.length; }
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, {filename:'relay-visual-coupling.js'});

const api = context.window.DSKY_RELAY_VISUAL;
if (!api) fail('diagnostic API not exported');
if (api.mode !== 'individual-contact-coupled') fail('wrong visual coupling mode');
if (api.finalSettleMs !== 20) fail('20-ms final settle contract lost');
if (api.contactBounceVisible !== false) fail('visual bounce must remain disabled');
if (api.getTimingMode() !== 'authentic') fail('default timing mode must be authentic');
if (timingButton.textContent !== 'RELAY VISUAL AUTHENTIC') fail('authentic button label missing');
if (typeof buttonListeners.click !== 'function') fail('timing switch click handler missing');

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
if (!last || last.id !== 'verb' || last.text !== ' 1') fail(`bad first authentic state: ${JSON.stringify(last)}`);
timers[1].fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '11') fail(`bad final authentic state: ${JSON.stringify(last)}`);

buttonListeners.click();
if (api.getTimingMode() !== 'stretched') fail('switch did not enter stretched mode');
if (storage.get('relayVisualTimingV1') !== 'stretched') fail('stretched preference not persisted');
if (timingButton.textContent !== 'RELAY VISUAL STRETCHED') fail('stretched button label missing');

timers.length = 0;
rendered.length = 0;
raf.length = 0;
hardware.latches[10] = 0;
context.agcRelayWords[10] = 0;
context.decodeChannel10(command);
if (baseCalls.length !== 2 || baseCalls[1] !== command) fail('stretched mode bypassed base channel-010 path');
if (timers.length !== 2) fail(`expected only 2 stretched contact timers, got ${timers.length}`);
if (raf.length !== 1) fail('stretched mode did not start frame lock');

const initial = rendered[rendered.length - 1];
if (!initial || initial.id !== 'verb' || initial.text !== '  ') {
  fail(`stretched mode did not hold prior face: ${JSON.stringify(initial)}`);
}

timers.sort((a,b) => a.ms - b.ms);
const stretchedTimes = timers.map(x => x.ms);
if (stretchedTimes[0] !== 86.4 || stretchedTimes[1] !== 164.4) {
  fail(`wrong relay-specific stretched timing: ${stretchedTimes.join(',')}`);
}
if (stretchedTimes[1] - stretchedTimes[0] < 42) fail('stretched relay gap is not visibly separated');

const schedule = api.stretchedScheduleFor(10, 0, (1 << 5) | 1);
if (schedule.length !== 2 || schedule[0].bit !== 0 || schedule[1].bit !== 5) fail('stretched order lost physical relay order');
if (schedule[0].stretchedMs === schedule[1].stretchedMs) fail('relay identities collapsed to common stretched delay');

timers[0].fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== ' 1') fail(`bad first stretched state: ${JSON.stringify(last)}`);

timers[1].fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '11') fail(`bad final stretched state: ${JSON.stringify(last)}`);
if (timers.length !== 3 || timers[2].ms !== 38) fail('final presentation release hold missing');
timers[2].fn();

const verbFrames = rendered.filter(x => x.id === 'verb').map(x => x.text);
const transitionFrames = verbFrames.filter((x, i) => i === 0 || x !== verbFrames[i - 1]);
if (transitionFrames.join('|') !== '  | 1|11') {
  fail(`unexpected stretched flicker/reversal: ${transitionFrames.join('|')}`);
}

buttonListeners.click();
if (api.getTimingMode() !== 'authentic') fail('switch did not return to authentic mode');
if (storage.get('relayVisualTimingV1') !== 'authentic') fail('authentic preference not persisted');

console.log('Relay visual coupling smoke: PASS');
console.log('  authentic timing preserved; stretched timing is slower, per-relay, frame-locked, and bounce-free visually');
