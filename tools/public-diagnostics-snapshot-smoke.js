#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'app/src/main/assets/agc-api-runtime.js'),'utf8');
const appStatus={
  mode:'agc',mission:'comanche055',
  channels:{ch011:0o00006,ch013:0o00012,ch0163:0o00120},
  display:{prog:['0','0'],verb:['0','6'],noun:['6','5'],r1:{digits:['0','0','0','0','1'],plus:true,minus:false}}
};
const latches={1:0o1675,2:0o3675,12:0o0650};
const hardware={snapshot:()=>({latches,activeDrive:0})};
const lampElements=[
  {dataset:{lamp:'comp'},classList:{contains:name=>name==='on'}},
  {dataset:{lamp:'oprerr'},classList:{contains:()=>false}}
];
const document={
  querySelectorAll:selector=>selector==='[data-lamp]'?lampElements:[],
  body:{classList:{contains:name=>name==='vn-flash-off'}}
};
const lifecycle={status:()=>appStatus,enterAgc(){},enterClock(){},setAppVisible(){}};
const shell={initialize(){},clockTimeLabel:()=>'',store:{},accurateTime(){},accurateDate(){},updateNtpStatus(){}};
const window={
  AGCDSKY_APP_STATE:{selectedMission:'comanche055',ntpStatus:{}},
  AGCDSKY_CORE_SESSION:{core:null},
  AGCDSKY_SHELL:shell,
  AGCDSKY_RENDERER:{},
  AGCDSKY_ENVIRONMENT:{},
  AGCDSKY_AUDIO:{},
  AGCDSKY_CLOCK:{},
  AGCDSKY_DISPLAY:{onChannel(){}},
  AGCDSKY_SNAPSHOT:{},
  AGCDSKY_LIFECYCLE:lifecycle
};
vm.runInNewContext(source,{window,document,console},{filename:'agc-api-runtime.js'});
const api=window.AGCDSKY;
window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_HARDWARE',hardware,'snapshot smoke');

assert.deepStrictEqual(JSON.parse(JSON.stringify(api.snapshotRelays())),latches,
  'snapshotRelays must expose copied physical latch values');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.snapshotChannels())),{
  sourceMode:'agc',ch011:6,ch013:10,ch0163:80
},'snapshotChannels must include raw channel words and their source mode');
const dsky=api.snapshotDsky();
assert.deepStrictEqual(JSON.parse(JSON.stringify(dsky)),{
  mode:'agc',mission:'comanche055',relays:latches,
  channels:{ch011:6,ch013:10,ch0163:80},
  display:appStatus.display,lamps:{comp:true,oprerr:false},vnBlanked:true,elOff:false
},'snapshotDsky must join copied channel, relay, rendered model, and lamp state');

const relays=api.snapshotRelays(),channels=api.snapshotChannels(),combined=api.snapshotDsky();
relays[1]=0;channels.ch011=0;combined.relays[2]=0;combined.display.r1.digits[4]='9';combined.lamps.comp=false;
assert.deepStrictEqual(latches,{1:0o1675,2:0o3675,12:0o0650},'relay snapshot mutation leaked into hardware state');
assert.deepStrictEqual(appStatus.channels,{ch011:6,ch013:10,ch0163:80},'channel snapshot mutation leaked into lifecycle state');
assert.strictEqual(appStatus.display.r1.digits[4],'1','combined snapshot mutation leaked into display state');
assert.strictEqual(lampElements[0].classList.contains('on'),true,'combined snapshot mutation altered rendered lamp state');
assert.notStrictEqual(api.snapshotDsky(),combined,'combined snapshot returned a retained mutable object');

console.log('public diagnostic snapshot smoke: PASS');
console.log('  relay, raw-channel, combined-render, and lamp snapshots are detached from production state');
