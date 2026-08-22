const q=new URLSearchParams(location.search),dream=q.get('dream')==='1';
const $=x=>document.getElementById(x);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
let entryMode='',entry='',verb='16',noun='65',clock=true,dim=dream||store.get('dim')==='1',lampTestActive=false,lastTraffic=null,compTimer=0,controlsTimer=0;

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
// The sign cell is 7x24 on the original panel and is THREE switchable EL
// elements: a horizontal bar plus separate upper/lower vertical bars.
function signGlyph(sign){
  const plus=sign==='+';
  return `<g class="el-sign">`+
    `<path class="el-seg on" d="M.54 10.92 L1.12 10.34 L5.74 10.34 L6.32 10.92 L5.72 11.50 L1.10 11.50 Z"/>`+
    `<path class="el-seg ${plus?'on':'off'}" d="M3.56 4.26 L4.46 4.72 L3.76 10.06 L2.90 10.56 L2.58 10.10 L3.26 4.76 Z"/>`+
    `<path class="el-seg ${plus?'on':'off'}" d="M2.70 11.88 L3.60 12.34 L2.90 17.70 L2.04 18.20 L1.72 17.74 L2.40 12.38 Z"/>`+
    `</g>`;
}
function renderDigits(el,text){
  let out='';String(text).split('').forEach((ch,i)=>out+=glyph(ch,i*14));el.innerHTML=out;
}
function renderReg(el,text){
  text=String(text);let out=signGlyph(text[0]);text.slice(1).split('').forEach((ch,i)=>out+=glyph(ch,7+i*14));el.innerHTML=out;
}
function set2(id,text){renderDigits($(id),String(text).padEnd(2,' ').slice(0,2))}
function setReg(id,sign,digits){renderReg($(id),sign+String(digits).padStart(5,'0').slice(-5))}
function pad(n,len){return String(n).padStart(len,'0').slice(-len)}
function show(v,n){verb=v;noun=n;set2('verb',v.padStart(2,' '));set2('noun',n.padStart(2,' '))}
function tick(){if(!clock)return;const d=new Date(),h=d.getHours(),m=d.getMinutes(),s=d.getSeconds(),cs=Math.floor(d.getMilliseconds()/10);setReg('r1','+',pad(h,5));setReg('r2','+',pad(m,5));setReg('r3','+',pad(s*100+cs,5))}
function setLamp(name,on){const x=document.querySelector(`[data-lamp="${name}"]`);if(x)x.classList.toggle('on',!!on)}
function clearLamps(){document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.remove('on'))}
function lampTest(){lampTestActive=true;document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.add('on'));set2('prog','88');set2('verb','88');set2('noun','88');['r1','r2','r3'].forEach(x=>setReg(x,'+','88888'));setTimeout(()=>{lampTestActive=false;clearLamps();set2('prog','00');show(verb,noun);tick()},1800)}
function execute(){if(verb==='35'){lampTest();return}if(verb==='16'&&noun==='65'){clock=true;$('mode').textContent='V16 N65 · PHONE CLOCK';tick();return}$('mode').textContent=`V${verb} N${noun} · DSKY INPUT`;clock=false}
function press(k){if(k==='V'){entryMode='V';entry='';set2('verb','  ');return}if(k==='N'){entryMode='N';entry='';set2('noun','  ');return}if(k==='C'){entry='';if(entryMode==='V')set2('verb','  ');else if(entryMode==='N')set2('noun','  ');return}if(k==='R'){clock=true;verb='16';noun='65';set2('prog','00');show(verb,noun);clearLamps();tick();return}if(k==='K'){setLamp('keyrel',false);return}if(k==='P'){setLamp('prog',!document.querySelector('[data-lamp="prog"]').classList.contains('on'));return}if(k==='E'){if(entryMode==='V'&&entry.length)verb=entry.padStart(2,'0').slice(-2);if(entryMode==='N'&&entry.length)noun=entry.padStart(2,'0').slice(-2);entryMode='';entry='';show(verb,noun);execute();return}if(/^\d$/.test(k)&&entryMode){entry=(entry+k).slice(-2);if(entryMode==='V')set2('verb',entry.padEnd(2,' '));else set2('noun',entry.padEnd(2,' '))}}
function applyDim(){document.body.classList.toggle('dim',dim);store.set('dim',dim?'1':'0')}
function phoneTraffic(raw){const total=Number(raw);if(!Number.isFinite(total))return;if(lastTraffic!==null){const delta=total-lastTraffic;if(delta>=512&&!lampTestActive){setLamp('comp',true);clearTimeout(compTimer);const hold=Math.min(420,105+Math.log2(delta+1)*17);compTimer=setTimeout(()=>setLamp('comp',false),hold)}}lastTraffic=total}
window.AGCDSKY={phoneTraffic};
function pollTraffic(){try{location.href='agcnet://poll/'+Date.now()}catch(e){}}
function showControls(){if(dream)return;document.body.classList.add('controls-visible');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>document.body.classList.remove('controls-visible'),5500)}
let holdTimer=0;
document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-key],.app-controls'))return;holdTimer=setTimeout(showControls,620)},{passive:true});
document.addEventListener('pointerup',()=>clearTimeout(holdTimer),{passive:true});document.addEventListener('pointercancel',()=>clearTimeout(holdTimer),{passive:true});
document.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('pressed');press(b.dataset.key);setTimeout(()=>b.classList.remove('pressed'),90)}));
$('dim').addEventListener('click',()=>{dim=!dim;applyDim();showControls()});$('realagc').addEventListener('click',()=>{location.href='https://michaelfranzl.github.io/webAGC/demo/'});
document.body.classList.toggle('dream',dream);if(!dream&&store.get('hinted')!=='1'){document.body.classList.add('first-run');setTimeout(()=>{document.body.classList.remove('first-run');store.set('hinted','1')},3200)}
applyDim();clearLamps();set2('prog','00');show(verb,noun);tick();setInterval(tick,50);setInterval(pollTraffic,400);setTimeout(pollTraffic,250);
if(dream){let pos=[[0,0],[3,-2],[-3,2],[2,3],[-2,-3],[1,-1]],i=0;setInterval(()=>{let p=pos[i++%pos.length];$('dsky').style.transform=`translate(${p[0]}px,${p[1]}px)`},60000)}
