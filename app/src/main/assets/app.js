const q=new URLSearchParams(location.search),dream=q.get('dream')==='1';
const $=x=>document.getElementById(x);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
let entryMode='',entry='',verb='16',noun='65',mode='clock',dim=dream||store.get('dim')==='1',tickSound=store.get('audioTickV2')!=='0',lampTestActive=false,controlsTimer=0,lastTickSecond=-1,audioCtx=null;
let agcCore=null,agcLoaded=false;

// Apollo DSKY EL numerals are seven-segment, but the glass geometry is not a
// generic LED font. Keep the original 14x24 character envelope while using
// slimmer, more rectilinear EL elements with restrained chamfers and only a
// slight lean in the vertical segments.
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
function glyph(ch,x){
  const lit=SEG[ch]||'';
  return `<g class="el-glyph" transform="translate(${x} 0)">${['a','b','c','d','e','f','g'].map(s=>pathEl(s,lit.includes(s))).join('')}</g>`;
}
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
function tick(){if(mode!=='clock')return;const d=new Date(),h=d.getHours(),m=d.getMinutes(),s=d.getSeconds(),cs=Math.floor(d.getMilliseconds()/10);setReg('r1','+',pad(h,5));setReg('r2','+',pad(m,5));setReg('r3','+',pad(s*100+cs,5));const secKey=Math.floor(d.getTime()/1000);if(secKey!==lastTickSecond){lastTickSecond=secKey;if(tickSound)playTick()}}
function setLamp(name,on){const x=document.querySelector(`[data-lamp="${name}"]`);if(x)x.classList.toggle('on',!!on)}
function clearLamps(){document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.remove('on'));document.body.classList.remove('vn-flash-off','el-off')}
function lampTest(){
  lampTestActive=true;document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.add('on'));set2('prog','88');set2('verb','88');set2('noun','88');['r1','r2','r3'].forEach(x=>setReg(x,'+','88888'));
  setTimeout(()=>{lampTestActive=false;if(mode!=='clock')return;clearLamps();set2('prog','00');show(verb,noun);tick()},1800)
}
function executeClock(){if(verb==='35'){lampTest();return}if(verb==='16'&&noun==='65'){mode='clock';$('mode').textContent='V16 N65 · PHONE CLOCK';tick();return}$('mode').textContent=`V${verb} N${noun} · DSKY INPUT`}

// Authentic Block II keyboard codes from Pinball. PRO/Proceed is not a normal
// key code; it is a separate discrete on input channel 032 and is handled by
// AgcCore.proceedPulse().
const AGC_KEY={
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
};

// Block II display relay codes used on output channel 010.
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
  set2('prog','  ');set2('verb','  ');set2('noun','  ');['r1','r2','r3'].forEach(renderAgcReg);clearLamps()
}
function decodeChannel10(value){
  const relay=(value>>11)&0o17,b=(value>>10)&1,c=(value>>5)&0o37,d=value&0o37;
  switch(relay){
    case 12:
      setLamp('vel',value&0o00004);setLamp('noatt',value&0o00010);setLamp('alt',value&0o00020);setLamp('gimbal',value&0o00040);setLamp('tracker',value&0o00200);setLamp('prog',value&0o00400);break;
    case 11: agcDisplay.prog[0]=relayDigit(c);agcDisplay.prog[1]=relayDigit(d);set2('prog',agcDisplay.prog.join(''));break;
    case 10: agcDisplay.verb[0]=relayDigit(c);agcDisplay.verb[1]=relayDigit(d);set2('verb',agcDisplay.verb.join(''));break;
    case 9: agcDisplay.noun[0]=relayDigit(c);agcDisplay.noun[1]=relayDigit(d);set2('noun',agcDisplay.noun.join(''));break;
    case 8: agcDisplay.r1.digits[0]=relayDigit(d);renderAgcReg('r1');break;
    case 7: agcDisplay.r1.plus=!!b;agcDisplay.r1.digits[1]=relayDigit(c);agcDisplay.r1.digits[2]=relayDigit(d);renderAgcReg('r1');break;
    case 6: agcDisplay.r1.minus=!!b;agcDisplay.r1.digits[3]=relayDigit(c);agcDisplay.r1.digits[4]=relayDigit(d);renderAgcReg('r1');break;
    case 5: agcDisplay.r2.plus=!!b;agcDisplay.r2.digits[0]=relayDigit(c);agcDisplay.r2.digits[1]=relayDigit(d);renderAgcReg('r2');break;
    case 4: agcDisplay.r2.minus=!!b;agcDisplay.r2.digits[2]=relayDigit(c);agcDisplay.r2.digits[3]=relayDigit(d);renderAgcReg('r2');break;
    case 3: agcDisplay.r2.digits[4]=relayDigit(c);agcDisplay.r3.digits[0]=relayDigit(d);renderAgcReg('r2');renderAgcReg('r3');break;
    case 2: agcDisplay.r3.plus=!!b;agcDisplay.r3.digits[1]=relayDigit(c);agcDisplay.r3.digits[2]=relayDigit(d);renderAgcReg('r3');break;
    case 1: agcDisplay.r3.minus=!!b;agcDisplay.r3.digits[3]=relayDigit(c);agcDisplay.r3.digits[4]=relayDigit(d);renderAgcReg('r3');break;
  }
}
function decodeChannel11(value){
  // Block II output channel 011: bit 2 = COMP ACTY, bit 3 = UPLINK ACTY.
  setLamp('comp',value&0o00002);setLamp('uplink',value&0o00004)
}
function decodeChannel163(value){
  // yaAGC's fictitious channel 0163 supplies the external square-wave-modulated
  // DSKY states used by the real hardware for blinking/caution indications.
  setLamp('temp',value&0o00010);setLamp('keyrel',value&0o00020);document.body.classList.toggle('vn-flash-off',!!(value&0o00040));setLamp('oprerr',value&0o00100);setLamp('restart',value&0o00200);setLamp('stby',value&0o00400);document.body.classList.toggle('el-off',!!(value&0o01000))
}
function onAgcChannel(channel,value){
  if(mode!=='agc'&&mode!=='agc-loading')return;
  if(channel===0o10)decodeChannel10(value);else if(channel===0o11)decodeChannel11(value);else if(channel===0o163)decodeChannel163(value)
}
function agcFailure(error){
  console.error('AGC core stopped',error);if(agcCore)agcCore.stop();mode='clock';$('agc').textContent='AGC';$('mode').textContent='AGC ERROR · PHONE CLOCK';clearLamps();set2('prog','00');verb='16';noun='65';show(verb,noun);tick()
}
async function enterAgc(){
  if(dream||mode==='agc-loading')return;
  if(mode==='agc'){if(agcCore)agcCore.stop();mode='clock';$('agc').textContent='AGC';$('mode').textContent='V16 N65 · PHONE CLOCK';clearLamps();set2('prog','00');verb='16';noun='65';show(verb,noun);tick();return}
  mode='agc-loading';$('agc').textContent='...';$('mode').textContent='LOADING LUMINARY099 · AGC';resetAgcFace();
  try{
    if(!agcCore)agcCore=new AgcCore({onChannelUpdate:onAgcChannel,onError:agcFailure});
    if(!agcLoaded){await agcCore.load({wasmUrl:'yaAGC.wasm',ropeUrl:'Luminary099.bin'});agcLoaded=true}else{agcCore.reset();agcCore.configureInputMasks()}
    mode='agc';$('agc').textContent='CLOCK';$('mode').textContent=`LUMINARY099 · ${agcCore.version()}`;agcCore.start(1)
  }catch(error){agcFailure(error)}
}

function press(k){
  if(mode==='agc'){if(k==='P'){agcCore.proceedPulse();return}const code=AGC_KEY[k];if(code!==undefined)agcCore.keyPress(code);return}
  if(mode!=='clock')return;
  if(k==='V'){entryMode='V';entry='';set2('verb','  ');return}if(k==='N'){entryMode='N';entry='';set2('noun','  ');return}if(k==='C'){entry='';if(entryMode==='V')set2('verb','  ');else if(entryMode==='N')set2('noun','  ');return}if(k==='R'){mode='clock';verb='16';noun='65';set2('prog','00');show(verb,noun);clearLamps();tick();return}if(k==='K'){setLamp('keyrel',false);return}if(k==='P'){setLamp('prog',!document.querySelector('[data-lamp="prog"]').classList.contains('on'));return}if(k==='E'){if(entryMode==='V'&&entry.length)verb=entry.padStart(2,'0').slice(-2);if(entryMode==='N'&&entry.length)noun=entry.padStart(2,'0').slice(-2);entryMode='';entry='';show(verb,noun);executeClock();return}if(/^\d$/.test(k)&&entryMode){entry=(entry+k).slice(-2);if(entryMode==='V')set2('verb',entry.padEnd(2,' '));else set2('noun',entry.padEnd(2,' '))}
}
function applyDim(){document.body.classList.toggle('dim',dim);store.set('dim',dim?'1':'0')}
function ensureAudio(){if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;audioCtx=new AC()}if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});return audioCtx}
function emitTick(ctx){const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='square';osc.frequency.setValueAtTime(1850,now);osc.frequency.exponentialRampToValueAtTime(650,now+.020);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.32,now+.001);gain.gain.exponentialRampToValueAtTime(.0001,now+.024);osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.030)}
function playTick(){const ctx=ensureAudio();if(!ctx)return;if(ctx.state==='running')emitTick(ctx);else ctx.resume().then(()=>emitTick(ctx)).catch(()=>{})}
function applyTickSound(){store.set('audioTickV2',tickSound?'1':'0');$('sound').textContent=tickSound?'SOUND ON':'SOUND OFF'}
function showControls(){if(dream)return;document.body.classList.add('controls-visible');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>document.body.classList.remove('controls-visible'),5500)}
let holdTimer=0;
document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-key],.app-controls'))return;holdTimer=setTimeout(showControls,620)},{passive:true});
document.addEventListener('pointerup',()=>clearTimeout(holdTimer),{passive:true});document.addEventListener('pointercancel',()=>clearTimeout(holdTimer),{passive:true});
document.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('pressed');press(b.dataset.key);setTimeout(()=>b.classList.remove('pressed'),90)}));
$('dim').addEventListener('click',()=>{dim=!dim;applyDim();showControls()});$('sound').addEventListener('click',()=>{ensureAudio();tickSound=!tickSound;applyTickSound();if(tickSound)playTick();showControls()});$('agc').addEventListener('click',()=>{enterAgc();showControls()});
document.addEventListener('pointerdown',()=>{if(tickSound)ensureAudio()},{passive:true});
window.AGCDSKY={agcChannel:onAgcChannel,getCore:()=>agcCore};
document.body.classList.toggle('dream',dream);if(!dream&&store.get('hinted')!=='1'){document.body.classList.add('first-run');setTimeout(()=>{document.body.classList.remove('first-run');store.set('hinted','1')},3200)}
applyDim();applyTickSound();clearLamps();set2('prog','00');show(verb,noun);tick();setInterval(tick,50);
if(dream){let pos=[[0,0],[3,-2],[-3,2],[2,3],[-2,-3],[1,-1]],i=0;setInterval(()=>{let p=pos[i++%pos.length];$('dsky').style.transform=`translate(${p[0]}px,${p[1]}px)`},60000)}
