#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'phone-clock-runtime.js'),'utf8');
const shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8');
const api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const rendered=[],lamps=new Map(),timers=[];const context={mode:'clock',tickSound:false,selectedMission:'comanche055',verb:'16',noun:'65',accurateDate:()=>new Date('2026-09-14T13:07:05Z'),setReg:(id,sign,digits)=>rendered.push(['reg',id,sign,digits]),set2:(id,text)=>rendered.push(['two',id,text]),setLamp:(name,on)=>lamps.set(name,!!on),clearLamps:()=>lamps.clear(),show:(verb,noun)=>rendered.push(['show',verb,noun]),ensureAudio:()=>null,playRelayBurst:()=>{},document:{querySelectorAll:s=>s==='[data-lamp]'?[{classList:{add(){}}}]:[]},setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(){},String,Number,Date,Math,Set,Object};
vm.createContext(context);new vm.Script(source,{filename:'phone-clock-runtime.js'}).runInContext(context);
vm.runInContext('syncClockFace();',context);const snapshot=JSON.parse(vm.runInContext('JSON.stringify({clockDigits,clockRelayWords})',context));
assert(snapshot.clockDigits.r1.join('')==='00013','hour clock digits changed');assert(snapshot.clockDigits.r2.join('')==='00007','minute clock digits changed');assert(snapshot.clockDigits.r3.join('')==='00005','second clock digits changed');assert(Object.keys(snapshot.clockRelayWords).length===8,'clock relay rows were not fully initialized');assert(rendered.filter(row=>row[0]==='reg').length===3,'clock sync did not render all three registers');assert(vm.runInContext("DIGIT_RELAY['8']",context)===0o35,'digit 8 relay code changed from 035');assert(vm.runInContext('v35RelayState()[12]',context)===0o650,'Comanche V35 relay 12 changed from 0650');vm.runInContext('lampTest();',context);assert(rendered.some(row=>row[0]==='two'&&row[1]==='prog'&&row[2]==='88'),'clock lamp test did not drive PROG 88');assert(timers.some(timer=>timer.ms===5000),'clock lamp test no longer holds for five seconds');
for(const token of ['const DIGIT_RELAY=','const CLOCK_GROUPS=[','function syncClockFace()','function stopClockQueue()','function tick()','function lampTest()']){assert(source.includes(token),`clock runtime missing ${token}`);assert(!shell.includes(token)&&!api.includes(token),`non-clock runtime regained phone-clock ownership: ${token}`)}
for(const forbidden of ['agcDisplay=','function decodeChannel10(','function saveAgcState(','new AgcCore('])assert(!source.includes(forbidden),`phone-clock runtime crossed into AGC authority: ${forbidden}`);
console.log('phone clock runtime smoke: PASS');
console.log('  clock digits, relay rows, V35 presentation, queue boundary, and ownership separation verified');
