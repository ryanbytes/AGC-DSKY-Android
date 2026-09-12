'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/src/main/assets/relay-visual-coupling.js'), 'utf8');
const stabilitySource = fs.readFileSync(path.join(root, 'app/src/main/assets/relay-stretch-stability.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');

function fail(message) {
  console.error(`RELAY VISUAL COUPLING FAIL: ${message}`);
  process.exit(1);
}

try { new vm.Script(source, {filename:'relay-visual-coupling.js'}); }
catch (error) { fail(`visual syntax error: ${error.message}`); }
try { new vm.Script(stabilitySource, {filename:'relay-stretch-stability.js'}); }
catch (error) { fail(`stability syntax error: ${error.message}`); }

const identityAt = index.indexOf('<script src="relay-identity-audio.js"></script>');
const visualAt = index.indexOf('<script src="relay-visual-coupling.js"></script>');
const stabilityAt = index.indexOf('<script src="relay-stretch-stability.js"></script>');
if (!(identityAt >= 0 && visualAt > identityAt)) fail('visual coupling must load after relay identity profiles');
if (!(stabilityAt > visualAt)) fail('stretched stability shield must load after visual coupling');
if (!index.includes('<button id="relay-timing">')) fail('relay timing switch missing from controls');

const timers = [];
const rendered = [];
const baseCalls = [];
const baseTicks = [];
const raf = [];
const storage = new Map();
const buttonListeners = {};
const timingButton = {
  textContent:'', title:'', attrs:{},
  addEventListener(type, fn) { buttonListeners[type] = fn; },
  setAttribute(name, value) { this.attrs[name] = String(value); }
};
const hardware = {latches:{10:0}, activeDrive:0};
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
    AGCDSKY: { hardware: () => ({latches:{...hardware.latches}, activeDrive:hardware.activeDrive}) },
    DSKY_RELAY_AUDIO: { profileFor: (_row, bit) => profile(bit) },
    DSKY_RELAY_MATRIX: { segmentsForCode: () => '' }
  },
  document: {
    getElementById: id => id === 'relay-timing' ? timingButton : null,
    querySelector: () => null
  },
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  showControls: () => {},
  decodeChannel10: value => { baseCalls.push(value); },
  emitTick: (ctx, when, strength) => { baseTicks.push({ctx, when, strength}); },
  tickSound: false,
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
vm.runInContext(stabilitySource, context, {filename:'relay-stretch-stability.js'});

const api = context.window.DSKY_RELAY_VISUAL;
const stability = context.window.DSKY_RELAY_STRETCH_STABILITY;
if (!api) fail('diagnostic API not exported');
if (!stability) fail('stretched stability diagnostic API not exported');
if (stability.mode !== 'settled-render-shield') fail('wrong stretched stability mode');
if (stability.settleShieldMs !== 20) fail('stretched settle shield must share the 20-ms hardware deadline');
if (api.mode !== 'individual-contact-coupled') fail('wrong visual coupling mode');
if (api.finalSettleMs !== 20) fail('20-ms final settle contract lost');
if (api.contactBounceVisible !== false) fail('visual bounce must remain disabled');
if (api.stretchedAudioFrameLocked !== true) fail('stretched audio is not frame locked');
if (api.stretchedBounceAudio !== false) fail('stretched mode must not replay bounce audio');
if (api.getTimingMode() !== 'authentic') fail('default timing mode must be authentic');
if (timingButton.textContent !== 'RELAY VISUAL AUTHENTIC') fail('authentic button label missing');
if (typeof buttonListeners.click !== 'function') fail('timing switch click handler missing');

// Authentic mode keeps original physical audio timing and receives no settle shield.
const fakeCtx = {currentTime:1};
hardware.activeDrive = 10;
context.emitTick(fakeCtx, 1.006, 0.66);
if (baseTicks.length !== 1) fail('authentic mode suppressed physical relay click');
hardware.activeDrive = 0;

// Row 10 is VERB. D-K1 is bit 0 and C-K1 is bit 5.
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

// Latching relay clicks at the authentic 5-15 ms markers are suppressed while
// stretched; the ~1-ms auxiliary path is intentionally left alone.
hardware.activeDrive = 10;
context.emitTick(fakeCtx, 1.006, 0.66);
if (baseTicks.length !== 1) fail('stretched mode did not suppress early latching click');
context.emitTick(fakeCtx, 1.001, 0.66);
if (baseTicks.length !== 2) fail('stretched mode incorrectly suppressed auxiliary-style click');
hardware.activeDrive = 0;

timers.length = 0;
rendered.length = 0;
raf.length = 0;
hardware.latches[10] = 0;
context.agcRelayWords[10] = 0;
context.agcDisplay.verb = [' ',' '];
context.decodeChannel10(command);
if (baseCalls.length !== 2 || baseCalls[1] !== command) fail('stretched mode bypassed base channel-010 path');
if (timers.length !== 3) fail(`expected shield + 2 stretched contact timers, got ${timers.length}`);
if (raf.length !== 1) fail('stretched mode did not start frame lock');

const initial = rendered[rendered.length - 1];
if (!initial || initial.id !== 'verb' || initial.text !== '  ') {
  fail(`stretched mode did not hold prior face: ${JSON.stringify(initial)}`);
}

const shield = timers.find(x => x.ms === 20);
const contactTimers = timers.filter(x => x.ms !== 20).sort((a,b) => a.ms - b.ms);
if (!shield) fail('20-ms settled-render shield missing');
const stretchedTimes = contactTimers.map(x => x.ms);
if (stretchedTimes[0] !== 27.3 || stretchedTimes[1] !== 55.3) {
  fail(`wrong brisk relay-specific stretched timing: ${stretchedTimes.join(',')}`);
}
if (!(stretchedTimes[1] - stretchedTimes[0] >= 18 && stretchedTimes[1] - stretchedTimes[0] <= 28)) {
  fail('stretched relay gap outside brisk screen-visible range');
}

const schedule = api.stretchedScheduleFor(10, 0, (1 << 5) | 1);
if (schedule.length !== 2 || schedule[0].bit !== 0 || schedule[1].bit !== 5) fail('stretched order lost physical relay order');
if (schedule[0].stretchedMs === schedule[1].stretchedMs) fail('relay identities collapsed to common stretched delay');

// Simulate hardware-fidelity's real 20-ms final-state render bleeding through.
// The equal-deadline shield must put both the display model and rendered face
// back at the held presentation before the first stretched contact occurs.
context.agcDisplay.verb = ['1','1'];
context.set2('verb', '11');
hardware.latches[10] = (1 << 5) | 1;
shield.fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '  ') fail(`settled render leaked through shield: ${JSON.stringify(last)}`);
if (context.agcDisplay.verb.join('') !== '  ') fail('settled render contaminated presentation model');

// Timer changes the presentation contact state, but both the EL paint and the
// clean click are committed together on the next animation frame.
contactTimers[0].fn();
last = rendered[rendered.length - 1];
if (!last || last.text !== '  ') fail('stretched contact painted before its synchronized frame');
if (api.lastPresentationClick() !== null) fail('stretched click fired before its visual frame');
let frame = raf.shift();
if (typeof frame !== 'function') fail('missing first synchronized animation frame');
frame();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== ' 1') fail(`bad first stretched frame: ${JSON.stringify(last)}`);
let click = api.lastPresentationClick();
if (!click || click.row !== 10 || click.bit !== 0 || click.engaging !== true) fail(`first stretched click not tied to first EL relay: ${JSON.stringify(click)}`);

contactTimers[1].fn();
frame = raf.shift();
if (typeof frame !== 'function') fail('missing second synchronized animation frame');
frame();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '11') fail(`bad final stretched frame: ${JSON.stringify(last)}`);
click = api.lastPresentationClick();
if (!click || click.row !== 10 || click.bit !== 5 || click.engaging !== true) fail(`second stretched click not tied to second EL relay: ${JSON.stringify(click)}`);

const release = timers.find(x => x.ms === 24);
if (!release) fail('final presentation release hold missing');
release.fn();

const verbFrames = rendered.filter(x => x.id === 'verb').map(x => x.text);
const transitionFrames = verbFrames.filter((x, i) => i === 0 || x !== verbFrames[i - 1]);
if (transitionFrames.join('|') !== '  |11|  | 1|11') {
  fail(`unexpected stretched transition history: ${transitionFrames.join('|')}`);
}

// A new stretched write must use the face currently being shown as its visual
// prior rather than snapping to the already-settled private hardware latch.
rendered.length = 0;
timers.length = 0;
raf.length = 0;
context.agcDisplay.verb = [' ','1'];
hardware.latches[10] = (1 << 5) | 1; // hardware is ahead at "11"
const followup = (10 << 11) | (1 << 5); // presentation should begin from " 1"
context.decodeChannel10(followup);
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== ' 1') {
  fail(`overlapping stretched write snapped to hardware-ahead state: ${JSON.stringify(last)}`);
}

buttonListeners.click();
if (api.getTimingMode() !== 'authentic') fail('switch did not return to authentic mode');
if (storage.get('relayVisualTimingV1') !== 'authentic') fail('authentic preference not persisted');

console.log('Relay visual coupling smoke: PASS');
console.log('  stretched EL is frame-synced, bounce-free, shielded at the 20-ms settled render, and continuous across overlapping writes');