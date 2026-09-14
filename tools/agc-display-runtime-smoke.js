#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'agc-display-runtime.js'),'utf8');
const shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8');
const api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const pairs=[],regs=[],lamps=new Map(),bodyClasses=new Map();const context={mode:'agc',tickSound:false,popcount11(value){let v=value&0x7ff,n=0;while(v){v&=v-1;n++}return n},playRelayBurst(){throw new Error('audio should not run with tickSound=false')},set2(id,text){pairs.push([id,String(text)])},setReg(id,sign,digits){regs.push([id,String(sign),String(digits)])},setLamp(name,on){lamps.set(name,!!on)},clearLamps(){lamps.clear()},document:{body:{classList:{toggle(name,on){bodyClasses.set(name,!!on)}}}},JSON,Object,Array,Number,String};
vm.createContext(context);new vm.Script(source,{filename:'agc-display-runtime.js'}).runInContext(context);
vm.runInContext('onAgcChannel(0o10,(10<<11)|(3<<5)|25);',context);let state=JSON.parse(vm.runInContext('JSON.stringify({display:agcDisplay,relayWords:agcRelayWords})',context));assert(state.display.verb.join('')==='12','VERB decode changed');assert(state.relayWords['10']===(((3<<5)|25)&0o3777),'relay row 10 backing word not retained');vm.runInContext('onAgcChannel(0o11,0o00006);',context);assert(lamps.get('comp')===true&&lamps.get('uplink')===true,'channel 011 mapping changed');vm.runInContext('onAgcChannel(0o163,0o00770);',context);for(const name of ['temp','keyrel','oprerr','restart','stby'])assert(lamps.get(name)===true,`${name} mapping changed`);const snap=vm.runInContext('snapshotUiState()',context);vm.runInContext('resetAgcFace();',context);context.__snap=snap;vm.runInContext('applySnapshotUi(__snap);',context);state=JSON.parse(vm.runInContext('JSON.stringify({display:agcDisplay,ch11:agcCh11,ch13:agcCh13,ch163:agcCh163})',context));assert(state.display.verb.join('')==='12'&&state.ch11===0o6&&state.ch163===0o770,'UI snapshot restore changed');vm.runInContext('renderAgcSnapshot();',context);
for(const required of ['const agcRelayWords={};','const agcDisplay={','function decodeChannel10(value)','function decodeChannel11(value)','function decodeChannel163(value)','function snapshotUiState()','function applySnapshotUi(ui)'])assert(source.includes(required),`AGC display runtime missing ${required}`);
for(const forbidden of ['new AgcCore(','SNAPSHOT_KEY','localStorage','function saveAgcState(','async function enterAgc('])assert(!source.includes(forbidden),`AGC display runtime crossed authority boundary: ${forbidden}`);
for(const forbidden of ['const agcDisplay={','const agcRelayWords={};','function decodeChannel10(value)','function snapshotUiState()'])assert(!shell.includes(forbidden)&&!api.includes(forbidden),`non-display runtime regained AGC display ownership: ${forbidden}`);
console.log('AGC display runtime smoke: PASS');
console.log('  channel decode, backing state, UI snapshot round-trip, and ownership separation verified');
