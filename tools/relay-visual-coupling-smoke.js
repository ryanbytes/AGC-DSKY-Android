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

const timers = [];
const rendered = [];
const baseCalls = [];
const context = {
  console,
  window: {
    AGCDSKY: {
      hardware: () => ({latches:{10:0}})
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

if (!context.window.DSKY_RELAY_VISUAL) fail('diagnostic API not exported');
if (context.window.DSKY_RELAY_VISUAL.mode !== 'individual-contact-coupled') {
  fail('wrong visual coupling mode');
}
if (context.window.DSKY_RELAY_VISUAL.finalSettleMs !== 20) {
  fail('20-ms final settle contract lost');
}

// Row 10 is VERB. D-K1 is bit 0 and C-K1 is bit 5. Give them deliberately
// different physical travel times and prove the visible contact matrix changes
// at those two times rather than waiting for the bank's 20-ms final settle.
const command = (10 << 11) | (1 << 5) | 1;
context.decodeChannel10(command);
if (baseCalls.length !== 1 || baseCalls[0] !== command) fail('base channel-010 path not preserved');
if (timers.length !== 2) fail(`expected 2 individual relay timers, got ${timers.length}`);
timers.sort((a,b) => a.ms - b.ms);
if (timers[0].ms !== 5 || timers[1].ms !== 11) {
  fail(`relay profile timing not used: ${timers.map(x=>x.ms).join(',')}`);
}

timers[0].fn();
let last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== ' 1') {
  fail(`first relay did not produce intermediate VERB contact state: ${JSON.stringify(last)}`);
}

timers[1].fn();
last = rendered[rendered.length - 1];
if (!last || last.id !== 'verb' || last.text !== '11') {
  fail(`second relay did not complete VERB contact state: ${JSON.stringify(last)}`);
}

console.log('Relay visual coupling smoke: PASS');
console.log('  individual relay travel times drive intermediate EL contact-matrix states; base 20-ms hardware path retained');
