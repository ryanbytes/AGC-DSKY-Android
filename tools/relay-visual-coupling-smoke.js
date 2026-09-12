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
if (!(stabilityAt > visualAt)) fail('stretched stability layer must load after visual coupling');
if (!index.includes('<button id="relay-timing">')) fail('relay timing switch missing from controls');
if (stabilitySource.includes('setTimeout(() => {\n      if (generation[row]')) fail('obsolete separate settle-shield timer returned');
if (!stabilitySource.includes('const heldWord = capturePresentedWord(row)')) fail('settle callback must capture current presentation at execution time');
if (!stabilitySource.includes('visual.renderWord(row, heldWord)')) fail('settle callback must restore held presentation before yielding');

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
let simulateHardwareSettle = false;

// The integration harness cares about optical state, not the literal private
// character used to represent an arbitrary seven-segment pattern. Code 1 is a
// simple one-segment fixture; the stability layer may replace it with a private
// character that has the same segment mask.
const SEG = {' ':'', '1':'a'};
const segmentsForCode = code => (Number(code) & 0x1f) === 1 ? 'a' : '';

function segmentMask(ch) {
  const order = 'abcdefg';
  const segments = SEG[ch] || '';
  let mask = 0;
  for (let i = 0; i < order.length; i++) if (segments.includes(order[i])) mask |= (1 << i);
  return mask;
}

function masksOfText(text) {
  return [...String(text)].map(segmentMask);
}

function sameMasks(actual, expected) {
  return actual.length === expected.length && actual.every((value, i) => value === expected[i]);
}

function latestVerbRender() {
  for (let i = rendered.length - 1; i >= 0; i--) if (rendered[i].id === 'verb') return rendered[i];
  return null;
}

function assertLatestVerbMasks(expected, label) {
  const item = latestVerbRender();
  if (!item) fail(`${label}: no VERB surface render`);
  const masks = masksOfText(item.text);
  if (!sameMasks(masks, expected)) fail(`${label}: masks ${masks.join(',')} expected ${expected.join(',')}`);
}

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

let context;
context = {
  console,
  SEG,
  window: {
    AGCDSKY: {hardware: () => ({latches:{...hardware.latches}, activeDrive:hardware.activeDrive})},
    DSKY_RELAY_AUDIO: {profileFor: (_row, bit) => profile(bit)},
    DSKY_RELAY_MATRIX: {segmentsForCode}
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
  decodeChannel10: value => {
    baseCalls.push(value);
    if (!simulateHardwareSettle) return;
    const target = Number(value) & 0o3777;
    context.setTimeout(() => {
      hardware.latches[10] = target;
      context.agcRelayWords[10] = target;
      const c = (target >> 5) & 0o37;
      const d = target & 0o37;
      context.agcDisplay.verb[0] = context.relayDigit(c);
      context.agcDisplay.verb[1] = context.relayDigit(d);
      context.set2('verb', context.agcDisplay.verb.join(''));
    }, 20);
  },
  emitTick: (ctx, when, strength) => baseTicks.push({ctx, when, strength}),
  tickSound: false,
  agcRelayWords: {10:0},
  agcDisplay: {
    prog:[' ',' '], verb:[' ',' '], noun:[' ',' '],
    r1:{plus:false,minus:false,digits:[' ',' ',' ',' ',' ']},
    r2:{plus:false,minus:false,digits:[' ',' ',' ',' ',' ']},
    r3:{plus:false,minus:false,digits:[' ',' ',' ',' ',' ']}
  },
  relayDigit: code => (Number(code) & 0x1f) === 0 ? ' ' : String(Number(code) & 0x1f),
  set2: (id, text) => rendered.push({id, text:String(text)}),
  setReg: (id, sign, digits) => rendered.push({id, sign:String(sign), text:String(digits)}),
  renderAgcReg: id => rendered.push({id, text:'reg'}),
  setLamp: (id, on) => rendered.push({id, on}),
  setTimeout: (fn, ms) => { timers.push({fn, ms:Number(ms)}); return timers.length; },
  requestAnimationFrame: fn => { raf.push(fn); return raf.length; }
};
context.globalThis = context;
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, {filename:'relay-visual-coupling.js'});
vm.runInContext(stabilitySource, context, {filename:'relay-stretch-stability.js'});

const api = context.window.DSKY_RELAY_VISUAL;
const stability = context.window.DSKY_RELAY_STRETCH_STABILITY;
if (!api) fail('diagnostic API not exported');
if (!stability) fail('stretched stability diagnostic API not exported');
if (stability.mode !== 'same-task-settle-shield') fail('wrong stretched stability mode');
if (stability.settleShieldMs !== 20) fail('stretched settle shield must share the 20-ms hardware deadline');
if (stability.settleRepaintSameTask !== true) fail('settled presentation is not restored in the same JavaScript task');
if (stability.settleCrewFacingWriteSuppressed !== true) fail('hardware settle can still paint/advance stretched optical state');
if (stability.eventDrivenDomWrites !== true) fail('stretched identical DOM writes are not suppressed');
if (stability.monotonicSegments !== true) fail('stretched segment reversals are not guarded');
if (api.mode !== 'individual-contact-coupled') fail('wrong visual coupling mode');
if (api.finalSettleMs !== 20) fail('20-ms final settle contract lost');
if (api.contactBounceVisible !== false) fail('visual bounce must remain disabled');
if (api.stretchedAudioFrameLocked !== true) fail('stretched audio is not frame locked');
if (api.stretchedBounceAudio !== false) fail('stretched mode must not replay bounce audio');
if (api.getTimingMode() !== 'authentic') fail('default timing mode must be authentic');
if (timingButton.textContent !== 'RELAY VISUAL AUTHENTIC') fail('authentic button label missing');
if (typeof buttonListeners.click !== 'function') fail('timing switch click handler missing');

const fakeCtx = {currentTime:1};
hardware.activeDrive = 10;
context.emitTick(fakeCtx, 1.006, 0.66);
if (baseTicks.length !== 1) fail('authentic mode suppressed physical relay click');
hardware.activeDrive = 0;

// Authentic mode: physical per-relay set timing remains unchanged.
const command = (10 << 11) | (1 << 5) | 1;
context.decodeChannel10(command);
if (baseCalls.length !== 1 || baseCalls[0] !== command) fail('base channel-010 path not preserved');
if (timers.length !== 2) fail(`expected 2 authentic relay timers, got ${timers.length}`);
timers.sort((a,b) => a.ms - b.ms);
if (timers[0].ms !== 5 || timers[1].ms !== 11) fail(`authentic relay timing changed: ${timers.map(x=>x.ms).join(',')}`);
timers[0].fn();
assertLatestVerbMasks([0,1], 'first authentic contact');
timers[1].fn();
assertLatestVerbMasks([1,1], 'final authentic contact');

buttonListeners.click();
if (api.getTimingMode() !== 'stretched') fail('switch did not enter stretched mode');
if (storage.get('relayVisualTimingV1') !== 'stretched') fail('stretched preference not persisted');
if (timingButton.textContent !== 'RELAY VISUAL STRETCHED') fail('stretched button label missing');

// Latching clicks at authentic 5-15 ms markers are suppressed in stretched
// mode; auxiliary-style ~1-ms events stay on their physical path.
hardware.activeDrive = 10;
context.emitTick(fakeCtx, 1.006, 0.66);
if (baseTicks.length !== 1) fail('stretched mode did not suppress early latching click');
context.emitTick(fakeCtx, 1.001, 0.66);
if (baseTicks.length !== 2) fail('stretched mode incorrectly suppressed auxiliary-style click');
hardware.activeDrive = 0;

simulateHardwareSettle = true;
timers.length = 0;
rendered.length = 0;
raf.length = 0;
hardware.latches[10] = 0;
context.agcRelayWords[10] = 0;
context.agcDisplay.verb = [' ',' '];
context.decodeChannel10(command);
if (baseCalls.length !== 2 || baseCalls[1] !== command) fail('stretched mode bypassed base channel-010 path');
if (context.agcDisplay.verb.join('') !== '  ') fail('stretched write did not begin from presented blank face');
if (raf.length !== 1) fail('stretched mode did not start frame lock');

const settle = timers.find(x => Math.abs(x.ms - 20) < 0.001);
const contactTimers = timers.filter(x => Math.abs(x.ms - 20) >= 0.001).sort((a,b) => a.ms - b.ms);
if (!settle) fail('wrapped 20-ms hardware settle timer missing');
if (contactTimers.length !== 2) fail(`expected 2 stretched contact timers, got ${contactTimers.length}`);
const stretchedTimes = contactTimers.map(x => x.ms);
if (stretchedTimes[0] !== 27.3 || stretchedTimes[1] !== 55.3) fail(`wrong brisk stretched timing: ${stretchedTimes.join(',')}`);
if (!(stretchedTimes[1] - stretchedTimes[0] >= 18 && stretchedTimes[1] - stretchedTimes[0] <= 28)) fail('stretched gap outside screen-visible range');

const schedule = api.stretchedScheduleFor(10, 0, (1 << 5) | 1);
if (schedule.length !== 2 || schedule[0].bit !== 0 || schedule[1].bit !== 5) fail('stretched order lost physical relay order');
if (schedule[0].stretchedMs === schedule[1].stretchedMs) fail('relay identities collapsed to common delay');

// The real latch reaches the target at 20 ms, but that hidden settle may not
// paint the final word or advance the optical guard. The held face is restored
// before this task returns.
const settleStart = rendered.length;
settle.fn();
if (hardware.latches[10] !== ((1 << 5) | 1)) fail('physical latch did not settle at 20 ms');
if (context.agcDisplay.verb.join('') !== '  ') fail('hardware settle contaminated presented model');
const settleVerb = rendered.slice(settleStart).filter(x => x.id === 'verb');
for (const item of settleVerb) {
  if (!sameMasks(masksOfText(item.text), [0,0])) fail('hardware-ahead final EL escaped during 20-ms settle');
}

// First stretched contact: timer alone does not paint or click. The next screen
// frame commits both together.
const beforeFirstContactPaints = rendered.length;
contactTimers[0].fn();
if (rendered.length !== beforeFirstContactPaints) fail('stretched contact painted before synchronized frame');
if (api.lastPresentationClick() !== null) fail('stretched click fired before visual frame');
let frame = raf.shift();
if (typeof frame !== 'function') fail('missing first synchronized animation frame');
frame();
assertLatestVerbMasks([0,1], 'first stretched frame');
let click = api.lastPresentationClick();
if (!click || click.row !== 10 || click.bit !== 0 || click.engaging !== true) fail(`first stretched click mismatch: ${JSON.stringify(click)}`);

// The frame lock may continue to run to protect timing, but an unchanged EL
// state must not rebuild the SVG. This is the Android-WebView shimmer regression.
const afterFirstPaints = rendered.length;
let holdFrame = raf.shift();
if (typeof holdFrame !== 'function') fail('missing stretched hold frame');
holdFrame();
if (rendered.length !== afterFirstPaints) fail('unchanged stretched frame rebuilt EL DOM');

contactTimers[1].fn();
frame = raf.shift();
if (typeof frame !== 'function') fail('missing second synchronized animation frame');
frame();
assertLatestVerbMasks([1,1], 'final stretched frame');
click = api.lastPresentationClick();
if (!click || click.row !== 10 || click.bit !== 5 || click.engaging !== true) fail(`second stretched click mismatch: ${JSON.stringify(click)}`);

const release = timers.find(x => Math.abs(x.ms - 24) < 0.001);
if (!release) fail('final presentation release hold missing');
release.fn();
while (raf.length) {
  const pending = raf.shift();
  if (typeof pending === 'function') pending();
}

// Video regression: D is already visibly ON and a later word legitimately
// resets it. The 20-ms physical settle must not make it disappear; only the
// stretched reset contact/frame may do that.
rendered.length = 0;
timers.length = 0;
raf.length = 0;
context.agcDisplay.verb = ['1','1'];
hardware.latches[10] = (1 << 5) | 1;
context.agcRelayWords[10] = (1 << 5) | 1;
const resetD = (10 << 11) | (1 << 5);
context.decodeChannel10(resetD);
if (context.agcDisplay.verb.join('') !== '11') fail('post-on regression did not start from lit face');

const resetSettle = timers.find(x => Math.abs(x.ms - 20) < 0.001);
const resetContacts = timers.filter(x => Math.abs(x.ms - 20) >= 0.001).sort((a,b) => a.ms - b.ms);
if (!resetSettle || resetContacts.length !== 1) fail('post-on regression missing settle/reset contact');
if (!(resetContacts[0].ms > 20)) fail('stretched reset must remain later than physical settle');

const beforeResetSettlePaints = rendered.length;
resetSettle.fn();
if (hardware.latches[10] !== (1 << 5)) fail('physical reset latch did not settle');
if (context.agcDisplay.verb.join('') !== '11') fail('lit element dropped at physical settle boundary');
for (const item of rendered.slice(beforeResetSettlePaints).filter(x => x.id === 'verb')) {
  if (!sameMasks(masksOfText(item.text), [1,1])) fail('20-ms settle exposed premature reset');
}

const beforeResetContactPaints = rendered.length;
resetContacts[0].fn();
if (rendered.length !== beforeResetContactPaints) fail('reset contact painted before synchronized frame');
frame = raf.shift();
if (typeof frame !== 'function') fail('missing synchronized reset frame');
frame();
assertLatestVerbMasks([1,0], 'legitimate stretched reset');
click = api.lastPresentationClick();
if (!click || click.row !== 10 || click.bit !== 0 || click.engaging !== false) fail(`reset click mismatch: ${JSON.stringify(click)}`);

// An overlapping write begins from the face actually being shown, even when
// the physical latch is ahead.
rendered.length = 0;
timers.length = 0;
raf.length = 0;
context.agcDisplay.verb = [' ','1'];
hardware.latches[10] = (1 << 5) | 1;
context.agcRelayWords[10] = (1 << 5) | 1;
const followup = (10 << 11) | (1 << 5);
context.decodeChannel10(followup);
if (context.agcDisplay.verb.join('') !== ' 1') fail('overlapping stretched write snapped to hardware-ahead latch');
const overlapRender = latestVerbRender();
if (overlapRender && !sameMasks(masksOfText(overlapRender.text), [0,1])) fail('overlapping write painted hardware-ahead surface');

buttonListeners.click();
if (api.getTimingMode() !== 'authentic') fail('switch did not return to authentic mode');
if (storage.get('relayVisualTimingV1') !== 'authentic') fail('authentic preference not persisted');

console.log('Relay visual coupling smoke: PASS');
console.log('  authentic relay timing preserved');
console.log('  stretched clicks remain frame-synchronized');
console.log('  hidden 20-ms settle cannot paint or advance stretched EL');
console.log('  unchanged frame-lock redraws cannot rebuild SVG DOM');
console.log('  already-lit element cannot drop before legitimate stretched reset');
