#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const source = fs.readFileSync(path.join(ASSETS, 'agc-display-runtime.js'), 'utf8');
const app = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }

const pairs = [];
const regs = [];
const lamps = new Map();
const bodyClasses = new Map();
const context = {
  mode:'agc', tickSound:false,
  popcount11(value){ let v=value&0x7ff,n=0; while(v){v&=v-1;n++;} return n; },
  playRelayBurst(){ throw new Error('audio should not run with tickSound=false'); },
  set2(id,text){ pairs.push([id,String(text)]); },
  setReg(id,sign,digits){ regs.push([id,String(sign),String(digits)]); },
  setLamp(name,on){ lamps.set(name,!!on); },
  clearLamps(){ lamps.clear(); },
  document:{body:{classList:{toggle(name,on){bodyClasses.set(name,!!on);}}}},
  JSON,Object,Array,Number,String
};
vm.createContext(context);
new vm.Script(source,{filename:'agc-display-runtime.js'}).runInContext(context);

// Relay row 10: VERB pair. Codes 03 and 031 decimal represent 1 and 2.
vm.runInContext('onAgcChannel(0o10, (10<<11) | (3<<5) | 25);', context);
let state = JSON.parse(vm.runInContext('JSON.stringify({display:agcDisplay,relayWords:agcRelayWords})', context));
assert(state.display.verb.join('') === '12', `VERB decode changed: ${state.display.verb.join('')}`);
assert(state.relayWords['10'] === (((3<<5)|25)&0o3777), 'relay row 10 backing word not retained');
assert(pairs.some(([id,text]) => id==='verb' && text==='12'), 'VERB decode did not render through set2');

vm.runInContext('onAgcChannel(0o11, 0o00006);', context);
assert(lamps.get('comp') === true, 'COMP ACTY no longer follows channel 011 bit 2');
assert(lamps.get('uplink') === true, 'UPLINK ACTY no longer follows channel 011 bit 3');

vm.runInContext('onAgcChannel(0o163, 0o00770);', context);
for (const name of ['temp','keyrel','oprerr','restart','stby']) assert(lamps.get(name) === true, `${name} channel-163 mapping changed`);
assert(bodyClasses.get('vn-flash-off') === true, 'V/N flash channel-163 mapping changed');

const snap = vm.runInContext('snapshotUiState()', context);
vm.runInContext('resetAgcFace();', context);
assert(JSON.parse(vm.runInContext('JSON.stringify(agcDisplay.verb)', context)).join('') === '  ', 'resetAgcFace did not clear display');
context.__snap = snap;
vm.runInContext('applySnapshotUi(__snap);', context);
state = JSON.parse(vm.runInContext('JSON.stringify({display:agcDisplay,ch11:agcCh11,ch13:agcCh13,ch163:agcCh163})', context));
assert(state.display.verb.join('') === '12', 'UI snapshot restore lost VERB state');
assert(state.ch11 === 0o00006 && state.ch163 === 0o00770, 'UI snapshot restore lost channel backing state');
vm.runInContext('renderAgcSnapshot();', context);
assert(pairs.some(([id,text]) => id==='verb' && text==='12'), 'restored snapshot did not render');

for (const required of [
  'const agcRelayWords={};','const agcDisplay={','function decodeChannel10(value)',
  'function decodeChannel11(value)','function decodeChannel163(value)',
  'function snapshotUiState()','function applySnapshotUi(ui)'
]) assert(source.includes(required), `AGC display runtime missing ${required}`);
for (const forbidden of ['new AgcCore(','SNAPSHOT_KEY','localStorage','function saveAgcState(','async function enterAgc('])
  assert(!source.includes(forbidden), `AGC display runtime crossed into loader/persistence authority: ${forbidden}`);
for (const forbidden of ['const agcDisplay={','const agcRelayWords={};','function decodeChannel10(value)','function snapshotUiState()'])
  assert(!app.includes(forbidden), `app.js regained AGC display state ownership: ${forbidden}`);

console.log('AGC display runtime smoke: PASS');
console.log('  channel 010/011/0163 decode, shared backing state, UI snapshot round-trip, and ownership separation verified');
