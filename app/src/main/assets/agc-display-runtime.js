'use strict';

// Authoritative AGC DSKY output/display state. This module owns the mutable
// channel/display backing model and UI snapshot serialization exactly once.
// app.js retains core loading and snapshot persistence; later hardware layers
// consume these classic-script globals rather than mirroring state.
const agcRelayWords={};
let agcCh11=0,agcCh13=0,agcCh163=0;
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
function updateAgcCompActy(){setLamp('comp',!!(agcCh11&0o00002))}
function decodeChannel11(value){agcCh11=value;updateAgcCompActy();setLamp('uplink',value&0o00004)}
function decodeChannel13(value){agcCh13=value}
function decodeChannel163(value){
  agcCh163=value;setLamp('temp',value&0o00010);setLamp('keyrel',value&0o00020);document.body.classList.toggle('vn-flash-off',!!(value&0o00040));setLamp('oprerr',value&0o00100);setLamp('restart',value&0o00200);setLamp('stby',value&0o00400);document.body.classList.toggle('el-off',!!(value&0o01000));
}
function onAgcChannel(channel,value){
  if(mode!=='agc'&&mode!=='agc-loading')return;
  if(channel===0o10)decodeChannel10(value);else if(channel===0o11)decodeChannel11(value);else if(channel===0o13)decodeChannel13(value);else if(channel===0o163)decodeChannel163(value);
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
  return {display:JSON.parse(JSON.stringify(agcDisplay)),relayWords:{...agcRelayWords},ch11:agcCh11,ch13:agcCh13,ch163:agcCh163};
}
function applySnapshotUi(ui){
  if(!ui||!ui.display)return;
  for(const k of ['prog','verb','noun'])if(Array.isArray(ui.display[k]))agcDisplay[k]=ui.display[k].slice(0,2);
  for(const k of ['r1','r2','r3'])if(ui.display[k])agcDisplay[k]={digits:(ui.display[k].digits||[]).slice(0,5),plus:!!ui.display[k].plus,minus:!!ui.display[k].minus};
  Object.keys(agcRelayWords).forEach(k=>delete agcRelayWords[k]);Object.assign(agcRelayWords,ui.relayWords||{});
  agcCh11=Number(ui.ch11)||0;agcCh13=Number(ui.ch13)||0;agcCh163=Number(ui.ch163)||0;
}
