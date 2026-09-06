'use strict';

/*
 * DSKY-centred spacecraft installation artwork.
 *
 * The DSKY is always centred by the app. This renderer aligns a much larger
 * spacecraft panel drawing to the live 320 x 372 DSKY rectangle. Phone aspect
 * ratio therefore changes only what real neighbouring hardware is visible.
 *
 * CM layout follows the Block II Main Display Console Panel 2 grouping:
 *   2A caution/warning + docking/mission timer above, 2B FDAI No.2 left,
 *   2C CMC DSKY, 2D abort/boost/entry below, 2E RCS management right.
 * LM layout follows LMA790 Panel 4 / Figure 3.6: DSKY in the centre, CDR/LMP
 * ACA/4 JET and TTCA/TRANSL switches immediately left/right, Panel 3 directly
 * above, Panels 5/6 and the forward hatch below.
 */
(() => {
  const app = document.getElementById('app');
  const dsky = document.getElementById('dsky');
  if (!app || !dsky || document.getElementById('spacecraft-panel')) return;

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const txt = (x,y,s,cls='p-micro',anchor='middle') => `<text class="p-text ${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
  const line = (x1,y1,x2,y2,cls='engrave') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

  const screw = (x,y,r=4.2) => `<g transform="translate(${x} ${y})"><circle class="p-screw" r="${r}"/><line class="p-screw-slot" x1="-${r*.65}" y1="0" x2="${r*.65}" y2="0" transform="rotate(-18)"/></g>`;
  const toggle = (x,y,top='',bottom='',state='up') => `<g class="p-toggle" transform="translate(${x} ${y})">
    <circle class="p-toggle-ring" r="8.2"/><circle class="p-toggle-base" r="5.8"/>
    <line class="p-toggle-stick" x1="0" y1="1" x2="${state==='left'?-10:state==='right'?10:0}" y2="${state==='down'?12:-14}"/>
    ${top?txt(0,-22,top):''}${bottom?txt(0,24,bottom):''}
  </g>`;
  const guarded = (x,y,label,kind='wire') => `<g transform="translate(${x} ${y})">
    ${kind==='red'?'<rect class="p-redguard" x="-15" y="-21" width="30" height="40" rx="2"/>':'<path class="p-wireguard" d="M-15 18V-19H15V18"/>'}
    ${toggle(0,0,'','')}${txt(0,31,label)}
  </g>`;
  const talkback = (x,y,label='',state='bp') => `<g transform="translate(${x} ${y})"><rect class="p-talk" x="-14" y="-7" width="28" height="14" rx="1.5"/>${state==='bp'?'<path class="p-bp" d="M-12 -5L-5 5M-4 -5L3 5M4 -5L11 5"/>':''}${label?txt(0,19,label):''}</g>`;
  const knob = (x,y,label='',r=11) => `<g transform="translate(${x} ${y})"><circle class="p-knob-ring" r="${r+3}"/><circle class="p-knob" r="${r}"/><line class="p-knob-mark" x1="0" y1="0" x2="0" y2="-${r-2}"/>${label?txt(0,r+16,label):''}</g>`;
  const push = (x,y,w,h,label,kind='dark') => `<g transform="translate(${x} ${y})"><rect class="p-push p-${kind}" width="${w}" height="${h}" rx="2"/>${txt(w/2,h/2+2,label,'p-micro')}</g>`;
  const digital = (x,y,w,h,text) => `<g transform="translate(${x} ${y})"><rect class="p-digital" width="${w}" height="${h}" rx="2"/><text class="p-digits" x="${w/2}" y="${h*.69}" text-anchor="middle">${esc(text)}</text></g>`;
  const meter = (x,y,r,label) => {
    const ticks = Array.from({length:11},(_,i)=>{const a=(-135+i*27)*Math.PI/180;return line((Math.cos(a)*r*.66).toFixed(1),(Math.sin(a)*r*.66).toFixed(1),(Math.cos(a)*r*.84).toFixed(1),(Math.sin(a)*r*.84).toFixed(1),'p-meter-tick')}).join('');
    return `<g transform="translate(${x} ${y})"><circle class="p-meter-case" r="${r+5}"/><circle class="p-meter-face" r="${r}"/>${ticks}<line class="p-meter-pointer" x1="0" y1="4" x2="${r*.48}" y2="-${r*.40}"/><circle class="p-meter-hub" r="4"/>${txt(0,r+17,label,'p-tiny')}</g>`;
  };
  const fdai = (x,y,r=112) => `<g transform="translate(${x} ${y})">
    <circle class="fdai-case" r="${r+16}"/><circle class="fdai-bezel" r="${r+10}"/><clipPath id="fdaiClip"><circle r="${r}"/></clipPath>
    <g clip-path="url(#fdaiClip)"><rect x="-${r}" y="-${r}" width="${2*r}" height="${r}" class="fdai-sky"/><rect x="-${r}" y="0" width="${2*r}" height="${r}" class="fdai-ground"/>
      ${Array.from({length:9},(_,i)=>line(-r,(i-4)*r/5,r,(i-4)*r/5,'fdai-grid')).join('')}
      ${Array.from({length:9},(_,i)=>line((i-4)*r/5,-r,(i-4)*r/5,r,'fdai-grid')).join('')}
      <path class="fdai-horizon" d="M-${r} 0H${r}"/>
    </g>
    <circle class="fdai-glass" r="${r}"/><path class="fdai-wing" d="M-${r*.78} 0H-${r*.22}M${r*.22} 0H${r*.78}M0 -${r*.22}V${r*.22}"/>
    <path class="fdai-needle fdai-red" d="M-${r*.94} -10H-${r*.70}M${r*.94} 10H${r*.70}"/><path class="fdai-needle" d="M-9 -${r*.94}V-${r*.72}M9 ${r*.94}V${r*.72}"/>
    ${txt(0,r+25,'FDAI NO. 2','p-small')}
  </g>`;
  const caution = (x,y,labels,cols=4) => {
    const w=54,h=22,g=4;
    return `<g>${labels.map((s,i)=>{const cx=x+(i%cols)*(w+g),cy=y+Math.floor(i/cols)*(h+g);return push(cx,cy,w,h,s,s==='CMC'||s==='ISS'?'red':'amber')}).join('')}</g>`;
  };

  function cmScene(){
    const cwa=['BOOSTER','LV RATE','SPS PRESS','SPS TEMP','CM RCS','SM RCS','CABIN','SUIT','O2 FLOW','H2 PRESS','O2 PRESS','FC 1','FC 2','FC 3','AC BUS','DC BUS','CMC','ISS','G&N','ECS'];
    const quads=['A','B','C','D'];
    return `<svg class="cm-scene" viewBox="0 0 1320 1120" aria-hidden="true">
      <rect x="0" y="0" width="1320" height="1120" fill="#171a17"/>
      <rect class="cm-panel" x="12" y="12" width="1296" height="1096" rx="3"/>
      <g transform="translate(420 22)"><rect class="cm-subpanel" x="0" y="0" width="480" height="250" rx="3"/>
        ${caution(22,28,cwa,5)}${digital(22,150,132,44,'000:00')}${txt(88,208,'MISSION TIMER','p-small')}
        ${toggle(205,174,'PROBE','EXT/RETR')}${talkback(205,220,'PROBE')}${toggle(278,174,'LM PWR','OFF')}${toggle(350,174,'C/W','NORMAL')}${knob(423,177,'LAMP TEST',12)}${line(8,138,472,138,'p-seam')}
      </g>
      <g transform="translate(20 282)"><rect class="cm-subpanel" x="0" y="0" width="375" height="510" rx="3"/>
        ${fdai(188,190,120)}${meter(82,384,42,'ROLL RATE')}${meter(188,384,42,'PITCH RATE')}${meter(294,384,42,'YAW RATE')}
        ${knob(82,470,'ATT SET ROLL',13)}${knob(188,470,'PITCH',13)}${knob(294,470,'YAW',13)}
      </g>
      <g><rect class="cm-subpanel" x="482" y="300" width="356" height="410" rx="3"/><rect class="dsky-pocket" x="490" y="308" width="340" height="394" rx="2"/><rect x="500" y="319" width="320" height="372" fill="#111311"/></g>
      <g transform="translate(900 270)"><rect class="cm-subpanel" x="0" y="0" width="390" height="535" rx="3"/>
        ${meter(70,78,43,'He PRESS')}${meter(190,78,43,'SEC FUEL')}${meter(310,78,43,'PRPLNT QTY')}${txt(195,143,'SM RCS HELIUM','p-small')}
        ${quads.map((q,i)=>`${talkback(70+i*82,176,'')}${toggle(70+i*82,213,'',q+' 1')}${talkback(70+i*82,258,'')}${toggle(70+i*82,295,'',q+' 2')}`).join('')}
        ${txt(195,345,'SM RCS PRPLNT','p-small')}${quads.map((q,i)=>`${talkback(70+i*82,375,'')}${toggle(70+i*82,412,'',q)}`).join('')}
        ${talkback(116,472,'CM SYS 1')}${talkback(195,472,'CM SYS 2')}${toggle(302,472,'RCS IND','CM/SM')}
      </g>
      <g transform="translate(382 754)"><rect class="cm-subpanel" x="0" y="0" width="556" height="330" rx="3"/>
        ${guarded(46,74,'EDS AUTO','red')}${guarded(122,74,'CSM/LM SEP')}${guarded(198,74,'CM/SM SEP')}${guarded(274,74,'S-IVB/LM')}${guarded(350,74,'TWR JETT')}${guarded(426,74,'MAIN REL')}${guarded(502,74,'DROGUE')}
        ${toggle(62,178,'ABORT','PRPLNT DUMP')}${toggle(152,178,'2 ENG','OUT')}${toggle(242,178,'LV','RATES')}${toggle(332,178,'GUIDANCE','CMC/IU')}${toggle(422,178,'ENTRY','AUTO')}${toggle(502,178,'RCS CMD','ON')}
        ${push(24,245,94,38,'ABORT','red')}${push(136,245,94,38,'BOOST','dark')}${push(248,245,94,38,'ENTRY','dark')}${push(360,245,94,38,'ELS','dark')}${push(472,245,60,38,'EMS','dark')}
      </g>
      ${[[24,24],[410,24],[910,24],[1296,24],[24,1096],[410,1096],[910,1096],[1296,1096],[468,286],[852,286],[468,724],[852,724]].map(p=>screw(...p)).join('')}
    </svg>`;
  }

  function lmScene(){
    const p3a=['RR MODE','RR SLEW','LR ANT','LR MODE','TEMP MON','ENG GMBL','DESC ENG','ASC ENG','GUID CONT','MODE CONT','ROLL','PITCH','YAW','RCS A/B','QUAD 1','QUAD 2','QUAD 3','QUAD 4','EVENT TMR','FLOOD','SIDE PNL','DOCK LTS','TRACK LT','LAMP/TONE'];
    return `<svg class="lm-scene" viewBox="0 0 1180 1320" aria-hidden="true">
      <rect x="0" y="0" width="1180" height="1320" fill="#171a18"/><rect class="lm-panel" x="12" y="12" width="1156" height="1296" rx="3"/>
      <g transform="translate(40 80)"><rect class="lm-subpanel" x="0" y="0" width="1100" height="245" rx="3"/>
        ${p3a.map((s,i)=>{const c=i%12,r=Math.floor(i/12),x=42+c*86,y=60+r*105;return `${toggle(x,y,'',s)}${r===0&&c<8?talkback(x,y+38,''):''}`}).join('')}${line(15,121,1085,121,'p-seam')}
      </g>
      <g><rect class="lm-subpanel" x="290" y="350" width="600" height="610" rx="3"/>
        ${guarded(340,455,'CDR ACA/4 JET')}${txt(340,493,'ENABLE','p-tiny')}${txt(340,511,'DISABLE','p-tiny')}${guarded(340,605,'CDR TTCA/TRANSL')}${txt(340,643,'ENABLE','p-tiny')}${txt(340,661,'DISABLE','p-tiny')}
        ${guarded(840,455,'LMP ACA/4 JET')}${txt(840,493,'ENABLE','p-tiny')}${txt(840,511,'DISABLE','p-tiny')}${guarded(840,605,'LMP TTCA/TRANSL')}${txt(840,643,'ENABLE','p-tiny')}${txt(840,661,'DISABLE','p-tiny')}
        <rect class="dsky-pocket" x="420" y="377" width="340" height="394" rx="2"/><rect x="430" y="388" width="320" height="372" fill="#101310"/>
        ${txt(340,735,'ACA / TTCA','p-small')}${txt(840,735,'ACA / TTCA','p-small')}${talkback(340,786,'CDR DIRECT')}${talkback(840,786,'LMP DIRECT')}${toggle(340,842,'ATT DIR','CONT')}${toggle(840,842,'ATT DIR','CONT')}
      </g>
      <g transform="translate(40 985)"><rect class="lm-subpanel" x="0" y="0" width="260" height="260" rx="3"/>${digital(24,28,116,40,'000:00')}${push(24,92,96,38,'ENGINE START','dark')}${push(140,92,96,38,'ENGINE STOP','red')}${toggle(55,185,'FLOOD','OFF')}${toggle(130,185,'TRACK','OFF')}${toggle(205,185,'SIDE PNL','OFF')}</g>
      <g transform="translate(880 985)"><rect class="lm-subpanel" x="0" y="0" width="260" height="260" rx="3"/>${digital(24,28,212,44,'00000')}${push(25,105,92,40,'ABORT','red')}${push(143,105,92,40,'ABORT STAGE','red')}${toggle(55,198,'DEDA','READ OUT')}${toggle(130,198,'AGS','OPERATE')}${toggle(205,198,'MODE','SELECT')}</g>
      <g><path class="lm-hatch" d="M330 1320V1115Q330 1000 440 1000H740Q850 1000 850 1115V1320Z"/><path class="lm-hatch-inner" d="M375 1320V1130Q375 1055 450 1055H730Q805 1055 805 1130V1320Z"/><rect class="lm-hatch-handle" x="548" y="1095" width="84" height="26" rx="4"/></g>
      ${[[28,28],[575,28],[1152,28],[28,336],[575,336],[1152,336],[278,340],[902,340],[278,972],[902,972],[28,1292],[1152,1292]].map(p=>screw(...p)).join('')}
    </svg>`;
  }

  const panel=document.createElement('div');panel.id='spacecraft-panel';panel.setAttribute('aria-hidden','true');panel.innerHTML=cmScene()+lmScene();app.insertBefore(panel,dsky);
  const specs={cm:{w:1320,h:1120,x:500,y:319},lm:{w:1180,h:1320,x:430,y:388}};
  const current=()=>document.body.classList.contains('spacecraft-lm')?specs.lm:specs.cm;
  function syncPanel(){
    if(document.body.classList.contains('dream')||document.body.classList.contains('screen-only')||document.body.classList.contains('display-only'))return;
    const r=dsky.getBoundingClientRect();if(!r.width||!r.height)return;const s=current(),scale=r.width/320;
    panel.style.width=(s.w*scale)+'px';panel.style.height=(s.h*scale)+'px';panel.style.left=(r.left-s.x*scale)+'px';panel.style.top=(r.top-s.y*scale)+'px';
  }
  let raf=0;const q=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(syncPanel)};addEventListener('resize',q,{passive:true});addEventListener('orientationchange',q,{passive:true});new MutationObserver(q).observe(document.body,{attributes:true,attributeFilter:['class']});if(window.ResizeObserver)new ResizeObserver(q).observe(dsky);q();if(window.AGCDSKY)window.AGCDSKY.syncSpacecraftPanel=syncPanel;
})();
