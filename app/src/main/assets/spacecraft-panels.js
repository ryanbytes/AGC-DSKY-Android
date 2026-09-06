'use strict';

/*
 * Spacecraft-specific DSKY installation scenes.
 *
 * CM geometry is reconstructed from the Apollo Operations Handbook Block II
 * Main Display Console, Figure 3-1 sheet 3 of 7: the DSKY is on Panel 2 with
 * the FDAI/flight instruments to its left, CSM/LM/telemetry controls above,
 * RCS/propellant controls to the right, and abort/launch-vehicle controls below.
 *
 * LM geometry is reconstructed around LM Panel 4 from LMA790-2/LMA790-3.  Panel
 * 4 is the DSKY, centered between the CDR and LMP and above the forward hatch;
 * Panels 1 and 2 are above it and Panel 3 is adjacent below the main panels.
 * The scene targets the Apollo-11-era LM-5 arrangement used with Luminary 099.
 *
 * The shared DSKY remains a separate 320 x 372 element.  Each scene contains a
 * 320 x 372 registration aperture.  syncPanel() scales a scene from that exact
 * aperture, so phone aspect ratio only changes the crop; it never stretches or
 * relocates the physical DSKY relative to the surrounding panel artwork.
 */
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const app = document.getElementById('app');
  const dsky = document.getElementById('dsky');
  if (!app || !dsky || document.getElementById('spacecraft-panel')) return;

  const screw = (x,y,r=5) => `
    <g transform="translate(${x} ${y})">
      <circle class="screw" r="${r}"/><line class="screw-slot" x1="-${r*.62}" y1="0" x2="${r*.62}" y2="0" transform="rotate(-18)"/>
    </g>`;

  const toggle = (x,y,labelTop='',labelBottom='') => `
    <g transform="translate(${x} ${y})">
      <circle class="toggle-base" r="8"/><line class="toggle-stem" x1="0" y1="1" x2="0" y2="-16"/>
      ${labelTop?`<text class="panel-label panel-micro" y="-25">${labelTop}</text>`:''}
      ${labelBottom?`<text class="panel-label panel-micro" y="24">${labelBottom}</text>`:''}
    </g>`;

  const guardedToggle = (x,y,label) => `
    <g transform="translate(${x} ${y})">
      <rect class="guard" x="-16" y="-25" width="32" height="46" rx="3"/>
      <circle class="toggle-base" r="7"/><line class="toggle-stem" x1="0" y1="1" x2="0" y2="-14"/>
      <text class="panel-label panel-micro" y="34">${label}</text>
    </g>`;

  const meter = (x,y,r,label,value='') => {
    const ticks = Array.from({length:11},(_,i)=>{
      const a=(-130+i*26)*Math.PI/180;
      const x1=(r*.70*Math.cos(a)).toFixed(2),y1=(r*.70*Math.sin(a)).toFixed(2);
      const x2=(r*.88*Math.cos(a)).toFixed(2),y2=(r*.88*Math.sin(a)).toFixed(2);
      return `<line class="meter-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }).join('');
    return `<g transform="translate(${x} ${y})"><circle class="meter-face" r="${r}"/><circle class="meter-ring" r="${r-4}"/>${ticks}<line class="meter-pointer" x1="0" y1="4" x2="${r*.48}" y2="-${r*.40}"/><circle fill="#262925" r="5"/><text class="panel-label panel-small" y="${r+16}">${label}</text>${value?`<text fill="#1d201d" font-family="monospace" font-size="11" text-anchor="middle" y="8">${value}</text>`:''}</g>`;
  };

  const indicator = (x,y,w,h,text,kind='off') => `
    <g transform="translate(${x} ${y})"><rect class="indicator-${kind}" x="0" y="0" width="${w}" height="${h}" rx="2"/><text class="panel-label panel-micro" x="${w/2}" y="${h/2+2.3}">${text}</text></g>`;

  const bank = (x,y,title,labels,cols=4,dx=46,dy=54) => {
    let out=`<g transform="translate(${x} ${y})"><rect class="cm-subplate" x="0" y="0" width="${cols*dx+18}" height="${Math.ceil(labels.length/cols)*dy+36}" rx="5"/><text class="panel-label panel-small" x="${(cols*dx+18)/2}" y="16">${title}</text>`;
    labels.forEach((lab,i)=>{const cx=18+(i%cols)*dx+dx/2,cy=30+Math.floor(i/cols)*dy+22;out+=toggle(cx,cy,'',lab)});
    return out+'</g>';
  };

  function cmSvg(){
    /* Scene coordinates: DSKY aperture x=490,y=300,w=320,h=372. */
    const switchesTop=['UP TLM','CM DCS','ACCEPT','BLOCK'];
    const rcs=['A PRIM','A SEC','B PRIM','B SEC','C PRIM','C SEC','D PRIM','D SEC'];
    return `
    <svg class="cm-scene" viewBox="0 0 1360 980" role="presentation">
      <defs>
        <linearGradient id="cmMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#777d76"/><stop offset=".5" stop-color="#5d625d"/><stop offset="1" stop-color="#4c514c"/></linearGradient>
        <filter id="cmGrain"><feTurbulence type="fractalNoise" baseFrequency=".18" numOctaves="2" seed="11" result="n"/><feColorMatrix in="n" values="1 0 0 0 .45  0 1 0 0 .45  0 0 1 0 .42  0 0 0 .055 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
      </defs>
      <path d="M30 28 H1325 V930 H30 Z" fill="url(#cmMetal)" stroke="#181b18" stroke-width="10" filter="url(#cmGrain)"/>
      <path class="seam" d="M50 55 H1310 M50 908 H1310 M462 55 V908 M835 55 V908" opacity=".5"/>
      <text class="panel-label panel-small" x="680" y="48">COMMAND MODULE — MAIN DISPLAY CONSOLE / PANEL 2</text>

      <!-- Flight director/attitude instrumentation immediately to the left of the DSKY zone. -->
      <g>
        <rect class="cm-subplate" x="115" y="145" width="325" height="440" rx="8"/>
        <text class="panel-label panel-small" x="278" y="170">FLIGHT / GUIDANCE</text>
        ${meter(278,300,112,'FDAI')}
        ${meter(190,495,52,'ROLL RATE')}
        ${meter(362,495,52,'YAW RATE')}
        <rect class="cm-black" x="132" y="545" width="292" height="28" rx="3"/><text class="panel-label panel-tiny" x="278" y="563">ATT SET — ROLL / PITCH / YAW</text>
      </g>

      <!-- CSM/LM telemetry and guidance controls that sit above the MDC DSKY on Sheet 3. -->
      <g>
        <rect class="cm-subplate" x="475" y="105" width="355" height="155" rx="7"/>
        <text class="panel-label panel-small" x="652" y="126">CMC / UPLINK</text>
        ${switchesTop.map((s,i)=>guardedToggle(515+i*82,184,s)).join('')}
        ${indicator(493,136,58,22,'UPLINK','off')}
        ${indicator(562,136,58,22,'COMP','off')}
        <text class="panel-label panel-micro" x="738" y="149">UP TELEMETRY</text>
      </g>

      <!-- DSKY registration aperture; actual DSKY element overlays this exact 320x372 rectangle. -->
      <rect x="482" y="292" width="336" height="388" rx="5" fill="#171917" stroke="#0a0b0a" stroke-width="8"/>
      <rect x="490" y="300" width="320" height="372" fill="#111311"/>

      <!-- Propulsion/RCS management to the right of the DSKY, matching Sheet 3 grouping. -->
      <g>
        <rect class="cm-subplate" x="850" y="100" width="430" height="585" rx="8"/>
        <text class="panel-label panel-small" x="1065" y="124">RCS / PROPELLANT MANAGEMENT</text>
        ${meter(935,210,58,'SM RCS He','1')}
        ${meter(1070,210,58,'SM RCS He','2')}
        ${meter(1205,210,58,'PRPLNT QTY')}
        <rect class="cm-black" x="880" y="290" width="370" height="36" rx="3"/><text class="panel-label panel-tiny" x="1065" y="313">CM RCS PRPLNT — OPEN / CLOSE / TRANSFER</text>
        ${rcs.map((s,i)=>toggle(900+(i%4)*105,372+Math.floor(i/4)*92,'',s)).join('')}
        <rect class="cm-black" x="880" y="545" width="370" height="30" rx="3"/><text class="panel-label panel-tiny" x="1065" y="565">SM RCS HEATERS — PRIM / SEC</text>
        ${['A','B','C','D'].map((s,i)=>guardedToggle(920+i*102,625,s)).join('')}
      </g>

      <!-- Abort/launch vehicle controls below the DSKY on Panel 2. -->
      <g>
        <rect class="cm-subplate" x="300" y="705" width="675" height="180" rx="8"/>
        <text class="panel-label panel-small" x="638" y="728">ABORT SYSTEM / LAUNCH VEHICLE</text>
        ${indicator(328,744,92,34,'ABORT','red')}
        ${guardedToggle(468,800,'LV RATES')}
        ${guardedToggle(555,800,'TWR JETT')}
        ${guardedToggle(642,800,'PRPLNT DUMP')}
        ${guardedToggle(729,800,'ENG AUTO')}
        ${guardedToggle(816,800,'RCS CMD')}
        ${guardedToggle(903,800,'MAIN RELEASE')}
      </g>

      <!-- Panel fasteners. -->
      ${[[65,72],[445,72],[840,72],[1300,72],[65,900],[445,900],[840,900],[1300,900],[470,280],[830,280],[470,692],[830,692]].map(p=>screw(...p)).join('')}
    </svg>`;
  }

  function lmSwitchBank(x,y,title,labels,cols=4){
    const dx=58,dy=62,w=cols*dx+24,h=Math.ceil(labels.length/cols)*dy+40;
    let out=`<g transform="translate(${x} ${y})"><rect class="lm-subplate" x="0" y="0" width="${w}" height="${h}" rx="5"/><text class="panel-label panel-small" x="${w/2}" y="18">${title}</text>`;
    labels.forEach((lab,i)=>{out+=toggle(18+(i%cols)*dx+dx/2,38+Math.floor(i/cols)*dy+22,'',lab)});
    return out+'</g>';
  }

  function lmSvg(){
    /* Scene coordinates: LM Panel 4 / DSKY aperture x=400,y=515,w=320,h=372. */
    return `
    <svg class="lm-scene" viewBox="0 0 1120 1220" role="presentation">
      <defs>
        <linearGradient id="lmMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#666d68"/><stop offset=".55" stop-color="#4c524f"/><stop offset="1" stop-color="#3d433f"/></linearGradient>
        <filter id="lmGrain"><feTurbulence type="fractalNoise" baseFrequency=".22" numOctaves="2" seed="5" result="n"/><feColorMatrix in="n" values="1 0 0 0 .4  0 1 0 0 .4  0 0 1 0 .38  0 0 0 .05 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
      </defs>
      <path d="M25 25 H1095 V1185 H25 Z" fill="url(#lmMetal)" stroke="#151815" stroke-width="10" filter="url(#lmGrain)"/>
      <text class="panel-label panel-small" x="560" y="49">LUNAR MODULE — FORWARD COCKPIT / LM-5 CONFIGURATION</text>

      <!-- Commander Panel 1 above/left of Panel 4. -->
      <g>
        <rect class="lm-subplate" x="55" y="75" width="485" height="400" rx="7"/>
        <text class="panel-label panel-small" x="298" y="96">PANEL 1 — COMMANDER</text>
        ${indicator(78,112,95,36,'MASTER ALARM','red')}
        ${meter(255,255,118,'FDAI')}
        <g transform="translate(405 160)"><rect class="tape-window" x="0" y="0" width="78" height="190" rx="4"/><line x1="39" y1="8" x2="39" y2="182" stroke="#282b27" stroke-width="1"/>${Array.from({length:9},(_,i)=>`<line x1="12" y1="${20+i*19}" x2="66" y2="${20+i*19}" stroke="#2c2f2b" stroke-width="1"/>`).join('')}<text fill="#1d201d" font-size="10" text-anchor="middle" x="39" y="104">ALT / RANGE</text></g>
        ${meter(112,380,46,'T/W')}
        ${guardedToggle(213,397,'GUID CONT')}
        ${guardedToggle(306,397,'MODE SEL')}
        ${guardedToggle(399,397,'RNG/ALT MON')}
      </g>

      <!-- LM Pilot Panel 2 above/right.  The symmetric flight station is real;
           labels differ where AGS/PGNS responsibility differs. -->
      <g>
        <rect class="lm-subplate" x="580" y="75" width="485" height="400" rx="7"/>
        <text class="panel-label panel-small" x="822" y="96">PANEL 2 — LM PILOT</text>
        ${indicator(947,112,95,36,'MASTER ALARM','red')}
        ${meter(865,255,118,'FDAI')}
        <g transform="translate(625 160)"><rect class="tape-window" x="0" y="0" width="78" height="190" rx="4"/>${Array.from({length:9},(_,i)=>`<line x1="12" y1="${20+i*19}" x2="66" y2="${20+i*19}" stroke="#2c2f2b" stroke-width="1"/>`).join('')}<text fill="#1d201d" font-size="10" text-anchor="middle" x="39" y="104">ALT / RATE</text></g>
        ${guardedToggle(684,397,'ATT MON')}
        ${guardedToggle(777,397,'RATE/ERR')}
        ${guardedToggle(963,397,'MODE CONT')}
      </g>

      <!-- Narrow utility-lighting strip between the two main panels. -->
      <g><rect class="lm-black" x="530" y="105" width="60" height="335" rx="4"/><text class="panel-label panel-micro" x="560" y="130">UTILITY</text><text class="panel-label panel-micro" x="560" y="141">LIGHTING</text>${toggle(560,205,'','FLOOD')}${toggle(560,285,'','ANUN')}${toggle(560,365,'','INTEG')}</g>

      <!-- Panel 3 beside the DSKY: radar/heater/lighting controls. -->
      ${lmSwitchBank(60,515,'PANEL 3 — RADAR / HEATERS',['RR MODE','LR ANT','RR HEAT','LR HEAT','SIDE LTS','DOCK LTS','TRACK LT','LAMP/TONE'],2)}

      <!-- Panel 4 registration aperture. -->
      <g><rect class="lm-subplate" x="382" y="495" width="356" height="410" rx="8"/><text class="panel-label panel-small" x="560" y="512">PANEL 4 — LGC DISPLAY & KEYBOARD</text><rect x="392" y="507" width="336" height="388" rx="5" fill="#171a17" stroke="#090b09" stroke-width="7"/><rect x="400" y="515" width="320" height="372" fill="#111311"/></g>

      <!-- Right-side central controls near the hatch/Panel 4 boundary. -->
      <g><rect class="lm-subplate" x="765" y="515" width="295" height="372" rx="7"/><text class="panel-label panel-small" x="912" y="537">ENGINE / GUIDANCE</text>${guardedToggle(820,610,'ENG ARM')}${guardedToggle(912,610,'THR CONT')}${guardedToggle(1004,610,'BAL CPL')}${indicator(812,682,86,38,'ABORT','red')}${indicator(926,682,106,38,'ABORT STAGE','red')}${guardedToggle(820,790,'ASC He REG')}${guardedToggle(912,790,'DESC He REG')}${guardedToggle(1004,790,'ACA PROP')}</g>

      <!-- Forward hatch directly below center panels/DSKY. -->
      <g><path class="hatch" d="M250 1020 Q250 920 350 920 H770 Q870 920 870 1020 V1180 H250 Z"/><path class="hatch-inner" d="M292 1030 Q292 965 360 965 H760 Q828 965 828 1030 V1180 H292 Z"/><text class="panel-label panel-small" x="560" y="950">FORWARD HATCH</text><rect x="515" y="1000" width="90" height="25" rx="4" fill="#adb1a8" stroke="#20231f" stroke-width="2"/></g>

      ${[[48,58],[555,58],[1072,58],[48,485],[370,485],[750,485],[1072,485],[48,910],[370,910],[750,910],[1072,910]].map(p=>screw(...p)).join('')}
    </svg>`;
  }

  const panel = document.createElement('div');
  panel.id = 'spacecraft-panel';
  panel.setAttribute('aria-hidden','true');
  panel.innerHTML = cmSvg() + lmSvg();
  app.insertBefore(panel, dsky);

  const spec = {
    cm:{w:1360,h:980,x:490,y:300},
    lm:{w:1120,h:1220,x:400,y:515}
  };

  function currentSpec(){return document.body.classList.contains('spacecraft-lm')?spec.lm:spec.cm}

  function syncPanel(){
    if (document.body.classList.contains('dream') || document.body.classList.contains('screen-only') || document.body.classList.contains('display-only')) return;
    const r=dsky.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s=currentSpec(),scale=r.width/320;
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
  if (window.ResizeObserver) new ResizeObserver(queueSync).observe(dsky);
  queueSync();

  if (window.AGCDSKY) window.AGCDSKY.syncSpacecraftPanel=syncPanel;
})();
