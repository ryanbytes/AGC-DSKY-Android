const q=new URLSearchParams(location.search),dream=q.get('dream')==='1';
const $=x=>document.getElementById(x);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
let entryMode='',entry='',verb='16',noun='65',clock=true,dim=dream||store.get('dim')==='1',lampTestActive=false,lastTraffic=null,compTimer=0,controlsTimer=0;

// Apollo DSKY EL numerals are seven-segment, but the glass geometry is not a
// generic LED font. These paths use the original 14x24 character envelope,
// with the characteristic slightly left-leaning vertical strokes and short,
// chamfered horizontal elements visible on real Block II EL glass.
const SEG={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg'};
const PATH={
  a:'M2.15 1.05 L11.28 1.05 L12.38 2.02 L11.25 3.04 L2.03 3.04 L1.18 2.05 Z',
  g:'M1.05 11.02 L2.08 10.04 L11.25 10.04 L12.28 11.02 L11.22 12.03 L2.02 12.03 Z',
  d:'M0.02 21.95 L1.08 20.96 L10.26 20.96 L11.28 21.95 L10.15 22.95 L0.98 22.95 Z',
  f:'M1.55 3.42 L2.68 4.32 L1.43 10.47 L0.34 11.38 L-0.28 10.54 L0.94 4.27 Z',
  b:'M11.74 3.42 L12.87 4.31 L11.62 10.47 L10.53 11.38 L9.91 10.54 L11.13 4.27 Z',
  e:'M0.29 12.60 L1.42 13.48 L0.17 19.66 L-0.92 20.57 L-1.54 19.72 L-0.32 13.43 Z',
  c:'M10.48 12.60 L11.61 13.48 L10.36 19.66 L9.27 20.57 L8.65 19.72 L9.87 13.43 Z'
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
    `<path class="el-seg on" d="M.45 11.02 L1.35 10.04 L5.75 10.04 L6.62 11.02 L5.72 12.03 L1.32 12.03 Z"/>`+
    `<path class="el-seg ${plus?'on':'off'}" d="M3.78 4.18 L4.77 4.98 L3.71 10.10 L2.74 10.91 L2.20 10.18 L3.24 4.94 Z"/>`+
    `<path class="el-seg ${plus?'on':'off'}" d="M2.69 12.96 L3.68 13.74 L2.62 18.88 L1.66 19.69 L1.11 18.95 L2.16 13.70 Z"/>`+
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
