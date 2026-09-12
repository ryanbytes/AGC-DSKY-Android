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
if (stabilitySource.includes('setTimeout(() => {\n      if (generation[row]')) {
  fail('obsolete separate settle-shield timer returned');
}
if (!stabilitySource.includes('const heldWord = capturePresentedWord(row)')) {
  fail('settle callback must capture the currently presented word at execution time');
}
if (!stabilitySource.includes('visual.renderWord(row, heldWord)')) {
  fail('settle callback must restore the current presentation before yielding');
}

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
if (stability.settleRepaintSameTask !== true) fail('settled paint is not restored in the same JavaScript task');
if (api.mode !== 'individual-contact-coupled') fail('wrong visual coupling mode');
if (api.finalSettleMs !== 20) fail('20-ms final settle contract lost');
if (api.contactBounceVisible !== false) fail('visual bounce must remain disabled');
if (api.stretchedAudioFrameLocked !== true) fail('stretched audio is not frame locked');
if (api.stretchedBounceAudio !== false) fail('stretched mode must not replay bounce audio');
if (api.getTimingMode() !== 'authentic') fail('default timing mode must be authentic');
if (timingButton.textContent !== 'RELAY VISUAL AUTHENTIC') fail('authentic button label missing');
if (typeof buttonListeners.click !== 'function') fail('timing switch click handler missing');

// Authentic mode keeps original physical audio and visual timing. The test's
// synthetic 20-ms hardware paint is disabled here so the existing contact gate
// remains isolated from the stretched-only stability layer.
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

// From here on the mock base decoder reproduces the real hardware layer's
// settled-word paint at 20 ms. The stability wrapper must make that paint and
// its restoration atomic from the browser's point of view.
simulateHardwareSettle = true;
timers.length = 0;
rendered.length = 0;
raf.length = 0;
hardware.latches[10] = 0;
context.agcRelayWords[10] = 0;
context.agcDisplay.verb = [' ',' '];
context.decodeChannel10(command);
if (baseCalls.length !== 2 || baseCalls[1] !== command) fail('stretched mode bypassed base channel-010 path');
if (timers.length !== 3) fail(`expected hardware settle + 2 stretched contact timers, got ${timers.length}`);
if (raf.length !== 1) fail('stretched mode did not start frame lock');

const initial = rendered[rendered.length - 1];
if (!initial || initial.id !== 'verb' || initial.text !== '  ') {
  fail(`stretched mode did not hold prior face: ${JSON.stringify(initial)}`);
}

const settle = timers.find(x => x.ms === 20);
const contactTimers = timers.filter(x => x.ms !== 20).sort((a,b) => a.ms - b.ms);
if (!settle) fail('wrapped 20-ms hardware settle timer missing');
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

// The real 20-ms latch commits target "11", but the wrapped callback restores
// the currently visible blank face before the same task yields. There is no
// separate timer/task in which the hidden final word can reach a screen frame.
const settleStart = rendered.length;
settle.fn();
const settleRenders = rendered.slice(settleStart).filter(x => x.id === 'verb').map(x => x.text);
if (settleRenders.join('|') !== '11|  ') {
  fail(`settle paint was not restored atomically: ${settleRenders.join('|')}`);
}
last = rendered[rendered.length - 1];
if (!last || last.text !== '  ') fail(`settle callback ended on hidden hardware state: ${JSON.stringify(last)}`);
if (context.agcDisplay.verb.join('') !== '  ') fail('settle callback left presentation model contaminated');

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

let release = timers.find(x => x.ms === 24);
if (!release) fail('final presentation release hold missing');
release.fn();

// Exact video regression: an element is already visibly ON. A later channel
// word wants that relay OFF. At 20 ms the real latch is allowed to settle OFF,
// but the element must remain visibly ON until its stretched reset contact.
rendered.length = 0;
timers.length = 0;
raf.length = 0;
context.agcDisplay.verb = ['1','1'];
hardware.latches[10] = (1 << 5) | 1;
context.agcRelayWords[10] = (1 << 5) | 1;
const resetD = (10 << 11) | (1 << 5); // C-K1 stays on; D-K1 legitimately resets later.
context.decodeChannel10(resetD);
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '11') fail('post-on regression did not start from lit face');

const resetSettle = timers.find(x => x.ms === 20);
const resetContact = timers.filter(x => x.ms !== 20 && x.ms !== 24).sort((a,b) => a.ms - b.ms)[0];
if (!resetSettle || !resetContact) fail('post-on regression missing settle/contact timing');
if (!(resetContact.ms > 20)) fail('reset contact must remain later than physical settle in stretched mode');

const postOnSettleStart = rendered.length;
resetSettle.fn();
const postOnSettleRenders = rendered.slice(postOnSettleStart).filter(x => x.id === 'verb').map(x => x.text);
if (postOnSettleRenders.join('|') !== '1 |11') {
  fail(`post-on settle did not atomically preserve lit element: ${postOnSettleRenders.join('|')}`);
}
last = rendered[rendered.length - 1];
if (!last || last.text !== '11') fail(`lit element dropped at settle task boundary: ${JSON.stringify(last)}`);
if (context.agcDisplay.verb.join('') !== '11') fail('lit presentation state was rolled back by physical settle');

resetContact.fn();
last = rendered[rendered.length - 1];
if (!last || last.text !== '11') fail('reset contact painted before synchronized frame');
frame = raf.shift();
if (typeof frame !== 'function') fail('missing synchronized reset animation frame');
frame();
last = rendered[rendered.length - 1];
if (!last || last.text !== '1 ') fail(`legitimate stretched reset did not change element: ${JSON.stringify(last)}`);
click = api.lastPresentationClick();
if (!click || click.row !== 10 || click.bit !== 0 || click.engaging !== false) fail(`reset click not tied to visible reset: ${JSON.stringify(click)}`);

// A new stretched write still begins from the face currently being shown rather
// than snapping to a hardware-ahead latch.
rendered.length = 0;
timers.length = 0;
raf.length = 0;
context.agcDisplay.verb = [' ','1'];
hardware.latches[10] = (1 << 5) | 1; // hardware is ahead at "11"
context.agcRelayWords[10] = (1 << 5) | 1;
const followup = (10 << 11) | (1 << 5);
context.decodeChannel10(followup);
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== ' 1') {
  fail(`overlapping stretched write snapped to hardware-ahead state: ${JSON.stringify(last)}`);
}

buttonListeners.click();
if (api.getTimingMode() !== 'authentic') fail('switch did not return to authentic mode');
if (storage.get('relayVisualTimingV1') !== 'authentic') fail('authentic preference not persisted');

console.log('Relay visual coupling smoke: PASS');
console.log('  stretched EL is frame-synced, bounce-free, same-task shielded at 20 ms, and cannot drop an already-lit element before its legitimate reset contact');
