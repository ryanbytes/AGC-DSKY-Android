const q=new URLSearchParams(location.search),dream=q.get('dream')==='1';
const $=x=>document.getElementById(x);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},remove(k){try{localStorage.removeItem(k);return true}catch(e){return false}}};
const oldDreamBright=store.get('dreamBright')==='1';
const MISSIONS=Object.freeze({
  comanche055:{label:'COMANCHE055',short:'CM C55',rope:'Comanche055.bin'}
});
let selectedMission='comanche055'; store.set('agcMission','comanche055');
const restoreAgcOnLoad=!dream&&store.get('runMode')!=='clock';
let dreamMode=store.get('dreamMode')||(oldDreamBright?'bright':'dim');
let entryMode='',entry='',verb='16',noun='65',mode='clock',
    dim=store.get('dim')==='1',
    tickSound=store.get('audioTickV4')!=='0',
    displayOnly=dream||store.get('displayOnly')==='1',
    lampTestActive=false,controlsTimer=0,audioCtx=null,tickLevel=1,solarFactor=0;
const CLOCK_RELAY_MS=120,CLOCK_SETTLE_MS=20,RELAY_CLICK_SPREAD_MS=2.5,V35_ROW_MS=40,V35_TEST_MS=5000;
let clockDigits={r1:['0','0','0','0','0'],r2:['0','0','0','0','0'],r3:['0','0','0','0','0']},
    clockRelayWords={},relayQueue=[],relayBusy=false;
const agcRelayWords={};
let agcCh11=0,agcCh13=0,agcCh163=0,agcSuspendedForClock=false;
let agcCore=null,agcLoadedMission='',appVisible=!document.hidden,agcPausedForVisibility=false;
const SNAPSHOT_KEY='agcSnapshotV1',SNAPSHOT_META_KEY='agcSnapshotMetaV1';
let lastSnapshotError='',lastSnapshotAction='none',lastSnapshotVerify=null,autosaveTimer=0,lastAutosaveAt=0;


const SEG={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg'};
const PATH={
  a:'M1.62 1.28 L11.72 1.28 L12.32 1.84 L11.70 2.42 L1.60 2.42 L1.02 1.84 Z',
  g:'M0.88 10.92 L1.50 10.34 L10.90 10.34 L11.52 10.92 L10.88 11.50 L1.48 11.50 Z',
  d:'M-0.02 21.46 L0.60 20.88 L10.00 20.88 L10.62 21.46 L9.98 22.04 L0.58 22.04 Z',
  f:'M1.36 2.84 L2.42 3.36 L1.56 10.10 L0.54 10.68 L0.16 10.12 L1.02 3.40 Z',
  b:'M11.44 2.84 L12.50 3.36 L11.64 10.10 L10.62 10.68 L10.24 10.12 L11.10 3.40 Z',
  e:'M0.26 11.92 L1.32 12.44 L0.46 19.18 L-0.56 19.76 L-0.94 19.20 L-0.08 12.48 Z',
  c:'M10.34 11.92 L11.40 12.44 L10.54 19.18 L9.52 19.76 L9.14 19.20 L10.00 12.48 Z'
};
function pathEl(name,on){return `<path class="el-seg ${on?'on':'off'}" data-seg="${name}" d="${PATH[name]}"/>`}
function glyph(ch,x){const lit=SEG[ch]||'';return `<g class="el-glyph" transform="translate(${x} 0)">${['a','b','c','d','e','f','g'].map(s=>pathEl(s,lit.includes(s))).join('')}</g>`}
function signGlyph(sign){
  const plus=sign==='+',bar=plus||sign==='-';
  return `<g class="el-sign">`+
    `<path class="el-seg ${bar?'on':'off'}" d="M.54 10.92 L1.12 10.34 L5.74 10.34 L6.32 10.92 L5.72 11.50 L1.10 11.50 Z"/>`+
    `<path class="el-seg ${plus?'on':'off'}" d="M3.56 4.26 L4.46 4.72 L3.76 10.06 L2.90 10.56 L2.58 10.10 L3.26 4.76 Z"/>`+
    `<path class="el-seg ${plus?'on':'off'}" d="M2.70 11.88 L3.60 12.34 L2.90 17.70 L2.04 18.20 L1.72 17.74 L2.40 12.38 Z"/>`+
    `</g>`;
}
function renderDigits(el,text){let out='';String(text).split('').forEach((ch,i)=>out+=glyph(ch,i*14));el.innerHTML=out}
function renderReg(el,text){text=String(text);let out=signGlyph(text[0]);text.slice(1).split('').forEach((ch,i)=>out+=glyph(ch,7+i*14));el.innerHTML=out}
function set2(id,text){renderDigits($(id),String(text).padEnd(2,' ').slice(0,2))}
function setReg(id,sign,digits){renderReg($(id),(sign||' ')+String(digits).padEnd(5,' ').slice(0,5))}
function pad(n,len){return String(n).padStart(len,'0').slice(-len)}
function show(v,n){verb=v;noun=n;set2('verb',v.padStart(2,' '));set2('noun',n.padStart(2,' '))}

// Block II uses five latching relays per character; the contact matrix decodes
// the 5-bit relay state into the seven EL strokes.
const DIGIT_RELAY={' ':0,'0':21,'1':3,'2':25,'3':27,'4':15,'5':30,'6':28,'7':19,'8':29,'9':31};
const CLOCK_GROUPS=[
  {relay:8,cells:[['r1',0]],singleRight:true},
  {relay:7,cells:[['r1',1],['r1',2]],b:1},{relay:6,cells:[['r1',3],['r1',4]],b:0},
  {relay:5,cells:[['r2',0],['r2',1]],b:1},{relay:4,cells:[['r2',2],['r2',3]],b:0},
  {relay:3,cells:[['r2',4],['r3',0]],b:0},
  {relay:2,cells:[['r3',1],['r3',2]],b:1},{relay:1,cells:[['r3',3],['r3',4]],b:0}
];
function desiredClockDigits(){const d=new Date();return {r1:pad(d.getHours(),5).split(''),r2:pad(d.getMinutes(),5).split(''),r3:pad(d.getSeconds(),5).split('')}}
function renderClockReg(name){setReg(name,'+',clockDigits[name].join(''))}
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
  if(mode!=='clock'){relayBusy=false;relayQueue=[];return}
  const old=clockRelayWords[job.group.relay]??job.newWord,diff=popcount11(old^job.newWord);
  clockRelayWords[job.group.relay]=job.newWord;
  if(tickSound&&diff)playRelayBurst(diff);
  setTimeout(()=>{
    if(mode!=='clock')return;
    const touched=new Set();
    for(const [name,i] of job.group.cells){clockDigits[name][i]=job.want[name][i];touched.add(name)}
    touched.forEach(renderClockReg);
  },CLOCK_SETTLE_MS);
  setTimeout(runRelayQueue,CLOCK_RELAY_MS);
}
function tick(){
  if(mode!=='clock'||lampTestActive||relayBusy)return;
  const want=desiredClockDigits(),jobs=[];
  for(const group of CLOCK_GROUPS){const w=clockWord(group,want);if(clockRelayWords[group.relay]!==w)jobs.push({group,want,newWord:w})}
  if(!jobs.length)return;
  relayQueue=jobs;relayBusy=true;runRelayQueue();
}
function setLamp(name,on){const x=document.querySelector(`[data-lamp="${name}"]`);if(x)x.classList.toggle('on',!!on)}
function clearLamps(){document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.remove('on'));document.body.classList.remove('vn-flash-off','el-off')}
let lampTestTimer=0,lampTestSoundTimers=[];
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
  // FULLDSP drives both 5-relay character banks even where one bank is not visible.
  return (plus<<10)|(eight<<5)|eight;
}
function captureClockRelayState(commandVerb=verb,commandNoun=noun){
  const out={11:pairLow11('00'),10:pairLow11(commandVerb),9:pairLow11(commandNoun),12:0};
  for(const group of CLOCK_GROUPS)out[group.relay]=(clockRelayWords[group.relay]??0)&0x7ff;
  return out;
}
function v35RelayState(){
  const out={};for(const relay of [11,10,9,8,7,6,5,4,3,2,1])out[relay]=v35Low11(relay);
  out[12]=selectedMission==='comanche055'?0o650:0o674;return out;
}
function scheduleV35RelaySounds(from,to){
  clearLampTestSoundTimers();
  if(!tickSound)return;
  ensureAudio();
  [11,10,9,8,7,6,5,4,3,2,1,12].forEach((relay,index)=>{
    const changed=popcount11((from[relay]||0)^(to[relay]||0));
    if(!changed)return;
    const id=setTimeout(()=>{lampTestSoundTimers=lampTestSoundTimers.filter(x=>x!==id);playRelayBurst(changed)},index*V35_ROW_MS);
    lampTestSoundTimers.push(id);
  });
}
function lampTest(){
  cancelLampTest();stopClockQueue();
  const prior=captureClockRelayState(),active=v35RelayState();
  lampTestActive=true;scheduleV35RelaySounds(prior,active);
  document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.add('on'));
  set2('prog','88');set2('verb','88');set2('noun','88');['r1','r2','r3'].forEach(x=>setReg(x,'+','88888'));
  lampTestTimer=setTimeout(()=>{
    lampTestTimer=0;if(mode!=='clock'){cancelLampTest();return}
    const want=desiredClockDigits();for(const group of CLOCK_GROUPS)clockRelayWords[group.relay]=clockWord(group,want);
    const restore=captureClockRelayState('16','65');scheduleV35RelaySounds(active,restore);
    lampTestActive=false;clearLamps();set2('prog','00');verb='16';noun='65';show(verb,noun);stopClockQueue();syncClockFace();
  },V35_TEST_MS);
}
function executeClock(){if(verb==='35'){$('mode').textContent='V35 · REAL AGC MODE REQUIRED';return}if(verb==='16'&&noun==='65'){mode='clock';$('mode').textContent='PHONE CLOCK · LOCAL WALL TIME';stopClockQueue();syncClockFace();return}$('mode').textContent=`V${verb} N${noun} · PHONE CLOCK INPUT`}

function missionSpec(){return MISSIONS[selectedMission]}
function applyMissionButton(){const b=$('mission');if(b)b.textContent=missionSpec().short}
function rememberRunMode(next){if(!dream)store.set('runMode',next)}
function enterClock(status='PHONE CLOCK · LOCAL WALL TIME',preserveAgc=false){
  cancelLampTest();
  const canResume=preserveAgc&&mode==='agc'&&agcCore&&agcLoadedMission===selectedMission;
  if(agcCore)agcCore.stop();
  if(canResume)saveAgcState('suspend for clock');
  agcSuspendedForClock=!!canResume;
  agcPausedForVisibility=false;mode='clock';rememberRunMode('clock');
  $('agc').textContent='AGC MODE';$('mode').textContent=status;clearLamps();set2('prog','00');verb='16';noun='65';show(verb,noun);stopClockQueue();syncClockFace();
}

const AGC_KEY={
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
};
const RELAY_DIGIT={0:' ',21:'0',3:'1',25:'2',27:'3',15:'4',30:'5',28:'6',19:'7',29:'8',31:'9'};
const agcDisplay={
  prog:[' ',' '],verb:[' ',' '],noun:[' ',' '],
  r1:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false},
  r2:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false},
  r3:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false}
};
function relayDigit(code){return RELAY_DIGIT[code]??' '}
function regSign(reg){return reg.plus?'+':reg.minus?'-':' '}
function renderAgcReg(name){const r=agcDisplay[name];setReg(name,regSign(r),r.digits.join(''))}
function resetAgcFace(){
  agcDisplay.prog.fill(' ');agcDisplay.verb.fill(' ');agcDisplay.noun.fill(' ');
  ['r1','r2','r3'].forEach(name=>{agcDisplay[name].digits.fill(' ');agcDisplay[name].plus=false;agcDisplay[name].minus=false});
  Object.keys(agcRelayWords).forEach(key=>delete agcRelayWords[key]);
  agcCh11=0;agcCh13=0;agcCh163=0;
  set2('prog','  ');set2('verb','  ');set2('noun','  ');['r1','r2','r3'].forEach(renderAgcReg);clearLamps();
}
function decodeChannel10(value){
  const relay=(value>>11)&0o17,b=(value>>10)&1,c=(value>>5)&0o37,d=value&0o37,low11=value&0o3777;
  if(relay>=1&&relay<=12){const prior=agcRelayWords[relay];if(prior!==undefined&&tickSound){const n=popcount11(prior^low11);if(n)playRelayBurst(n)}agcRelayWords[relay]=low11}
  switch(relay){
    case 12:setLamp('vel',value&0o00004);setLamp('noatt',value&0o00010);setLamp('alt',value&0o00020);setLamp('gimbal',value&0o00040);setLamp('tracker',value&0o00200);setLamp('prog',value&0o00400);break;
    case 11:agcDisplay.prog[0]=relayDigit(c);agcDisplay.prog[1]=relayDigit(d);set2('prog',agcDisplay.prog.join(''));break;
    case 10:agcDisplay.verb[0]=relayDigit(c);agcDisplay.verb[1]=relayDigit(d);set2('verb',agcDisplay.verb.join(''));break;
    case 9:agcDisplay.noun[0]=relayDigit(c);agcDisplay.noun[1]=relayDigit(d);set2('noun',agcDisplay.noun.join(''));break;
    case 8:agcDisplay.r1.digits[0]=relayDigit(d);renderAgcReg('r1');break;
    case 7:agcDisplay.r1.plus=!!b;agcDisplay.r1.digits[1]=relayDigit(c);agcDisplay.r1.digits[2]=relayDigit(d);renderAgcReg('r1');break;
    case 6:agcDisplay.r1.minus=!!b;agcDisplay.r1.digits[3]=relayDigit(c);agcDisplay.r1.digits[4]=relayDigit(d);renderAgcReg('r1');break;
    case 5:agcDisplay.r2.plus=!!b;agcDisplay.r2.digits[0]=relayDigit(c);agcDisplay.r2.digits[1]=relayDigit(d);renderAgcReg('r2');break;
    case 4:agcDisplay.r2.minus=!!b;agcDisplay.r2.digits[2]=relayDigit(c);agcDisplay.r2.digits[3]=relayDigit(d);renderAgcReg('r2');break;
    case 3:agcDisplay.r2.digits[4]=relayDigit(c);agcDisplay.r3.digits[0]=relayDigit(d);renderAgcReg('r2');renderAgcReg('r3');break;
    case 2:agcDisplay.r3.plus=!!b;agcDisplay.r3.digits[1]=relayDigit(c);agcDisplay.r3.digits[2]=relayDigit(d);renderAgcReg('r3');break;
    case 1:agcDisplay.r3.minus=!!b;agcDisplay.r3.digits[3]=relayDigit(c);agcDisplay.r3.digits[4]=relayDigit(d);renderAgcReg('r3');break;
  }
}
function updateAgcCompActy(){
  // Block II DSKY COMP ACTY is controlled by output channel 011 bit 2.
  // Comanche 055 V35 intentionally does not hold COMP ACTY on.
  setLamp('comp',!!(agcCh11&0o00002));
}
function decodeChannel11(value){agcCh11=value;updateAgcCompActy();setLamp('uplink',value&0o00004)}
function decodeChannel13(value){
  // Channel 013 bit 10 is ALTEST.  On real Block II hardware it exercises
  // the non-programmable alarm paths (notably RESTART and STBY).  yaAGC's
  // hardware model exposes their resulting physical DSKY states on channel
  // 0163, so no visual lamp state is synthesized here.
  agcCh13=value;
}
function decodeChannel163(value){
  agcCh163=value;setLamp('temp',value&0o00010);setLamp('keyrel',value&0o00020);document.body.classList.toggle('vn-flash-off',!!(value&0o00040));setLamp('oprerr',value&0o00100);setLamp('restart',value&0o00200);setLamp('stby',value&0o00400);document.body.classList.toggle('el-off',!!(value&0o01000));
}
function onAgcChannel(channel,value){
  if(mode!=='agc'&&mode!=='agc-loading')return;
  if(channel===0o10)decodeChannel10(value);else if(channel===0o11)decodeChannel11(value);else if(channel===0o13)decodeChannel13(value);else if(channel===0o163)decodeChannel163(value);
}
function agcFailure(error){
  agcSuspendedForClock=false;console.error('AGC core stopped',error);enterClock('AGC ERROR · PHONE CLOCK',false);
}
function renderAgcSnapshot(){
  clearLamps();
  set2('prog',agcDisplay.prog.join(''));set2('verb',agcDisplay.verb.join(''));set2('noun',agcDisplay.noun.join(''));
  ['r1','r2','r3'].forEach(renderAgcReg);
  const l12=agcRelayWords[12]||0;
  setLamp('vel',l12&0o00004);setLamp('noatt',l12&0o00010);setLamp('alt',l12&0o00020);setLamp('gimbal',l12&0o00040);setLamp('tracker',l12&0o00200);setLamp('prog',l12&0o00400);
  updateAgcCompActy();setLamp('uplink',agcCh11&0o00004);decodeChannel163(agcCh163);
}
function snapshotUiState(){
  return {
    display:JSON.parse(JSON.stringify(agcDisplay)),
    relayWords:{...agcRelayWords},ch11:agcCh11,ch13:agcCh13,ch163:agcCh163
  };
}
function applySnapshotUi(ui){
  if(!ui||!ui.display)return;
  for(const k of ['prog','verb','noun'])if(Array.isArray(ui.display[k]))agcDisplay[k]=ui.display[k].slice(0,2);
  for(const k of ['r1','r2','r3'])if(ui.display[k])agcDisplay[k]={digits:(ui.display[k].digits||[]).slice(0,5),plus:!!ui.display[k].plus,minus:!!ui.display[k].minus};
  Object.keys(agcRelayWords).forEach(k=>delete agcRelayWords[k]);Object.assign(agcRelayWords,ui.relayWords||{});
  agcCh11=Number(ui.ch11)||0;agcCh13=Number(ui.ch13)||0;agcCh163=Number(ui.ch163)||0;
}
function savedSnapshotInfo(){
  try{const x=JSON.parse(store.get(SNAPSHOT_META_KEY)||'null');return x&&x.schema===1?x:null}catch(_){return null}
}
function saveAgcState(reason='manual'){
  if(mode!=='agc'){lastSnapshotError='AGC mode required';lastSnapshotAction='save ignored';return false}
  if(!agcCore||agcLoadedMission!==selectedMission||typeof agcCore.exportSnapshot!=='function')return false;
  try{
    const timestamp=Date.now(),payload={schema:1,mission:selectedMission,coreVersion:agcCore.version(),timestamp,reason,ui:snapshotUiState(),core:agcCore.exportSnapshot()};
    if(!store.set(SNAPSHOT_KEY,JSON.stringify(payload)))throw new Error('local storage rejected snapshot');
    store.set(SNAPSHOT_META_KEY,JSON.stringify({schema:1,mission:selectedMission,timestamp,reason,sourceMode:'agc',coreVersion:payload.coreVersion,bytes:payload.core.byteLength,fingerprint:payload.core.fingerprint||null}));
    if(reason.startsWith('autosave:')||reason==='periodic autosave')lastAutosaveAt=timestamp;
    lastSnapshotError='';lastSnapshotAction='saved';return true;
  }catch(error){lastSnapshotError=String(error&&error.message||error);lastSnapshotAction='save failed';console.error('AGC snapshot save',error);return false}
}
function restoreSavedAgcState(){
  if(!agcCore||typeof agcCore.importSnapshot!=='function')return false;
  const raw=store.get(SNAPSHOT_KEY);if(!raw)return false;
  try{
    const payload=JSON.parse(raw);
    if(!payload||payload.schema!==1||payload.mission!==selectedMission)throw new Error('snapshot mission/schema mismatch');
    agcCore.importSnapshot(payload.core);applySnapshotUi(payload.ui);
    lastSnapshotError='';lastSnapshotAction='restored';return true;
  }catch(error){lastSnapshotError=String(error&&error.message||error);lastSnapshotAction='restore failed';store.remove(SNAPSHOT_KEY);store.remove(SNAPSHOT_META_KEY);console.error('AGC snapshot restore',error);return false}
}
function clearSavedAgcState(){store.remove(SNAPSHOT_KEY);store.remove(SNAPSHOT_META_KEY);lastSnapshotError='';lastSnapshotAction='cleared';return true}
function verifySnapshotRoundTrip(){
  if(!agcCore||agcLoadedMission!==selectedMission||typeof agcCore.exportSnapshot!=='function'||typeof agcCore.importSnapshot!=='function')return {ok:false,error:'AGC core not ready'};
  const wasRunning=!!agcCore.running,ui=snapshotUiState();
  try{
    if(wasRunning)agcCore.stop();
    const snap=agcCore.exportSnapshot(),before=snap.fingerprint||agcCore.snapshotFingerprint?.();
    agcCore.importSnapshot(snap);applySnapshotUi(ui);const after=agcCore.snapshotFingerprint?.();
    const ok=!before||before===after;lastSnapshotVerify={ok,before,after,timestamp:Date.now()};
    if(wasRunning&&appVisible)agcCore.start(1);renderAgcSnapshot();
    return {...lastSnapshotVerify};
  }catch(error){
    lastSnapshotVerify={ok:false,error:String(error&&error.message||error),timestamp:Date.now()};
    if(wasRunning&&appVisible&&!agcCore.running)agcCore.start(1);
    return {...lastSnapshotVerify};
  }
}
function scheduleAgcAutosave(reason='activity'){
  if(mode!=='agc'||!agcCore)return;
  clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=0;if(mode==='agc'&&agcCore&&agcCore.running)saveAgcState('autosave: '+reason)},1800);
}
function agcAppStatus(){
  const meta=savedSnapshotInfo();
  return {mode,mission:selectedMission,missionLabel:missionSpec().label,loadedMission:agcLoadedMission,coreLoaded:!!agcCore,
    coreRunning:!!(agcCore&&agcCore.running),coreVersion:agcCore?agcCore.version():'not loaded',appVisible,
    channels:{ch011:agcCh11,ch013:agcCh13,ch0163:agcCh163},display:JSON.parse(JSON.stringify(agcDisplay)),
    snapshot:{saved:!!meta,meta,lastAction:lastSnapshotAction,error:lastSnapshotError,lastVerify:lastSnapshotVerify,currentFingerprint:agcCore&&typeof agcCore.snapshotFingerprint==='function'?agcCore.snapshotFingerprint():null,lastAutosaveAt}};
}
async function enterAgc(){
  if(dream||mode==='agc-loading'||mode==='agc')return;
  cancelLampTest();

  const selected=missionSpec();
  if(agcSuspendedForClock&&agcCore&&agcLoadedMission===selectedMission){
    mode='agc';agcSuspendedForClock=false;rememberRunMode('agc');$('agc').textContent='AGC MODE';$('mode').textContent=`${selected.label} · ${agcCore.version()}`;renderAgcSnapshot();
    if(appVisible){agcCore.start(1);agcPausedForVisibility=false}else{agcPausedForVisibility=true}
    return;
  }

  mode='agc-loading';stopClockQueue();$('agc').textContent='...';$('mode').textContent=`LOADING ${selected.label} · AGC`;resetAgcFace();
  try{
    if(!agcCore||agcLoadedMission!==selectedMission){
      if(agcCore)agcCore.stop();
      agcCore=new AgcCore({onChannelUpdate:onAgcChannel,onError:agcFailure});
      await agcCore.load({wasmUrl:'yaAGC.wasm',ropeUrl:selected.rope});
      agcLoadedMission=selectedMission;
    }else{
      agcCore.reset();agcCore.configureInputMasks();
    }
    const restored=restoreSavedAgcState();
    mode='agc';agcSuspendedForClock=false;rememberRunMode('agc');$('agc').textContent='AGC MODE';$('mode').textContent=`${selected.label} · ${agcCore.version()}${restored?' · STATE RESTORED':''}`;
    if(restored)renderAgcSnapshot();
    if(appVisible){agcCore.start(1);agcPausedForVisibility=false}else{agcPausedForVisibility=true}
  }catch(error){agcFailure(error)}
}
function cycleMission(){
  selectedMission='comanche055'; store.set('agcMission','comanche055'); applyMissionButton();
}
function setAppVisible(visible){
  appVisible=!!visible;
  if(mode!=='agc'||!agcCore)return;
  if(!appVisible){
    if(agcCore.running){agcCore.stop();agcPausedForVisibility=true}
    saveAgcState('app background');
    return;
  }
  if(agcPausedForVisibility){agcPausedForVisibility=false;agcCore.start(1)}
}
function press(k){
  if(mode==='agc'){if(k==='P')return;const code=AGC_KEY[k];if(code!==undefined){agcCore.keyPress(code);scheduleAgcAutosave('DSKY key')}return}
  if(mode!=='clock')return;
  if(k==='V'){if(entryMode==='N'&&entry.length)noun=entry.padStart(2,'0').slice(-2);entryMode='V';entry='';set2('verb','  ');return}
  if(k==='N'){if(entryMode==='V'&&entry.length)verb=entry.padStart(2,'0').slice(-2);entryMode='N';entry='';set2('noun','  ');return}
  if(k==='C'){entry='';if(entryMode==='V')set2('verb','  ');else if(entryMode==='N')set2('noun','  ');return}
  if(k==='R'){cancelLampTest();mode='clock';verb='16';noun='65';set2('prog','00');show(verb,noun);clearLamps();stopClockQueue();syncClockFace();return}
  if(k==='K'){setLamp('keyrel',false);return}
  if(k==='P'){setLamp('prog',!document.querySelector('[data-lamp="prog"]').classList.contains('on'));return}
  if(k==='E'){if(entryMode==='V'&&entry.length)verb=entry.padStart(2,'0').slice(-2);if(entryMode==='N'&&entry.length)noun=entry.padStart(2,'0').slice(-2);entryMode='';entry='';show(verb,noun);executeClock();return}
  if(/^\d$/.test(k)&&entryMode){entry=(entry+k).slice(-2);if(entryMode==='V')set2('verb',entry.padEnd(2,' '));else set2('noun',entry.padEnd(2,' '))}
}

// Solar brightness is computed locally from the saved latitude/longitude.
// Sunrise/sunset use the standard -0.833 degree solar altitude and a smooth
// one-hour gradual transition centered on each event.
const DAY_MS=86400000,J1970=2440588,J2000=2451545,J0=.0009,RAD=Math.PI/180,SOLAR_FADE_HALF_MS=30*60*1000;
function toJulian(date){return date.valueOf()/DAY_MS-.5+J1970}
function fromJulian(j){return new Date((j+.5-J1970)*DAY_MS)}
function toDays(date){return toJulian(date)-J2000}
function solarMeanAnomaly(d){return RAD*(357.5291+.98560028*d)}
function eclipticLongitude(M){const C=RAD*(1.9148*Math.sin(M)+.02*Math.sin(2*M)+.0003*Math.sin(3*M)),P=RAD*102.9372;return M+C+P+Math.PI}
function declination(l){const e=RAD*23.4397;return Math.asin(Math.sin(e)*Math.sin(l))}
function julianCycle(d,lw){return Math.round(d-J0-lw/(2*Math.PI))}
function approxTransit(Ht,lw,n){return J0+(Ht+lw)/(2*Math.PI)+n}
function solarTransitJ(ds,M,L){return J2000+ds+.0053*Math.sin(M)-.0069*Math.sin(2*L)}
function hourAngle(h,phi,d){const x=(Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d));if(x<-1||x>1)return null;return Math.acos(x)}
function solarTimes(date,lat,lng){
  const lw=RAD*-lng,phi=RAD*lat,d=toDays(date),n=julianCycle(d,lw),ds=approxTransit(0,lw,n),M=solarMeanAnomaly(ds),L=eclipticLongitude(M),dec=declination(L),Jnoon=solarTransitJ(ds,M,L),w=hourAngle(RAD*-.833,phi,dec);
  if(w===null)return null;
  const a=approxTransit(w,lw,n),Jset=solarTransitJ(a,M,L),Jrise=Jnoon-(Jset-Jnoon);
  return {sunrise:fromJulian(Jrise),sunset:fromJulian(Jset)};
}
function smoothstep(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
function currentSolarFactor(){
  const lat=parseFloat(store.get('solarLat')),lon=parseFloat(store.get('solarLon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return 0;
  const now=new Date(),times=solarTimes(now,lat,lon);
  if(!times)return 0;
  const half=SOLAR_FADE_HALF_MS,t=now.getTime(),rise=times.sunrise.getTime(),set=times.sunset.getTime();
  if(t<rise-half||t>set+half)return 0;
  if(t<=rise+half)return smoothstep(rise-half,rise+half,t);
  if(t<set-half)return 1;
  return 1-smoothstep(set-half,set+half,t);
}
function requestSolarLocation(){
  if(!navigator.geolocation){$('mode').textContent='SOLAR LOCATION UNAVAILABLE';dreamMode='dim';applyDreamMode();return}
  $('mode').textContent='REQUESTING LOCAL SOLAR POSITION';
  navigator.geolocation.getCurrentPosition(p=>{
    store.set('solarLat',String(p.coords.latitude));store.set('solarLon',String(p.coords.longitude));
    dreamMode='solar';applyDreamMode();$('mode').textContent='SUN AUTO · 60 MIN SUNRISE/SUNSET FADE';
  },()=>{
    dreamMode='dim';applyDreamMode();$('mode').textContent='SOLAR NEEDS LOCATION PERMISSION';
  },{enableHighAccuracy:false,maximumAge:2592000000,timeout:12000});
}
function applyDim(){
  if(!dream){document.body.classList.toggle('dim',dim);$('dsky').style.filter='';store.set('dim',dim?'1':'0')}
}
function setDreamWindowBrightness(v){try{if(window.DreamBridge&&DreamBridge.setBrightness)DreamBridge.setBrightness(v)}catch(e){}}
function updateDreamEnvironment(){
  if(!dream){tickLevel=1;return}
  if(dreamMode==='bright')solarFactor=1;
  else if(dreamMode==='solar')solarFactor=currentSolarFactor();
  else solarFactor=0;
  const visual=.20+.80*solarFactor,sat=.62+.38*solarFactor;
  $('dsky').style.filter=`brightness(${visual.toFixed(3)}) saturate(${sat.toFixed(3)})`;
  tickLevel=.08+.92*solarFactor;
  setDreamWindowBrightness(.05+.80*solarFactor);
}
function applyDreamMode(){
  store.set('dreamMode',dreamMode);store.set('dreamBright',dreamMode==='bright'?'1':'0');
  const b=$('dreambright');if(b)b.textContent=dreamMode==='solar'?'DREAM BRIGHTNESS AUTO':'DREAM BRIGHTNESS '+dreamMode.toUpperCase();
  if(dream)updateDreamEnvironment();
}
function cycleDreamMode(){
  if(dreamMode==='dim'){dreamMode='bright';applyDreamMode()}
  else if(dreamMode==='bright'){
    const have=Number.isFinite(parseFloat(store.get('solarLat')))&&Number.isFinite(parseFloat(store.get('solarLon')));
    if(have){dreamMode='solar';applyDreamMode();$('mode').textContent='SUN AUTO · 60 MIN SUNRISE/SUNSET FADE'}else requestSolarLocation();
  }else{dreamMode='dim';applyDreamMode()}
}
function applyDisplayOnly(){document.body.classList.toggle('display-only',displayOnly);if(!dream)store.set('displayOnly',displayOnly?'1':'0');const b=$('display');if(b)b.textContent=displayOnly?'EXIT FULL DSKY DISPLAY':'FULL DSKY DISPLAY'}
function ensureAudio(){if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;audioCtx=new AC()}if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});return audioCtx}
function emitTick(ctx,when=ctx.currentTime){
  const sr=ctx.sampleRate,n=Math.max(1,Math.floor(sr*.0065)),buf=ctx.createBuffer(1,n,sr),data=buf.getChannelData(0);
  for(let i=0;i<n;i++){
    const tm=i/sr;
    let env=Math.exp(-tm/.00075);
    if(tm>=.00155)env+=.30*Math.exp(-(tm-.00155)/.00048);
    if(tm>=.00305)env+=.13*Math.exp(-(tm-.00305)/.00038);
    data[i]=(Math.random()*2-1)*env;
  }
  const src=ctx.createBufferSource(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter(),snap=ctx.createGain();src.buffer=buf;
  high.type='highpass';high.frequency.setValueAtTime(760,when);high.Q.setValueAtTime(.65,when);
  low.type='lowpass';low.frequency.setValueAtTime(5600,when);low.Q.setValueAtTime(.55,when);
  snap.gain.setValueAtTime(.52*tickLevel,when);snap.gain.exponentialRampToValueAtTime(.0001,when+.0075);
  src.connect(high);high.connect(low);low.connect(snap);snap.connect(ctx.destination);src.start(when);
  const osc=ctx.createOscillator(),body=ctx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(610,when);osc.frequency.exponentialRampToValueAtTime(270,when+.007);body.gain.setValueAtTime(.045*tickLevel,when);body.gain.exponentialRampToValueAtTime(.0001,when+.010);osc.connect(body);body.connect(ctx.destination);osc.start(when);osc.stop(when+.011);
}
function playRelayBurst(count){const ctx=ensureAudio();if(!ctx||count<1)return;const go=()=>{const base=ctx.currentTime+.002;for(let i=0;i<count;i++)emitTick(ctx,base+i*1.7/1000)};if(ctx.state==='running')go();else ctx.resume().then(go).catch(()=>{})}
function applyTickSound(){store.set('audioTickV4',tickSound?'1':'0');const b=$('sound');if(b)b.textContent=tickSound?'RELAY CLICKS ON':'RELAY CLICKS OFF'}
function showControls(){if(dream||displayOnly)return;document.body.classList.add('controls-visible');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>document.body.classList.remove('controls-visible'),5500)}
let holdTimer=0;
document.addEventListener('pointerdown',e=>{
  if(dream)return;
  if(displayOnly){holdTimer=setTimeout(()=>{displayOnly=false;applyDisplayOnly();showControls()},1800);return}
  if(e.target.closest('[data-key],.app-controls'))return;
  holdTimer=setTimeout(showControls,620);
},{passive:true});
document.addEventListener('pointerup',()=>clearTimeout(holdTimer),{passive:true});
document.addEventListener('pointercancel',()=>clearTimeout(holdTimer),{passive:true});
document.addEventListener('visibilitychange',()=>setAppVisible(!document.hidden));
addEventListener('pagehide',()=>{if(mode==='agc'&&agcCore){agcCore.stop();saveAgcState('page hide')}});
document.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('pressed');press(b.dataset.key);setTimeout(()=>b.classList.remove('pressed'),90)}));
$('dim').addEventListener('click',()=>{dim=!dim;applyDim();showControls()});
$('dreambright').addEventListener('click',()=>{cycleDreamMode();showControls()});
$('sound').addEventListener('click',()=>{ensureAudio();tickSound=!tickSound;applyTickSound();if(tickSound)playRelayBurst(1);showControls()});
$('display').addEventListener('click',()=>{displayOnly=true;applyDisplayOnly()});
$('agc').addEventListener('click',()=>{enterAgc();showControls()});
$('clock').addEventListener('click',()=>{enterClock('PHONE CLOCK · LOCAL WALL TIME',true);showControls()});
document.addEventListener('pointerdown',()=>{if(tickSound)ensureAudio()},{passive:true});
window.AGCDSKY={agcChannel:onAgcChannel,getCore:()=>agcCore,setAppVisible,getMission:()=>selectedMission,enterClock:()=>enterClock('PHONE CLOCK · LOCAL WALL TIME',true),enterAgc,appStatus:agcAppStatus,saveAgcState,clearSavedAgcState,savedSnapshotInfo,verifySnapshotRoundTrip,scheduleAgcAutosave};
document.body.classList.toggle('dream',dream);
if(!dream&&!displayOnly&&store.get('hinted')!=='1'){document.body.classList.add('first-run');setTimeout(()=>{document.body.classList.remove('first-run');store.set('hinted','1')},3200)}
applyDim();applyDreamMode();applyDisplayOnly();applyTickSound();applyMissionButton();clearLamps();set2('prog','00');show(verb,noun);syncClockFace();setInterval(tick,20);setInterval(()=>{if(mode==='agc'&&agcCore&&agcCore.running&&appVisible&&Date.now()-lastAutosaveAt>15000)saveAgcState('periodic autosave')},5000);
if(!dream&&!restoreAgcOnLoad)rememberRunMode('clock');
if(restoreAgcOnLoad)setTimeout(()=>enterAgc(),0);
if(dream){
  updateDreamEnvironment();setInterval(updateDreamEnvironment,15000);
  const pos=[[0,0],[3,-2],[-3,2],[2,3],[-2,-3],[1,-1]],dsky=$('dsky');let i=0;
  setInterval(()=>{const p=pos[i++%pos.length];dsky.style.setProperty('--drift-x',p[0]+'px');dsky.style.setProperty('--drift-y',p[1]+'px')},60000);
}
