'use strict';

/*
 * Spacecraft-specific DSKY installation scenes.
 *
 * CM: Apollo Operations Handbook Block II, Main Display Console Panel 2.
 * Panel 2B = FDAI No. 2, 2C = CMC DSKY, 2D = abort/boost/entry controls,
 * 2E = RCS management, 2F = ECS/cryogenic management, 2A = caution/warning,
 * docking and mission-timer controls.
 *
 * LM: LMA790-2/LMA790-3. Panels 1 and 2 are the two eye-level main panels;
 * Panel 3 immediately below them spans both, and Panel 4 is centered below
 * Panel 3 above the forward hatch. Panel 4 carries the LGC/DSKY plus the
 * CDR/LMP ACA/4-JET and TTCA/TRANSL controls. Panel 5 (CDR) and Panel 6 (LMP)
 * flank the lower center area.
 *
 * The existing Block II DSKY remains a separate exact 320 x 372 element. Each
 * scene has a 320 x 372 registration rectangle. Scaling is derived only from
 * that rectangle, so rotation/aspect ratio changes crop the cockpit scene but
 * never stretch or move the DSKY relative to its spacecraft panel.
 */
(() => {
  const app = document.getElementById('app');
  const dsky = document.getElementById('dsky');
  if (!app || !dsky || document.getElementById('spacecraft-panel')) return;

  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const label = (x,y,text,cls='panel-micro') => `<text class="panel-label ${cls}" x="${x}" y="${y}">${esc(text)}</text>`;

  const screw = (x,y,r=5) => `
    <g transform="translate(${x} ${y})">
      <circle class="screw" r="${r}"/>
      <line class="screw-slot" x1="-${(r*.62).toFixed(2)}" y1="0" x2="${(r*.62).toFixed(2)}" y2="0" transform="rotate(-18)"/>
    </g>`;

  const toggle = (x,y,top='',bottom='') => `
    <g transform="translate(${x} ${y})">
      <circle class="toggle-base" r="8"/>
      <line class="toggle-stem" x1="0" y1="1" x2="0" y2="-16"/>
      ${top?label(0,-25,top):''}
      ${bottom?label(0,25,bottom):''}
    </g>`;

  const guardedToggle = (x,y,text) => `
    <g transform="translate(${x} ${y})">
      <rect class="guard" x="-16" y="-25" width="32" height="46" rx="3"/>
      <circle class="toggle-base" r="7"/>
      <line class="toggle-stem" x1="0" y1="1" x2="0" y2="-14"/>
      ${label(0,34,text)}
    </g>`;

  const push = (x,y,w,h,text,kind='off') => `
    <g transform="translate(${x} ${y})">
      <rect class="indicator-${kind}" width="${w}" height="${h}" rx="2"/>
      ${label(w/2,h/2+2.4,text)}
    </g>`;

  const talkback = (x,y,text,open=false) => `
    <g transform="translate(${x} ${y})">
      <rect x="-15" y="-7" width="30" height="14" rx="2" fill="${open?'#aaa99f':'#272a27'}" stroke="#111311" stroke-width="1.4"/>
      ${!open?'<path d="M-13 -5 L-6 5 M-5 -5 L2 5 M3 -5 L10 5" stroke="#b8bbb1" stroke-width="2"/>':''}
      ${text?label(0,20,text):''}
    </g>`;

  const meter = (x,y,r,text) => {
    const ticks = Array.from({length:13},(_,i)=>{
      const a=(-132+i*22)*Math.PI/180;
      const x1=(r*.72*Math.cos(a)).toFixed(2), y1=(r*.72*Math.sin(a)).toFixed(2);
      const x2=(r*.88*Math.cos(a)).toFixed(2), y2=(r*.88*Math.sin(a)).toFixed(2);
      return `<line class="meter-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }).join('');
    return `<g transform="translate(${x} ${y})"><circle class="meter-face" r="${r}"/><circle class="meter-ring" r="${r-4}"/>${ticks}<line class="meter-pointer" x1="0" y1="4" x2="${(r*.47).toFixed(1)}" y2="-${(r*.39).toFixed(1)}"/><circle fill="#252825" r="5"/>${label(0,r+17,text,'panel-tiny')}</g>`;
  };

  const digital = (x,y,w,h,text='888:88') => `<g transform="translate(${x} ${y})"><rect class="cm-black" width="${w}" height="${h}" rx="3"/><text x="${w/2}" y="${h*.70}" class="panel-label panel-num">${esc(text)}</text></g>`;

  function cmSvg(){
    // Registration aperture: x=505, y=300, width=320, height=372.
    const cw = [
      'BMAG 1','BMAG 2','PITCH GMBL','YAW GMBL','CM RCS 1','CM RCS 2',
      'SM RCS A','SM RCS B','SM RCS C','SM RCS D','CRYO PRESS','CO2 PP HI',
      'GLYCOL TEMP','SPS TEMP','CMC','ISS','FC 1','FC 2','FC 3','AC BUS'
    ];
    const cwGrid = cw.map((s,i)=>push(62+(i%5)*64,94+Math.floor(i/5)*28,58,20,s,(s==='CMC'||s==='ISS')?'red':'amber')).join('');
    const helium = ['A1','A2','B1','B2','C1','C2','D1','D2'];
    return `
    <svg class="cm-scene" viewBox="0 0 1640 1030" role="presentation">
      <defs>
        <linearGradient id="cmMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#777d76"/><stop offset=".5" stop-color="#5d625d"/><stop offset="1" stop-color="#474c47"/></linearGradient>
        <filter id="cmGrain"><feTurbulence type="fractalNoise" baseFrequency=".17" numOctaves="2" seed="11" result="n"/><feColorMatrix in="n" values="1 0 0 0 .45 0 1 0 0 .45 0 0 1 0 .42 0 0 0 .045 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
      </defs>
      <path d="M24 24 H1616 V1006 H24 Z" fill="url(#cmMetal)" stroke="#171a17" stroke-width="10" filter="url(#cmGrain)"/>
      <path class="seam" d="M45 48H1595 M45 990H1595 M430 48V990 M850 48V990 M1320 48V990" opacity=".42"/>

      <!-- PANEL 2A: caution/warning, docking probe and mission timer. -->
      <g>
        <rect class="cm-subplate" x="45" y="62" width="350" height="250" rx="7"/>
        ${label(220,82,'PANEL 2A — CAUTION / WARNING','panel-small')}
        ${cwGrid}
        ${digital(60,222,128,42,'000:00')}
        ${toggle(225,247,'MSN TIMER','START')}${toggle(285,247,'C/W','NORMAL')}${toggle(345,247,'LM PWR','OFF')}
      </g>

      <!-- PANEL 2B: second FDAI. -->
      <g>
        <rect class="cm-subplate" x="65" y="335" width="360" height="445" rx="8"/>
        ${label(245,357,'PANEL 2B — FDAI NO. 2','panel-small')}
        ${meter(245,525,124,'FDAI')}
        ${meter(145,705,50,'RATE')}${meter(345,705,50,'ERROR')}
      </g>

      <!-- PANEL 2C: exact DSKY aperture. -->
      <g>
        <rect class="cm-subplate" x="487" y="280" width="356" height="410" rx="8"/>
        ${label(665,297,'PANEL 2C — CMC DISPLAY & KEYBOARD','panel-small')}
        <rect x="497" y="292" width="336" height="388" rx="5" fill="#171917" stroke="#090a09" stroke-width="7"/>
        <rect x="505" y="300" width="320" height="372" fill="#111311"/>
      </g>

      <!-- PANEL 2D: abort / boost / entry key switches. -->
      <g>
        <rect class="cm-subplate" x="455" y="720" width="420" height="245" rx="8"/>
        ${label(665,742,'PANEL 2D — ABORT / BOOST / ENTRY','panel-small')}
        ${guardedToggle(495,800,'EDS AUTO')}${guardedToggle(565,800,'CSM/LM SEP')}${guardedToggle(635,800,'CM/SM SEP')}${guardedToggle(705,800,'S-IVB/LM')}${guardedToggle(775,800,'TWR JETT')}${guardedToggle(845,800,'MAIN RELEASE')}
        ${toggle(505,900,'ABORT','PRPLNT')}${toggle(585,900,'2 ENG','OUT')}${toggle(665,900,'LV','RATES')}${toggle(745,900,'GUIDANCE','IU/CMC')}${toggle(825,900,'XLUNAR','INHIBIT')}
      </g>

      <!-- PANEL 2E: RCS management. -->
      <g>
        <rect class="cm-subplate" x="885" y="72" width="430" height="660" rx="8"/>
        ${label(1100,94,'PANEL 2E — RCS MANAGEMENT','panel-small')}
        ${meter(940,185,48,'TEMP PKG')}${meter(1045,185,48,'He PRESS')}${meter(1150,185,48,'SEC FUEL')}${meter(1255,185,48,'PRPLNT QTY')}
        ${label(1100,262,'SM RCS HELIUM 1 / 2','panel-tiny')}
        ${helium.map((s,i)=>`${talkback(925+(i%4)*100,298+Math.floor(i/4)*76,'')}${toggle(925+(i%4)*100,330+Math.floor(i/4)*76,'',s)}`).join('')}
        ${label(1100,490,'SM RCS PRPLNT','panel-tiny')}
        ${['A','B','C','D'].map((s,i)=>`${talkback(945+i*103,520,'')}${toggle(945+i*103,553,'',s)}`).join('')}
        ${label(1015,623,'CM RCS PRPLNT','panel-tiny')}${talkback(975,650,'SYS 1')}${talkback(1055,650,'SYS 2')}
        ${toggle(1190,650,'RCS IND','SM/CM')}${toggle(1270,650,'RCS CMD','ON')}
      </g>

      <!-- PANEL 2F: ECS / cryogenic management. -->
      <g>
        <rect class="cm-subplate" x="1340" y="72" width="260" height="660" rx="8"/>
        ${label(1470,94,'PANEL 2F — ECS','panel-small')}
        ${meter(1400,175,44,'H2 PRESS')}${meter(1540,175,44,'O2 PRESS')}${meter(1400,285,44,'H2 QTY')}${meter(1540,285,44,'O2 QTY')}
        ${toggle(1390,385,'CABIN FAN','1')}${toggle(1465,385,'CABIN FAN','2')}${toggle(1540,385,'ECS IND','PRI/SEC')}
        ${toggle(1390,480,'H2 HTR','1')}${toggle(1465,480,'H2 HTR','2')}${toggle(1540,480,'O2 HTR','1/2')}
        ${toggle(1390,575,'H2 FAN','1')}${toggle(1465,575,'H2 FAN','2')}${toggle(1540,575,'O2 FAN','1/2')}
        ${meter(1410,680,38,'SUIT')}${meter(1525,680,38,'CABIN')}
      </g>

      ${[[50,50],[420,50],[875,50],[1325,50],[1600,50],[50,990],[420,990],[875,990],[1325,990],[1600,990],[470,270],[850,270],[470,700],[850,700]].map(p=>screw(...p)).join('')}
    </svg>`;
  }

  const lmBank = (x,y,w,h,title,items,cols=6) => {
    const dx=(w-24)/cols, rows=Math.ceil(items.length/cols), dy=(h-40)/Math.max(1,rows);
    return `<g><rect class="lm-subplate" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>${label(x+w/2,y+18,title,'panel-small')}${items.map((s,i)=>toggle(x+12+(i%cols)*dx+dx/2,y+34+Math.floor(i/cols)*dy+dy/2,'',s)).join('')}</g>`;
  };

  function lmSvg(){
    // Registration aperture: x=430, y=690, width=320, height=372.
    return `
    <svg class="lm-scene" viewBox="0 0 1180 1400" role="presentation">
      <defs>
        <linearGradient id="lmMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#69706a"/><stop offset=".55" stop-color="#4d534f"/><stop offset="1" stop-color="#3b413d"/></linearGradient>
        <filter id="lmGrain"><feTurbulence type="fractalNoise" baseFrequency=".21" numOctaves="2" seed="5" result="n"/><feColorMatrix in="n" values="1 0 0 0 .4 0 1 0 0 .4 0 0 1 0 .38 0 0 0 .045 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
      </defs>
      <path d="M22 22 H1158 V1378 H22 Z" fill="url(#lmMetal)" stroke="#151815" stroke-width="10" filter="url(#lmGrain)"/>

      <!-- PANEL 1: Commander, eye-level. -->
      <g>
        <rect class="lm-subplate" x="55" y="60" width="505" height="410" rx="8"/>
        ${label(307,82,'PANEL 1 — COMMANDER','panel-small')}
        ${push(78,102,92,34,'MASTER ALARM','red')}
        ${digital(185,102,105,40,'000:00')}${digital(310,102,105,40,'000:00')}
        ${meter(285,275,112,'FDAI')}
        ${meter(105,270,46,'THRUST')}${meter(470,270,46,'PRPLNT')}
        ${meter(105,390,42,'T/W')}${meter(470,390,42,'ALT/RANGE')}
        ${guardedToggle(190,410,'GUID CONT')}${guardedToggle(285,410,'MODE SEL')}${guardedToggle(380,410,'RNG/ALT MON')}
      </g>

      <!-- PANEL 2: LM Pilot, eye-level. -->
      <g>
        <rect class="lm-subplate" x="620" y="60" width="505" height="410" rx="8"/>
        ${label(872,82,'PANEL 2 — LM PILOT','panel-small')}
        ${push(1010,102,92,34,'MASTER ALARM','red')}
        ${meter(880,275,112,'FDAI')}
        ${meter(695,220,45,'RCS A')}${meter(1060,220,45,'RCS B')}
        ${meter(695,360,45,'SUIT/CABIN')}${meter(1060,360,45,'ECS')}
        ${guardedToggle(765,410,'ATT MON')}${guardedToggle(865,410,'RATE/ERR')}${guardedToggle(965,410,'MODE CONT')}
      </g>

      <!-- PANEL 3 spans the width immediately below Panels 1 and 2. -->
      ${lmBank(55,492,1070,155,'PANEL 3 — RADAR / STABILITY / ENGINE / EVENT TIMER / RCS / LIGHTING',[
        'RR MODE','RR SLEW','LR ANT','LR MODE','TEMP MON','ENG GMBL','DESC ENG','ASC ENG','GUID CONT','MODE CONT','ROLL','PITCH','YAW','RCS A/B','QUAD 1','QUAD 2','QUAD 3','QUAD 4','EVENT TMR','FLOOD','SIDE PNL','DOCK LTS','TRACK LT','LAMP/TONE'
      ],8)}

      <!-- PANEL 4: centered below Panel 3. DSKY plus controller-enable and inertial controls. -->
      <g>
        <rect class="lm-subplate" x="350" y="660" width="480" height="430" rx="9"/>
        ${label(590,680,'PANEL 4 — FLIGHT CONTROL / LGC','panel-small')}
        ${guardedToggle(382,760,'CDR ACA/4 JET')}${guardedToggle(382,855,'CDR TTCA/TRANSL')}
        ${guardedToggle(798,760,'LMP ACA/4 JET')}${guardedToggle(798,855,'LMP TTCA/TRANSL')}
        ${push(370,970,82,28,'LGC','off')}${push(728,970,82,28,'ISS','off')}
        <rect x="412" y="672" width="356" height="410" rx="7" fill="#171a17" stroke="#090b09" stroke-width="7"/>
        <rect x="422" y="682" width="336" height="388" rx="5" fill="#171a17" stroke="#090b09" stroke-width="5"/>
        <rect x="430" y="690" width="320" height="372" fill="#111311"/>
      </g>

      <!-- PANEL 5: CDR waist-level controls. -->
      <g>
        <rect class="lm-subplate" x="55" y="690" width="260" height="330" rx="7"/>
        ${label(185,712,'PANEL 5 — CDR','panel-small')}
        ${push(82,750,88,40,'ENGINE START','off')}${push(195,750,88,40,'ENGINE STOP','red')}
        ${push(118,825,130,40,'+X TRANSL','off')}
        ${toggle(105,910,'MISSION','TIMER')}${toggle(185,910,'FLOOD','LIGHTS')}${toggle(265,910,'TRACK','LIGHT')}
      </g>

      <!-- PANEL 6: LMP waist-level Abort Guidance controls. -->
      <g>
        <rect class="lm-subplate" x="865" y="690" width="260" height="330" rx="7"/>
        ${label(995,712,'PANEL 6 — ABORT GUIDANCE','panel-small')}
        ${digital(895,750,200,48,'00000')}
        ${push(890,825,92,38,'ABORT','red')}${push(1008,825,92,38,'ABORT STAGE','red')}
        ${toggle(910,925,'DEDA','READ OUT')}${toggle(995,925,'AGS','OPERATE')}${toggle(1080,925,'MODE','SELECT')}
      </g>

      <!-- Forward hatch immediately below the center panels. -->
      <g>
        <path class="hatch" d="M310 1390 V1230 Q310 1115 420 1115 H760 Q870 1115 870 1230 V1390 Z"/>
        <path class="hatch-inner" d="M350 1390 V1240 Q350 1160 430 1160 H750 Q830 1160 830 1240 V1390 Z"/>
        ${label(590,1142,'FORWARD HATCH','panel-small')}
        <rect x="545" y="1190" width="90" height="24" rx="4" fill="#aeb2a8" stroke="#1c201c" stroke-width="2"/>
      </g>

      ${[[45,45],[575,45],[1135,45],[45,480],[575,480],[1135,480],[45,1080],[340,1080],[840,1080],[1135,1080]].map(p=>screw(...p)).join('')}
    </svg>`;
  }

  const panel = document.createElement('div');
  panel.id = 'spacecraft-panel';
  panel.setAttribute('aria-hidden','true');
  panel.innerHTML = cmSvg() + lmSvg();
  app.insertBefore(panel,dsky);

  const specs = {
    cm:{w:1640,h:1030,x:505,y:300},
    lm:{w:1180,h:1400,x:430,y:690}
  };

  const currentSpec = () => document.body.classList.contains('spacecraft-lm') ? specs.lm : specs.cm;

  function syncPanel(){
    if (document.body.classList.contains('dream') || document.body.classList.contains('screen-only') || document.body.classList.contains('display-only')) return;
    const r=dsky.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s=currentSpec();
    const scale=r.width/320;
    panel.style.width=(s.w*scale)+'px';
    panel.style.height=(s.h*scale)+'px';
    panel.style.left=(r.left-s.x*scale)+'px';
    panel.style.top=(r.top-s.y*scale)+'px';
  }

  let frame=0;
  const queueSync=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(syncPanel)};
  window.addEventListener('resize',queueSync,{passive:true});
  window.addEventListener('orientationchange',queueSync,{passive:true});
  new MutationObserver(queueSync).observe(document.body,{attributes:true,attributeFilter:['class']});
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(queueSync);
    observer.observe(dsky);
  }
  queueSync();
  if (window.AGCDSKY) window.AGCDSKY.syncSpacecraftPanel=syncPanel;
})();
