'use strict';

// Keep spacecraft installation artwork coupled to the selected AGC rope.
// CM/Comanche and LM/Luminary deliberately use separate body classes so their
// surrounding cockpit panels can be reconstructed independently from primary
// source drawings without touching the shared Block II DSKY geometry.
(() => {
  function applySpacecraftPanelMode() {
    let mission = 'comanche055';
    try {
      if (typeof selectedMission !== 'undefined') mission = selectedMission;
      else mission = localStorage.getItem('agcMission') || mission;
    } catch (_) {}

    document.body.classList.toggle('spacecraft-cm', mission === 'comanche055');
    document.body.classList.toggle('spacecraft-lm', mission === 'luminary099');
  }

  applySpacecraftPanelMode();

  if (typeof cycleMission === 'function') {
    const baseCycleMission = cycleMission;
    cycleMission = function spacecraftAwareCycleMission(...args) {
      const result = baseCycleMission.apply(this, args);
      applySpacecraftPanelMode();
      return result;
    };
  }

  if (window.AGCDSKY) {
    window.AGCDSKY.applySpacecraftPanelMode = applySpacecraftPanelMode;
  }

  // Hardware refinement for the spacecraft surrounds. Apollo LM toggle handles
  // were not generic line icons: NASA TN D-6722 describes AT/LS sealed toggle
  // switches fitted with small transparent self-luminous plastic switch tips.
  // Rebuild the generated toggle hardware after spacecraft-panels.js has created
  // the SVG scenes, preserving the panel layout and labels.
  const NS='http://www.w3.org/2000/svg';
  function svgEl(tag, attrs={}) {
    const n=document.createElementNS(NS,tag);
    for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,String(v));
    return n;
  }
  function addToggleDefs(svg) {
    const defs=svg.querySelector('defs') || svg.insertBefore(svgEl('defs'),svg.firstChild);
    if (defs.querySelector('#apolloToggleNut')) return;
    defs.insertAdjacentHTML('beforeend', `
      <linearGradient id="apolloToggleNut" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6d9d1"/><stop offset=".24" stop-color="#777c75"/><stop offset=".55" stop-color="#c7cbc3"/><stop offset="1" stop-color="#4b504b"/></linearGradient>
      <radialGradient id="apolloToggleBushing" cx="35%" cy="28%" r="75%"><stop offset="0" stop-color="#a9aea6"/><stop offset=".52" stop-color="#626861"/><stop offset="1" stop-color="#242824"/></radialGradient>
      <linearGradient id="apolloToggleStem" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#666b65"/><stop offset=".48" stop-color="#e4e7e0"/><stop offset="1" stop-color="#777d76"/></linearGradient>
      <linearGradient id="apolloToggleTip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0f1e5" stop-opacity=".94"/><stop offset=".42" stop-color="#c2c8b8" stop-opacity=".95"/><stop offset="1" stop-color="#777d73" stop-opacity=".98"/></linearGradient>`);
  }
  function refineToggle(g) {
    if (g.dataset.apolloHardware==='1') return;
    const oldStick=g.querySelector('.p-toggle-stick');
    const x2=oldStick ? parseFloat(oldStick.getAttribute('x2')||'0') : 0;
    const y2=oldStick ? parseFloat(oldStick.getAttribute('y2')||'-14') : -14;
    let angle=0;
    if (y2>2) angle=180; else if (x2<-2) angle=-36; else if (x2>2) angle=36;
    g.querySelectorAll('.p-toggle-shadow,.p-toggle-ring-outer,.p-toggle-ring,.p-toggle-base,.p-toggle-stick-shadow,.p-toggle-stick,.p-toggle-tip-shadow,.p-toggle-tip').forEach(n=>n.remove());

    const hw=svgEl('g',{'class':'apollo-toggle-hardware'});
    hw.appendChild(svgEl('ellipse',{'class':'apollo-toggle-shadow',cx:1.4,cy:3.1,rx:9.2,ry:6.4}));
    hw.appendChild(svgEl('polygon',{'class':'apollo-toggle-nut-shadow',points:'-7.6,-4.1 -3.9,-7.2 4.2,-7.0 7.7,-3.6 7.3,4.0 3.8,7.0 -4.0,7.1 -7.5,3.7',transform:'translate(1 1.2)'}));
    hw.appendChild(svgEl('polygon',{'class':'apollo-toggle-nut',points:'-7.6,-4.1 -3.9,-7.2 4.2,-7.0 7.7,-3.6 7.3,4.0 3.8,7.0 -4.0,7.1 -7.5,3.7'}));
    hw.appendChild(svgEl('circle',{'class':'apollo-toggle-bushing',r:5.1}));
    hw.appendChild(svgEl('circle',{'class':'apollo-toggle-hole',r:2.75}));

    const handle=svgEl('g',{'class':'apollo-toggle-handle',transform:`rotate(${angle})`});
    handle.appendChild(svgEl('line',{'class':'apollo-toggle-stem-shadow',x1:.8,y1:0,x2:.8,y2:-10.8}));
    handle.appendChild(svgEl('line',{'class':'apollo-toggle-stem',x1:0,y1:0,x2:0,y2:-11.2}));
    handle.appendChild(svgEl('rect',{'class':'apollo-toggle-tip-shadow',x:-3.1,y:-21,width:6.8,height:12.6,rx:2.8,transform:'translate(1 1.2)'}));
    handle.appendChild(svgEl('rect',{'class':'apollo-toggle-tip',x:-3.1,y:-21,width:6.2,height:12.2,rx:2.6}));
    handle.appendChild(svgEl('rect',{'class':'apollo-toggle-tip-core',x:-1.25,y:-19,width:2.5,height:7.6,rx:1.15}));
    handle.appendChild(svgEl('line',{'class':'apollo-toggle-tip-glint',x1:-1.8,y1:-18.8,x2:-1.8,y2:-12.2}));
    hw.appendChild(handle);
    g.insertBefore(hw,g.firstChild);
    g.dataset.apolloHardware='1';
  }
  function refineSpacecraftHardware() {
    const panel=document.getElementById('spacecraft-panel');
    if (!panel) return false;
    panel.querySelectorAll('svg').forEach(addToggleDefs);
    panel.querySelectorAll('.p-toggle').forEach(refineToggle);

    // The dashed/boxed emphasis in LM guidance drawings is annotation, not a
    // physical wire guard around the ACA/4-JET or TTCA/TRANSL switches.
    panel.querySelectorAll('.lm-scene .p-guarded').forEach(g=>{
      const t=(g.textContent||'').replace(/\s+/g,' ');
      if (/ACA\/4 JET|TTCA\/TRANSL/.test(t)) {
        g.querySelectorAll('.p-wireguard,.p-wireguard-shadow,.p-redguard,.p-redguard-shadow').forEach(n=>n.remove());
      }
    });

    if (!document.getElementById('apollo-toggle-style')) {
      const st=document.createElement('style');st.id='apollo-toggle-style';st.textContent=`
        #spacecraft-panel .apollo-toggle-shadow{fill:#060806;opacity:.72}
        #spacecraft-panel .apollo-toggle-nut-shadow{fill:#070907;opacity:.7}
        #spacecraft-panel .apollo-toggle-nut{fill:url(#apolloToggleNut);stroke:#171a17;stroke-width:.85}
        #spacecraft-panel .apollo-toggle-bushing{fill:url(#apolloToggleBushing);stroke:#111411;stroke-width:.95}
        #spacecraft-panel .apollo-toggle-hole{fill:#111411;stroke:#555b55;stroke-width:.55}
        #spacecraft-panel .apollo-toggle-stem-shadow{stroke:#050705;stroke-width:4.7;stroke-linecap:round;opacity:.75}
        #spacecraft-panel .apollo-toggle-stem{stroke:url(#apolloToggleStem);stroke-width:2.65;stroke-linecap:round}
        #spacecraft-panel .apollo-toggle-tip-shadow{fill:#050705;opacity:.58}
        #spacecraft-panel .apollo-toggle-tip{fill:url(#apolloToggleTip);stroke:#858b82;stroke-width:.55;filter:drop-shadow(0 0 .55px rgba(221,233,207,.3))}
        #spacecraft-panel .apollo-toggle-tip-core{fill:#d2d9c2;opacity:.5}
        #spacecraft-panel .apollo-toggle-tip-glint{stroke:#f5f7ef;stroke-width:.7;stroke-linecap:round;opacity:.58}
      `;document.head.appendChild(st);
    }
    return true;
  }
  let tries=0;
  const waitForPanels=()=>{if(refineSpacecraftHardware()||tries++>8)return;requestAnimationFrame(waitForPanels)};
  setTimeout(waitForPanels,0);
})();
