'use strict';

/*
 * DSKY-centred spacecraft installation artwork — photoreal hardware pass.
 *
 * The DSKY is always centred by the app.  This renderer aligns a much larger
 * spacecraft panel drawing to the live 320 x 372 DSKY rectangle.  Phone aspect
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

  const screw = (x,y,r=4.2) => `<g class="p-screw-asm" transform="translate(${x} ${y})">
    <circle class="p-screw-shadow" cy="1.4" r="${r+1.1}"/>
    <circle class="p-screw-rim" r="${r+0.7}"/><circle class="p-screw" r="${r}"/>
    <path class="p-screw-glint" d="M-${(r*.62).toFixed(2)} -${(r*.38).toFixed(2)} A${r} ${r} 0 0 1 ${(r*.45).toFixed(2)} -${(r*.68).toFixed(2)}"/>
    <line class="p-screw-slot-shadow" x1="-${(r*.67).toFixed(2)}" y1=".7" x2="${(r*.67).toFixed(2)}" y2=".7" transform="rotate(-18)"/>
    <line class="p-screw-slot" x1="-${(r*.65).toFixed(2)}" y1="0" x2="${(r*.65).toFixed(2)}" y2="0" transform="rotate(-18)"/>
  </g>`;

  const toggle = (x,y,top='',bottom='',state='up') => {
    const ex=state==='left'?-10:state==='right'?10:0, ey=state==='down'?12:-14;
    const hx=(ex*.94).toFixed(1), hy=(ey*.94).toFixed(1);
    return `<g class="p-toggle" transform="translate(${x} ${y})">
      <ellipse class="p-toggle-shadow" cx="1.4" cy="3.2" rx="9.4" ry="6.7"/>
      <circle class="p-toggle-ring-outer" r="9.2"/><circle class="p-toggle-ring" r="8.0"/><circle class="p-toggle-base" r="5.6"/>
      <line class="p-toggle-stick-shadow" x1=".9" y1="2" x2="${ex+1.3}" y2="${ey+1.8}"/>
      <line class="p-toggle-stick" x1="0" y1="1" x2="${ex}" y2="${ey}"/>
      <circle class="p-toggle-tip-shadow" cx="${(+hx+1).toFixed(1)}" cy="${(+hy+1.2).toFixed(1)}" r="2.35"/>
      <circle class="p-toggle-tip" cx="${hx}" cy="${hy}" r="2.15"/>
      ${top?txt(0,-24,top):''}${bottom?txt(0,26,bottom):''}
    </g>`;
  };

  const guarded = (x,y,label,kind='wire') => `<g class="p-guarded" transform="translate(${x} ${y})">
    ${kind==='red'?'<rect class="p-redguard-shadow" x="-17" y="-23" width="34" height="44" rx="2.5"/><rect class="p-redguard" x="-15" y="-21" width="30" height="40" rx="2"/>':'<path class="p-wireguard-shadow" d="M-16 19V-20H16V19"/><path class="p-wireguard" d="M-15 18V-19H15V18"/>'}
    ${toggle(0,0,'','')}${txt(0,33,label)}
  </g>`;

  const talkback = (x,y,label='',state='bp') => `<g class="p-talkback" transform="translate(${x} ${y})">
    <rect class="p-talk-shadow" x="-15.5" y="-8.5" width="31" height="17" rx="2"/>
    <rect class="p-talk-frame" x="-15" y="-8" width="30" height="16" rx="1.8"/>
    <rect class="p-talk" x="-12.5" y="-5.5" width="25" height="11" rx="1"/>
    ${state==='bp'?'<path class="p-bp" d="M-10 -4L-4 4M-3 -4L3 4M4 -4L10 4"/>':''}
    <path class="p-talk-glass" d="M-11 -4.5H10"/>${label?txt(0,20,label):''}
  </g>`;

  const knob = (x,y,label='',r=11) => `<g class="p-knob-asm" transform="translate(${x} ${y})">
    <circle class="p-knob-shadow" cx="1.5" cy="2" r="${r+4}"/><circle class="p-knob-ring" r="${r+3}"/>
    <circle class="p-knob" r="${r}"/><path class="p-knob-highlight" d="M-${(r*.68).toFixed(1)} -${(r*.42).toFixed(1)} A${r} ${r} 0 0 1 ${(r*.55).toFixed(1)} -${(r*.72).toFixed(1)}"/>
    <line class="p-knob-mark-shadow" x1=".8" y1=".7" x2=".8" y2="-${r-1.3}"/><line class="p-knob-mark" x1="0" y1="0" x2="0" y2="-${r-2}"/>${label?txt(0,r+17,label):''}
  </g>`;

  const push = (x,y,w,h,label,kind='dark') => `<g class="p-push-asm" transform="translate(${x} ${y})">
    <rect class="p-push-shadow" x="1.5" y="2.2" width="${w}" height="${h}" rx="3"/>
    <rect class="p-push-bezel" x="-1.4" y="-1.4" width="${w+2.8}" height="${h+2.8}" rx="3.2"/>
    <rect class="p-push p-${kind}" width="${w}" height="${h}" rx="2.2"/>
    <path class="p-push-glint" d="M2 2H${w-2}"/>${txt(w/2,h/2+2,label,'p-micro')}
  </g>`;

  const digital = (x,y,w,h,text) => `<g class="p-digital-asm" transform="translate(${x} ${y})">
    <rect class="p-digital-shadow" x="2" y="2.5" width="${w}" height="${h}" rx="3"/>
    <rect class="p-digital-frame" x="-2" y="-2" width="${w+4}" height="${h+4}" rx="3.5"/>
    <rect class="p-digital" width="${w}" height="${h}" rx="2"/>
    <path class="p-digital-glass" d="M3 3H${w-3}"/><text class="p-digits" x="${w/2}" y="${h*.69}" text-anchor="middle">${esc(text)}</text>
  </g>`;

  const meter = (x,y,r,label) => {
    const ticks = Array.from({length:13},(_,i)=>{const a=(-136+i*22.6667)*Math.PI/180;return line((Math.cos(a)*r*.68).toFixed(1),(Math.sin(a)*r*.68).toFixed(1),(Math.cos(a)*r*.86).toFixed(1),(Math.sin(a)*r*.86).toFixed(1),'p-meter-tick')}).join('');
    return `<g class="p-meter" transform="translate(${x} ${y})">
      <circle class="p-meter-shadow" cx="2" cy="3" r="${r+7}"/><circle class="p-meter-case" r="${r+6}"/><circle class="p-meter-ring" r="${r+2}"/><circle class="p-meter-face" r="${r}"/>
      ${ticks}<path class="p-meter-scale" d="M-${(r*.60).toFixed(1)} ${(r*.36).toFixed(1)} A${(r*.72).toFixed(1)} ${(r*.72).toFixed(1)} 0 0 1 ${(r*.60).toFixed(1)} ${(r*.36).toFixed(1)}"/>
      <line class="p-meter-pointer-shadow" x1="1" y1="5" x2="${r*.49+1}" y2="-${r*.39-1}"/><line class="p-meter-pointer" x1="0" y1="4" x2="${r*.48}" y2="-${r*.40}"/>
      <circle class="p-meter-hub-ring" r="5.2"/><circle class="p-meter-hub" r="3.6"/><path class="p-meter-reflect" d="M-${(r*.62).toFixed(1)} -${(r*.52).toFixed(1)} Q0 -${(r*.88).toFixed(1)} ${(r*.50).toFixed(1)} -${(r*.58).toFixed(1)}"/>
      ${txt(0,r+18,label,'p-tiny')}
    </g>`;
  };

  const fdai = (x,y,r=112) => `<g class="fdai" transform="translate(${x} ${y})">
    <circle class="fdai-shadow" cx="3" cy="4" r="${r+18}"/><circle class="fdai-case" r="${r+16}"/><circle class="fdai-bezel-outer" r="${r+12}"/><circle class="fdai-bezel" r="${r+9}"/>
    <clipPath id="fdaiClip"><circle r="${r}"/></clipPath>
    <g clip-path="url(#fdaiClip)"><rect x="-${r}" y="-${r}" width="${2*r}" height="${r}" class="fdai-sky"/><rect x="-${r}" y="0" width="${2*r}" height="${r}" class="fdai-ground"/>
      ${Array.from({length:9},(_,i)=>line(-r,(i-4)*r/5,r,(i-4)*r/5,'fdai-grid')).join('')}
      ${Array.from({length:9},(_,i)=>line((i-4)*r/5,-r,(i-4)*r/5,r,'fdai-grid')).join('')}
      <path class="fdai-horizon" d="M-${r} 0H${r}"/><ellipse class="fdai-shade" cx="-${r*.30}" cy="-${r*.38}" rx="${r*.78}" ry="${r*.62}"/>
    </g>
    <circle class="fdai-glass" r="${r}"/><path class="fdai-glass-glint" d="M-${r*.67} -${r*.58} Q0 -${r*.94} ${r*.57} -${r*.66}"/>
    <path class="fdai-wing-shadow" d="M-${r*.78} 2H-${r*.22}M${r*.22} 2H${r*.78}M2 -${r*.22}V${r*.22}"/><path class="fdai-wing" d="M-${r*.78} 0H-${r*.22}M${r*.22} 0H${r*.78}M0 -${r*.22}V${r*.22}"/>
    <path class="fdai-needle fdai-red" d="M-${r*.94} -10H-${r*.70}M${r*.94} 10H${r*.70}"/><path class="fdai-needle" d="M-9 -${r*.94}V-${r*.72}M9 ${r*.94}V${r*.72}"/>
    ${txt(0,r+26,'FDAI NO. 2','p-small')}
  </g>`;
  const caution = (x,y,labels,cols=4) => {
    const w=54,h=22,g=4;
    return `<g>${labels.map((s,i)=>{const cx=x+(i%cols)*(w+g),cy=y+Math.floor(i/cols)*(h+g);return push(cx,cy,w,h,s,s==='CMC'||s==='ISS'?'red':'amber')}).join('')}</g>`;
  };

  function cmScene(){
    const cwa=['BOOSTER','LV RATE','SPS PRESS','SPS TEMP','CM RCS','SM RCS','CABIN','SUIT','O2 FLOW','H2 PRESS','O2 PRESS','FC 1','FC 2','FC 3','AC BUS','DC BUS','CMC','ISS','G&N','ECS'];
    const quads=['A','B','C','D'];
    return `<svg class="cm-scene" viewBox="0 0 1320 1120" aria-hidden="true">
      <defs>
        <linearGradient id="cmPaint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#535a54"/><stop offset=".48" stop-color="#454b46"/><stop offset="1" stop-color="#363c37"/></linearGradient>
        <linearGradient id="cmSubMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a615b"/><stop offset=".46" stop-color="#4d544e"/><stop offset="1" stop-color="#404641"/></linearGradient>
        <filter id="cmTexture" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="2" seed="17" result="n"/><feColorMatrix in="n" values="1 0 0 0 .34 0 1 0 0 .36 0 0 1 0 .34 0 0 0 .075 0" result="grain"/><feBlend in="SourceGraphic" in2="grain" mode="multiply"/></filter>
        <radialGradient id="fdaiSky" cx="37%" cy="28%" r="78%"><stop offset="0" stop-color="#8fa4ad"/><stop offset=".55" stop-color="#667e89"/><stop offset="1" stop-color="#3f535d"/></radialGradient>
        <radialGradient id="fdaiGround" cx="40%" cy="25%" r="82%"><stop offset="0" stop-color="#a68c71"/><stop offset=".58" stop-color="#7f6957"/><stop offset="1" stop-color="#56473b"/></radialGradient>
      </defs>
      <rect x="0" y="0" width="1320" height="1120" fill="#171a17"/>
      <rect class="cm-panel" x="12" y="12" width="1296" height="1096" rx="3"/>

      <!-- Immediate upper neighbourhood: MDC 2A. -->
      <g transform="translate(420 22)">
        <rect class="cm-subpanel" x="0" y="0" width="480" height="250" rx="3"/>
        ${caution(22,28,cwa,5)}
        ${digital(22,150,132,44,'000:00')}
        ${txt(88,208,'MISSION TIMER','p-small')}
        ${toggle(205,174,'PROBE','EXT/RETR')}${talkback(205,220,'PROBE')}
        ${toggle(278,174,'LM PWR','OFF')}${toggle(350,174,'C/W','NORMAL')}${knob(423,177,'LAMP TEST',12)}
        ${line(8,138,472,138,'p-seam')}
      </g>

      <!-- FDAI No.2 directly left of 2C. -->
      <g transform="translate(20 282)"><rect class="cm-subpanel" x="0" y="0" width="375" height="510" rx="3"/>
        ${fdai(188,190,120)}
        ${meter(82,384,42,'ROLL RATE')}${meter(188,384,42,'PITCH RATE')}${meter(294,384,42,'YAW RATE')}
        ${knob(82,470,'ATT SET ROLL',13)}${knob(188,470,'PITCH',13)}${knob(294,470,'YAW',13)}
      </g>

      <!-- 2C DSKY installation aperture: actual live DSKY covers this exactly. -->
      <g><rect class="cm-subpanel" x="482" y="300" width="356" height="410" rx="3"/><rect class="dsky-pocket" x="490" y="308" width="340" height="394" rx="2"/><rect x="500" y="319" width="320" height="372" fill="#111311"/></g>

      <!-- RCS management directly right of the DSKY. -->
      <g transform="translate(900 270)"><rect class="cm-subpanel" x="0" y="0" width="390" height="535" rx="3"/>
        ${meter(70,78,43,'He PRESS')}${meter(190,78,43,'SEC FUEL')}${meter(310,78,43,'PRPLNT QTY')}
        ${txt(195,143,'SM RCS HELIUM','p-small')}
        ${quads.map((q,i)=>`${talkback(70+i*82,176,'')}${toggle(70+i*82,213,'',q+' 1')}${talkback(70+i*82,258,'')}${toggle(70+i*82,295,'',q+' 2')}`).join('')}
        ${txt(195,345,'SM RCS PRPLNT','p-small')}
        ${quads.map((q,i)=>`${talkback(70+i*82,375,'')}${toggle(70+i*82,412,'',q)}`).join('')}
        ${talkback(116,472,'CM SYS 1')}${talkback(195,472,'CM SYS 2')}${toggle(302,472,'RCS IND','CM/SM')}
      </g>

      <!-- Abort / boost / entry area directly below 2C. -->
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
      <defs>
        <linearGradient id="lmPaint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f5651"/><stop offset=".52" stop-color="#414842"/><stop offset="1" stop-color="#343a35"/></linearGradient>
        <linearGradient id="lmSubMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#555c57"/><stop offset=".48" stop-color="#484f4a"/><stop offset="1" stop-color="#3b423d"/></linearGradient>
        <filter id="lmTexture" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".42" numOctaves="2" seed="23" result="n"/><feColorMatrix in="n" values="1 0 0 0 .34 0 1 0 0 .36 0 0 1 0 .34 0 0 0 .075 0" result="grain"/><feBlend in="SourceGraphic" in2="grain" mode="multiply"/></filter>
      </defs>
      <rect x="0" y="0" width="1180" height="1320" fill="#171a18"/>
      <rect class="lm-panel" x="12" y="12" width="1156" height="1296" rx="3"/>

      <!-- Panel 3: the real dense strip immediately above Panel 4. -->
      <g transform="translate(40 80)"><rect class="lm-subpanel" x="0" y="0" width="1100" height="245" rx="3"/>
        ${p3a.map((s,i)=>{const c=i%12,r=Math.floor(i/12),x=42+c*86,y=60+r*105;return `${toggle(x,y,'',s)}${r===0&&c<8?talkback(x,y+38,''):''}`}).join('')}
        ${line(15,121,1085,121,'p-seam')}
      </g>

      <!-- Panel 4 local face.  Figure 3.6 arrangement: two controller switches per side. -->
      <g><rect class="lm-subpanel" x="290" y="350" width="600" height="610" rx="3"/>
        ${guarded(340,455,'CDR ACA/4 JET')}${txt(340,493,'ENABLE','p-tiny')}${txt(340,511,'DISABLE','p-tiny')}
        ${guarded(340,605,'CDR TTCA/TRANSL')}${txt(340,643,'ENABLE','p-tiny')}${txt(340,661,'DISABLE','p-tiny')}
        ${guarded(840,455,'LMP ACA/4 JET')}${txt(840,493,'ENABLE','p-tiny')}${txt(840,511,'DISABLE','p-tiny')}
        ${guarded(840,605,'LMP TTCA/TRANSL')}${txt(840,643,'ENABLE','p-tiny')}${txt(840,661,'DISABLE','p-tiny')}
        <rect class="dsky-pocket" x="420" y="377" width="340" height="394" rx="2"/><rect x="430" y="388" width="320" height="372" fill="#101310"/>
        ${txt(340,735,'ACA / TTCA','p-small')}${txt(840,735,'ACA / TTCA','p-small')}
        ${talkback(340,786,'CDR DIRECT')}${talkback(840,786,'LMP DIRECT')}
        ${toggle(340,842,'ATT DIR','CONT')}${toggle(840,842,'ATT DIR','CONT')}
      </g>

      <!-- Panel 5/6 immediately below, plus forward hatch. -->
      <g transform="translate(40 985)"><rect class="lm-subpanel" x="0" y="0" width="260" height="260" rx="3"/>
        ${digital(24,28,116,40,'000:00')}${push(24,92,96,38,'ENGINE START','dark')}${push(140,92,96,38,'ENGINE STOP','red')}
        ${toggle(55,185,'FLOOD','OFF')}${toggle(130,185,'TRACK','OFF')}${toggle(205,185,'SIDE PNL','OFF')}
      </g>
      <g transform="translate(880 985)"><rect class="lm-subpanel" x="0" y="0" width="260" height="260" rx="3"/>
        ${digital(24,28,212,44,'00000')}${push(25,105,92,40,'ABORT','red')}${push(143,105,92,40,'ABORT STAGE','red')}
        ${toggle(55,198,'DEDA','READ OUT')}${toggle(130,198,'AGS','OPERATE')}${toggle(205,198,'MODE','SELECT')}
      </g>
      <g><path class="lm-hatch" d="M330 1320V1115Q330 1000 440 1000H740Q850 1000 850 1115V1320Z"/><path class="lm-hatch-inner" d="M375 1320V1130Q375 1055 450 1055H730Q805 1055 805 1130V1320Z"/><rect class="lm-hatch-handle" x="548" y="1095" width="84" height="26" rx="4"/></g>

      ${[[28,28],[575,28],[1152,28],[28,336],[575,336],[1152,336],[278,340],[902,340],[278,972],[902,972],[28,1292],[1152,1292]].map(p=>screw(...p)).join('')}
    </svg>`;
  }

  const panel = document.createElement('div');
  panel.id='spacecraft-panel';
  panel.setAttribute('aria-hidden','true');
  panel.innerHTML=cmScene()+lmScene();
  app.insertBefore(panel,dsky);

  // Exact registration coordinates of the live DSKY rectangle in each scene.
  const specs={cm:{w:1320,h:1120,x:500,y:319},lm:{w:1180,h:1320,x:430,y:388}};
  const current=()=>document.body.classList.contains('spacecraft-lm')?specs.lm:specs.cm;

  function syncPanel(){
    if(document.body.classList.contains('dream')||document.body.classList.contains('screen-only')||document.body.classList.contains('display-only')) return;
    const r=dsky.getBoundingClientRect();
    if(!r.width||!r.height) return;
    const s=current(),scale=r.width/320;
    panel.style.width=(s.w*scale)+'px';
    panel.style.height=(s.h*scale)+'px';
    panel.style.left=(r.left-s.x*scale)+'px';
    panel.style.top=(r.top-s.y*scale)+'px';
  }
  let raf=0;const q=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(syncPanel)};
  addEventListener('resize',q,{passive:true});addEventListener('orientationchange',q,{passive:true});
  new MutationObserver(q).observe(document.body,{attributes:true,attributeFilter:['class']});
  if(window.ResizeObserver)new ResizeObserver(q).observe(dsky);
  q();if(window.AGCDSKY)window.AGCDSKY.syncSpacecraftPanel=syncPanel;
})();
