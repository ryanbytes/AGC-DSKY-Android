'use strict';
(() => {
  const STORE='agcCheatChecksV1';
  const POS='agcCheatPosV2';
  let sheet, dragging=false, dragStart=null, pos={x:0,y:0};

  function markup(){
    return `
    <section id="agc-cheat-sheet" aria-label="AGC cheat sheet">
      <div class="cheat-head" id="cheat-drag">
        <span class="cheat-title">AGC QUICK SHEET</span>
        <div class="cheat-tabs">
          <button data-cheat-tab="p51" class="active">P51 TEST</button>
          <button data-cheat-tab="p51real">P51 REAL SKY</button>
          <button data-cheat-tab="quick">QUICK</button>
          <button data-cheat-tab="sxt">SXT</button>
          <button data-cheat-tab="verify">VERIFY</button>
        </div>
        <button id="cheat-min" aria-label="Minimize cheat sheet">MIN</button>
        <button id="cheat-close" aria-label="Close cheat sheet">X</button>
      </div>
      <div class="cheat-body">
        <div class="cheat-pane active" data-cheat-pane="p51">
          ${step(1,'<code>V36 E</code> · Fresh Start; wait ~15 s for ISS.')}
          ${step(2,'<code>V37 E 51 E</code>')}
          ${step(3,'At <code>V50 N25 / 00015</code> press <span class="cheat-key">PRO</span>.')}
          ${step(4,'At <code>V51</code>: open SXT, aim, press <span class="cheat-key">MARK</span>.')}
          ${step(5,'At <code>V50 N25 / 00016</code> press <span class="cheat-key">PRO</span>.')}
          ${step(6,'At <code>V01 N71</code>: <code>V21 N71 E 00001 E</code>.')}
          ${step(7,'Press <span class="cheat-key">PRO</span> → second <code>V51</code>.')}
          ${step(8,'Aim elsewhere in SXT and press <span class="cheat-key">MARK</span>.')}
          ${step(9,'At <code>V50 N25 / 00016</code> press <span class="cheat-key">PRO</span>.')}
          ${step(10,'At <code>V01 N71</code>: <code>V21 N71 E 00002 E</code>.')}
          ${step(11,'Press <span class="cheat-key">PRO</span>. At <code>V06 N05</code> press <span class="cheat-key">PRO</span> to accept this test mismatch.')}
          ${step(12,'At flashing <code>V37</code>: enter <code>52 E</code>. Expect P52 <code>V04 N06</code>.')}
          <div class="cheat-actions"><button class="cheat-reset" id="cheat-reset">RESET CHECKS</button></div>
        </div>
        <div class="cheat-pane" data-cheat-pane="p51real">
          ${row('<b>Real-sky P51:</b> phone overlay helps you find the Apollo catalog stars. It does not write star vectors or alignment state into the AGC.')}
          ${row('<code>V36 E</code> · wait ~15 s · <code>V37 E 51 E</code>.')}
          ${row('At <code>V50 N25 / 00015</code> press <span class="cheat-key">PRO</span>.')}
          ${row('Open <span class="cheat-key">SEXTANT</span>, turn <span class="cheat-key">STAR FINDER ON</span>, and allow location.')}
          ${row('Select the first recommended Apollo star. If pointing has not been calibrated on this phone, visually center that real star in the camera reticle and press <span class="cheat-key">CALIBRATE POINTING ON STAR</span>.') }
          ${row('Move the phone until the cue says <b>CENTERED</b>, then press <span class="cheat-key">MARK</span>.')}
          ${row('At <code>V50 N25 / 00016</code> press <span class="cheat-key">PRO</span>. At <code>V01 N71</code>, enter the exact <b>AFTER MARK</b> command shown in SXT.')}
          ${row('Press <span class="cheat-key">PRO</span>. At the second <code>V51</code>, select the other recommended star, aim, and <span class="cheat-key">MARK</span>.')}
          ${row('Again <code>V50 N25 / 00016</code> → <span class="cheat-key">PRO</span> → <code>V01 N71</code> → enter the second star command → <span class="cheat-key">PRO</span>.')}
          ${row('At <code>V06 N05</code>, inspect the angular difference. A real alignment should be small; <span class="cheat-key">PRO</span> accepts it.')}
          ${row('At flashing <code>V37</code> enter <code>52 E</code>. P52 should proceed to <code>V04 N06</code> instead of alarm 00220.')}
        </div>
        <div class="cheat-pane" data-cheat-pane="quick">
          ${row('<code>V35 E</code> — DSKY lamp/display test')}
          ${row('<code>V16 N36 E</code> — monitor AGC clock')}
          ${row('<code>V16 N20 E</code> — monitor ICDU angles')}
          ${row('<code>V16 N21 E</code> — monitor PIPA counters')}
          ${row('<code>V16 N91 E</code> — monitor optics shaft/trunnion')}
          ${row('<code>V05 N09 E</code> — alarm codes')}
          ${row('<code>V37 E 00 E</code> — P00')}
          ${row('<code>V36 E</code> — Fresh Start')}
          ${row('<code>V34 E</code> — terminate/reject current flashing request')}
          ${row('<span class="cheat-key">RSET</span> clears OPR ERR; <span class="cheat-key">KEY REL</span> clears KEY REL when requested.')}
        </div>
        <div class="cheat-pane" data-cheat-pane="sxt">
          ${row('<b>Aim by moving the phone.</b> The reticle is fixed; there is no drag steering.')}
          ${row('<span class="cheat-key">SIGHT ZERO</span> rebases the phone pose only. It does not zero CDUS/CDUT.')}
          ${row('<span class="cheat-key">AIM SCALE</span> cycles 1:1 → 0.25× → 0.10× for fine optical motion.')}
          ${row('<span class="cheat-key">STAR FINDER</span> ranks Apollo stars that are above the local horizon and likely visible for current twilight/brightness, then applies the Comanche 40–66° pair rule. It falls back to geometric visibility if necessary.') }
          ${row('<span class="cheat-key">CALIBRATE POINTING ON STAR</span>: visually center the selected real star first, then tap. This learns the phone camera/sensor boresight. <span class="cheat-key">CLEAR POINTING CALIBRATION</span> restores the nominal rear-camera axis.')}
          ${row('<span class="cheat-key">MARK</span> only when Comanche is asking for a mark, normally flashing <code>V51</code>.')}
          ${row('<span class="cheat-key">MARK REJECT</span> rejects the current optical mark.')}
          ${row('<code>V16 N91 E</code> shows the real Comanche optics counters while aiming.')}
          ${row('<span class="cheat-muted">While SXT is open, phone motion is reserved for optics; ICDU/PIPA phone injection is suspended.</span>')}
        </div>
        <div class="cheat-pane" data-cheat-pane="verify">
          ${row('<b>ICDU phone test:</b> <code>V16 N20 E</code> → IMU ZERO → rotate/tilt phone. The three real CDU values should change.')}
          ${row('<b>PIPA phone test:</b> hold phone still → PIPA CALIBRATE → <code>V16 N21 E</code> → move phone. Or open DIAGNOSTICS and arm the 5-second PIPA motion test.')}
          ${row('<b>Optics test:</b> <code>V16 N91 E</code> → open SXT → move phone. CDUS/CDUT should change; SXT close must not jump the ICDUs.')}
          ${row('<b>State test:</b> DIAGNOSTICS → VERIFY SNAPSHOT ROUND-TRIP. Fingerprints must match. The app also autosaves AGC state while running and on background/page hide.')}
          ${row('<b>Alignment regression:</b> complete P51, accept <code>V06 N05</code>, then at flashing <code>V37</code> enter <code>52 E</code>. Expect <code>V04 N06</code>, not 00220.')}
          ${row('<b>Sensor health:</b> DIAGNOSTICS shows IMU/magnetometer/PIPA update rate, sample age, input write retries, location age/accuracy, camera pointing source and calibration.')}
        </div>
      </div>
    </section>`;
  }
  function step(n,txt){return `<label class="cheat-step"><input type="checkbox" data-cheat-check="${n}"><span>${txt}</span></label>`}
  function row(txt){return `<div class="cheat-row">${txt}</div>`}

  function loadChecks(){
    let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')}catch(_){}
    sheet.querySelectorAll('[data-cheat-check]').forEach(c=>c.checked=!!saved[c.dataset.cheatCheck]);
  }
  function saveChecks(){
    const saved={};sheet.querySelectorAll('[data-cheat-check]').forEach(c=>saved[c.dataset.cheatCheck]=c.checked);
    try{localStorage.setItem(STORE,JSON.stringify(saved))}catch(_){}
  }
  function loadPos(){try{const p=JSON.parse(localStorage.getItem(POS)||'{}');if(Number.isFinite(p.x))pos.x=p.x;if(Number.isFinite(p.y))pos.y=p.y}catch(_){};applyPos()}
  function savePos(){try{localStorage.setItem(POS,JSON.stringify(pos))}catch(_){} }
  function applyPos(){sheet.style.setProperty('--sheet-x',`${pos.x}px`);sheet.style.setProperty('--sheet-y',`${pos.y}px`)}
  function fitAboveDsky(){
    const d=document.querySelector('.dsky');
    if(!d)return;
    const dr=d.getBoundingClientRect();
    const sr=sheet.getBoundingClientRect();
    const top=Math.max(3,sr.top-pos.y);
    const room=dr.top-top-5;
    const cap=innerWidth>innerHeight?Math.min(innerHeight*.30,230):Math.min(innerHeight*.22,280);
    sheet.style.setProperty('--sheet-max-h',`${Math.max(96,Math.min(cap,room>96?room:cap))}px`);
  }
  function clampPos(){
    const r=sheet.getBoundingClientRect();let dx=0,dy=0;
    if(r.left<2)dx=2-r.left;if(r.right>innerWidth-2)dx=(innerWidth-2)-r.right;
    if(r.top<2)dy=2-r.top;if(r.bottom>innerHeight-2)dy=(innerHeight-2)-r.bottom;
    pos.x+=dx;pos.y+=dy;applyPos();savePos();
  }
  function open(){sheet.classList.add('open');sheet.classList.remove('minimized');requestAnimationFrame(()=>{fitAboveDsky();clampPos()})}
  function close(){sheet.classList.remove('open')}
  function init(){
    document.body.insertAdjacentHTML('beforeend',markup());sheet=document.getElementById('agc-cheat-sheet');loadChecks();loadPos();
    const launch=document.getElementById('cheat');if(launch)launch.addEventListener('click',open);
    document.getElementById('cheat-close').addEventListener('click',e=>{e.stopPropagation();close()});
    document.getElementById('cheat-min').addEventListener('click',e=>{e.stopPropagation();sheet.classList.toggle('minimized');e.currentTarget.textContent=sheet.classList.contains('minimized')?'OPEN':'MIN';requestAnimationFrame(clampPos)});
    document.getElementById('cheat-reset').addEventListener('click',()=>{sheet.querySelectorAll('[data-cheat-check]').forEach(c=>c.checked=false);saveChecks()});
    sheet.addEventListener('change',e=>{if(e.target.matches('[data-cheat-check]'))saveChecks()});
    sheet.querySelectorAll('[data-cheat-tab]').forEach(b=>b.addEventListener('click',()=>{
      const t=b.dataset.cheatTab;sheet.querySelectorAll('[data-cheat-tab]').forEach(x=>x.classList.toggle('active',x===b));sheet.querySelectorAll('[data-cheat-pane]').forEach(p=>p.classList.toggle('active',p.dataset.cheatPane===t));
    }));
    const head=document.getElementById('cheat-drag');
    head.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;dragging=true;dragStart={x:e.clientX,y:e.clientY,px:pos.x,py:pos.y};head.setPointerCapture(e.pointerId);e.preventDefault()});
    head.addEventListener('pointermove',e=>{if(!dragging)return;pos.x=dragStart.px+e.clientX-dragStart.x;pos.y=dragStart.py+e.clientY-dragStart.y;applyPos();e.preventDefault()});
    head.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;try{head.releasePointerCapture(e.pointerId)}catch(_){};clampPos()});
    head.addEventListener('pointercancel',()=>{dragging=false;clampPos()});
    addEventListener('resize',()=>requestAnimationFrame(()=>{fitAboveDsky();clampPos()}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
