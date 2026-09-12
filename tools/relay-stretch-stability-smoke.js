'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/src/main/assets/relay-stretch-stability.js'), 'utf8');

function fail(message) {
  console.error(`RELAY STRETCH STABILITY FAIL: ${message}`);
  process.exit(1);
}

try { new vm.Script(source, {filename:'relay-stretch-stability.js'}); }
catch (error) { fail(`syntax error: ${error.message}`); }

let timingMode = 'stretched';
const SEG = {};
const chars = Array.from({length:32}, (_, i) => String.fromCharCode(0xe000 + i));
const segmentsByCode = {0:'', 1:'a', 2:'', 3:'a', 4:'b', 5:'ab'};
for (let i = 0; i < 32; i++) SEG[chars[i]] = segmentsByCode[i] || '';

const pairRenders = [];
const regRenders = [];
const timers = [];
const hardware = {latches:{10:0}};

const agcDisplay = {
  prog:[chars[0],chars[0]],
  verb:[chars[0],chars[0]],
  noun:[chars[0],chars[0]],
  r1:{digits:Array(5).fill(chars[0]),plus:false,minus:false},
  r2:{digits:Array(5).fill(chars[0]),plus:false,minus:false},
  r3:{digits:Array(5).fill(chars[0]),plus:false,minus:false}
};

function maskForChar(ch) {
  let mask = 0;
  const order = 'abcdefg';
  const segments = SEG[ch] || '';
  for (let i = 0; i < order.length; i++) if (segments.includes(order[i])) mask |= (1 << i);
  return mask;
}

const context = {
  console,
  SEG,
  agcDisplay,
  agcRelayWords:{10:0},
  relayDigit: code => chars[Number(code) & 31],
  document:{querySelector:() => null},
  set2:(id,text) => pairRenders.push({id,text:String(text)}),
  setReg:(id,sign,digits) => regRenders.push({id,sign:String(sign),digits:String(digits)}),
  setTimeout:(fn,ms) => { timers.push({fn,ms}); return timers.length; },
  decodeChannel10:() => {},
  window:{
    AGCDSKY:{hardware:() => ({latches:{...hardware.latches}})},
    DSKY_RELAY_VISUAL:{
      getTimingMode:() => timingMode,
      renderWord:() => {},
      finalSettleMs:20,
      presentationDurationMs:() => 100
    },
    DSKY_RELAY_MATRIX:{segmentsForCode:code => segmentsByCode[Number(code) & 31] || ''}
  }
};
context.globalThis = context;
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, {filename:'relay-stretch-stability.js'});

const api = context.window.DSKY_RELAY_STRETCH_STABILITY;
if (!api) fail('diagnostic API missing');
if (api.eventDrivenDomWrites !== true) fail('identical stretched DOM writes are not suppressed');
if (api.monotonicSegments !== true) fail('monotonic segment filter missing');

// Target row 10 D-character is code 3 => segment a ON. Intermediate code 1
// turns a on, code 2 would turn it back off, and code 3 turns it on again.
// Stretched presentation must draw only the first ON edge.
context.decodeChannel10((10 << 11) | 3);
context.set2('verb', chars[0] + chars[1]);
context.set2('verb', chars[0] + chars[2]);
context.set2('verb', chars[0] + chars[3]);
if (pairRenders.length !== 1) fail(`on-off-on produced ${pairRenders.length} DOM paints instead of 1`);
const firstMasks = [...pairRenders[0].text].map(maskForChar);
if (firstMasks[1] !== 1) fail(`target segment a not held on: ${firstMasks[1]}`);

// A segment that is OFF both before and after a transition must not flash ON
// merely because an intermediate relay matrix state contains it.
pairRenders.length = 0;
hardware.latches[10] = 0;
context.agcDisplay.verb = [chars[0],chars[0]];
context.decodeChannel10((10 << 11) | 0);
context.set2('verb', chars[0] + chars[1]);
context.set2('verb', chars[0] + chars[0]);
if (pairRenders.length !== 1) fail(`unchanged-off segment produced ${pairRenders.length} paints`);
const spuriousMasks = [...pairRenders[0].text].map(maskForChar);
if (spuriousMasks[1] !== 0) fail('unchanged-off segment flashed on');

// Reasserting an identical stretched frame must not rebuild the SVG surface.
pairRenders.length = 0;
context.set2('verb', chars[0] + chars[0]);
context.set2('verb', chars[0] + chars[0]);
if (pairRenders.length !== 0) fail('identical stretched frame rebuilt DOM');

// Authentic mode is a pass-through and must not inherit stretched filtering.
timingMode = 'authentic';
context.set2('verb', chars[0] + chars[1]);
context.set2('verb', chars[0] + chars[2]);
if (pairRenders.length !== 2) fail('authentic mode was filtered or deduplicated');

console.log('relay stretch stability smoke: PASS');
console.log('  same-state SVG redraw suppression: PASS');
console.log('  stretched segment on-off-on reversal suppression: PASS');
console.log('  stretched unchanged-segment flash suppression: PASS');
console.log('  authentic mode pass-through: PASS');
