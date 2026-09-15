'use strict';

// Synthetic PHONE CLOCK relay/display runtime. Core consumers use the explicit
// clock service; classic bindings remain as compatibility for later fidelity
// layers that still inspect synthetic relay state directly.
const clockState=window.AGCDSKY_APP_STATE;
const clockShell=window.AGCDSKY_SHELL;
const clockRenderer=window.AGCDSKY_RENDERER;
const clockAudio=window.AGCDSKY_AUDIO;
if(!clockState)throw new Error('Shared application state unavailable');
if(!clockShell)throw new Error('Application shell service unavailable');
if(!clockRenderer)throw new Error('DSKY renderer service unavailable');
if(!clockAudio)throw new Error('Relay audio service unavailable');
const CLOCK_RELAY_MS=120,CLOCK_SETTLE_MS=20,V35_ROW_MS=40,V35_TEST_MS=5000;
let clockDigits={r1:['0','0','0','0','0'],r2:['0','0','0','0','0'],r3:['0','0','0','0','0']},
    clockRelayWords={},relayQueue=[],relayBusy=false;
let lampTestActive=false,lampTestTimer=0,lampTestSoundTimers=[];

const DIGIT_RELAY={' ':0,'0':21,'1':3,'2':25,'3':27,'4':15,'5':30,'6':28,'7':19,'8':29,'9':31};
const CLOCK_GROUPS=[
  {relay:8,cells:[['r1',0]],singleRight:true},
  {relay:7,cells:[['r1',1],['r1',2]],b:1},{relay:6,cells:[['r1',3],['r1',4]],b:0},
  {relay:5,cells:[['r2',0],['r2',1]],b:1},{relay:4,cells:[['r2',2],['r2',3]],b:0},
  {relay:3,cells:[['r2',4],['r3',0]],b:0},
  {relay:2,cells:[['r3',1],['r3',2]],b:1},{relay:1,cells:[['r3',3],['r3',4]],b:0}
];
function pad(n,len){return String(n).padStart(len,'0').slice(-len)}
function desiredClockDigits(){const d=clockShell.accurateDate();return {r1:pad(d.getHours(),5).split(''),r2:pad(d.getMinutes(),5).split(''),r3:pad(d.getSeconds(),5).split('')}}
function renderClockReg(name){clockRenderer.setReg(name,'+',clockDigits[name].join(''))}
function clockWord(group,want){
  let c=0,d=0;
  if(group.singleRight)d=DIGIT_RELAY[want[group.cells[0][0]][group.cells[0][1]]]||0;
  else{c=DIGIT_RELAY[want[group.cells[0][0]][group.cells[0][1]]]||0;d=DIGIT_RELAY[want[group.cells[1][0]][group.cells[1][1]]]||0}
  return ((group.b||0)<<10)|(c<<5)|d;
}
function popcount11(v){v&=0x7ff;let n=0;while(v){v&=v-1;n++}return n}
function syncClockFace(){
  const want=desiredClockDigits();
  for(const name of ['r1','r2','r3'])clockDigits[name]=want[name].slice();
  for(const group of CLOCK_GROUPS)clockRelayWords[group.relay]=clockWord(group,want);
  ['r1','r2','r3'].forEach(renderClockReg);
}
function stopClockQueue(){relayQueue=[];relayBusy=false}
function runRelayQueue(){
  const job=relayQueue.shift();
  if(!job){relayBusy=false;return}
  if(clockState.mode!=='clock'){relayBusy=false;relayQueue=[];return}
  const old=clockRelayWords[job.group.relay]??job.newWord,diff=popcount11(old^job.newWord);
  clockRelayWords[job.group.relay]=job.newWord;
  if(clockState.tickSound&&diff)clockAudio.playBurst(diff);
  setTimeout(()=>{
    if(clockState.mode!=='clock')return;
    const touched=new Set();
    for(const [name,i] of job.group.cells){clockDigits[name][i]=job.want[name][i];touched.add(name)}
    touched.forEach(renderClockReg);
  },CLOCK_SETTLE_MS);
  setTimeout(runRelayQueue,CLOCK_RELAY_MS);
}
function tick(){
  if(clockState.mode!=='clock'||lampTestActive||relayBusy)return;
  const want=desiredClockDigits(),jobs=[];
  for(const group of CLOCK_GROUPS){const w=clockWord(group,want);if(clockRelayWords[group.relay]!==w)jobs.push({group,want,newWord:w})}
  if(!jobs.length)return;
  relayQueue=jobs;relayBusy=true;runRelayQueue();
}
function clearLampTestSoundTimers(){for(const id of lampTestSoundTimers)clearTimeout(id);lampTestSoundTimers=[]}
function cancelLampTest(){
  if(lampTestTimer){clearTimeout(lampTestTimer);lampTestTimer=0}
  clearLampTestSoundTimers();lampTestActive=false;
}
function pairLow11(text){
  const value=String(text||'').padEnd(2,' ').slice(0,2);
  return ((DIGIT_RELAY[value[0]]||0)<<5)|(DIGIT_RELAY[value[1]]||0);
}
function v35Low11(relay){
  const eight=DIGIT_RELAY['8'],plus=(relay===7||relay===5||relay===2)?1:0;
  return (plus<<10)|(eight<<5)|eight;
}
function captureClockRelayState(commandVerb=clockState.verb,commandNoun=clockState.noun){
  const out={11:pairLow11('00'),10:pairLow11(commandVerb),9:pairLow11(commandNoun),12:0};
  for(const group of CLOCK_GROUPS)out[group.relay]=(clockRelayWords[group.relay]??0)&0x7ff;
  return out;
}
function v35RelayState(){
  const out={};for(const relay of [11,10,9,8,7,6,5,4,3,2,1])out[relay]=v35Low11(relay);
  out[12]=clockState.selectedMission==='comanche055'?0o650:0o674;return out;
}
function scheduleV35RelaySounds(from,to){
  clearLampTestSoundTimers();
  if(!clockState.tickSound)return;
  clockAudio.ensure();
  [11,10,9,8,7,6,5,4,3,2,1,12].forEach((relay,index)=>{
    const changed=popcount11((from[relay]||0)^(to[relay]||0));
    if(!changed)return;
    const id=setTimeout(()=>{lampTestSoundTimers=lampTestSoundTimers.filter(x=>x!==id);clockAudio.playBurst(changed)},index*V35_ROW_MS);
    lampTestSoundTimers.push(id);
  });
}
function lampTest(){
  cancelLampTest();stopClockQueue();
  const prior=captureClockRelayState(),active=v35RelayState();
  lampTestActive=true;scheduleV35RelaySounds(prior,active);
  document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.add('on'));
  clockRenderer.set2('prog','88');clockRenderer.set2('verb','88');clockRenderer.set2('noun','88');['r1','r2','r3'].forEach(x=>clockRenderer.setReg(x,'+','88888'));
  lampTestTimer=setTimeout(()=>{
    lampTestTimer=0;if(clockState.mode!=='clock'){cancelLampTest();return}
    const want=desiredClockDigits();for(const group of CLOCK_GROUPS)clockRelayWords[group.relay]=clockWord(group,want);
    const restore=captureClockRelayState('16','65');scheduleV35RelaySounds(active,restore);
    lampTestActive=false;clockRenderer.clearLamps();clockRenderer.set2('prog','00');clockState.verb='16';clockState.noun='65';clockShell.show(clockState.verb,clockState.noun);stopClockQueue();syncClockFace();
  },V35_TEST_MS);
}

window.AGCDSKY_CLOCK=Object.freeze({
  tick:(...args)=>tick(...args),
  syncFace:(...args)=>syncClockFace(...args),
  stopQueue:(...args)=>stopClockQueue(...args),
  cancelLampTest:(...args)=>cancelLampTest(...args),
  lampTest:(...args)=>lampTest(...args),
  renderReg:(...args)=>renderClockReg(...args),
  captureRelayState:(...args)=>captureClockRelayState(...args),
  v35RelayState:(...args)=>v35RelayState(...args),
  popcount11:(...args)=>popcount11(...args),
  lampTestActive:()=>lampTestActive
});
