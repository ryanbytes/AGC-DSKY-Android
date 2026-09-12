'use strict';

/*
 * Block II DSKY presentation hardware fidelity.
 *
 * - Separate NUMERICS (EL display) and INTEGRAL (key/annunciator) lighting.
 * - Lighting power never alters relay/AGC state; removing power only darkens it.
 * - Incandescent annunciators retain their three-lamp geometry with a short
 *   filament rise/decay handled in CSS.
 * - Keycaps travel into the panel, make contact partway through the stroke,
 *   stay depressed while held, and spring back on release.
 * - LIGHT BUS DEMO opens the lighting feeds without pausing Comanche/clock.
 *
 * Exact key travel distance/contact time and filament thermal constants are
 * presentation-model values because the checked drawings establish the
 * mechanisms and lamp construction but do not supply trustworthy measured
 * dynamic values for the flown assemblies.
 */
(() => {
  if (window.__DSKY_FLIGHT_HARDWARE_UI__) return;
  window.__DSKY_FLIGHT_HARDWARE_UI__ = true;

  const root = document.documentElement;
  const controls = document.getElementById('controls');
  const modeLabel = document.getElementById('mode');
  const LEVELS = Object.freeze([1.00, 0.75, 0.50, 0.25, 0.00]);
  const KEY_CONTACT_MS = 36;
  const KEY_RETURN_SOUND_MS = 18;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

  const readIndex = (key, fallback = 0) => {
    try {
      const n = Number(localStorage.getItem(key));
      return Number.isInteger(n) && n >= 0 && n < LEVELS.length ? n : fallback;
    } catch (_) { return fallback; }
  };
  const saveIndex = (key, value) => {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  };

  let numericsIndex = readIndex('dskyNumericsLevel', 0);
  let integralIndex = readIndex('dskyIntegralLevel', 0);
  let effectiveNumerics = LEVELS[numericsIndex];
  let effectiveIntegral = LEVELS[integralIndex];
  let demoToken = 0;
  let demoActive = false;

  function levelText(index) {
    return `${Math.round(LEVELS[index] * 100)}%`;
  }

  function applyEffective(numerics, integral) {
    effectiveNumerics = Math.max(0, Math.min(1, Number(numerics) || 0));
    effectiveIntegral = Math.max(0, Math.min(1, Number(integral) || 0));
    root.style.setProperty('--numerics-level', effectiveNumerics.toFixed(3));
    root.style.setProperty('--integral-level', effectiveIntegral.toFixed(3));

    // Block II keyboard legends are white EL.  At zero integral power retain
    // only a faint unpowered legend so the key is still physically readable.
    const keyAlpha = 0.22 + 0.78 * effectiveIntegral;
    const glowAlpha = 0.46 * effectiveIntegral;
    root.style.setProperty('--key-el-color', `rgba(245,247,237,${keyAlpha.toFixed(3)})`);
    root.style.setProperty('--key-el-shadow', effectiveIntegral > 0.001
      ? `0 0 .18vmin rgba(244,250,236,${glowAlpha.toFixed(3)}),0 .08em #000`
      : '0 .08em #000');
  }

  function applyManual() {
    applyEffective(LEVELS[numericsIndex], LEVELS[integralIndex]);
    const n = document.getElementById('numerics-light');
    const i = document.getElementById('integral-light');
    if (n) n.textContent = `NUMERICS ${levelText(numericsIndex)}`;
    if (i) i.textContent = `INTEGRAL ${levelText(integralIndex)}`;
  }

  function cycleNumerics() {
    if (demoActive) return;
    numericsIndex = (numericsIndex + 1) % LEVELS.length;
    saveIndex('dskyNumericsLevel', numericsIndex);
    applyManual();
  }

  function cycleIntegral() {
    if (demoActive) return;
    integralIndex = (integralIndex + 1) % LEVELS.length;
    saveIndex('dskyIntegralLevel', integralIndex);
    applyManual();
  }

  function setStatus(text) {
    if (modeLabel) modeLabel.textContent = text;
  }

  async function lightingBusDemo() {
    const button = document.getElementById('lighting-bus-demo');
    if (demoActive) {
      demoToken++;
      demoActive = false;
      applyManual();
      if (button) button.textContent = 'LIGHT BUS DEMO';
      setStatus('LIGHT BUS DEMO · ABORTED · STATE NEVER CLEARED');
      return;
    }

    demoActive = true;
    const token = ++demoToken;
    const n = LEVELS[numericsIndex], i = LEVELS[integralIndex];
    if (button) button.textContent = 'STOP LIGHT DEMO';

    const stage = async (label, nl, il, ms) => {
      if (token !== demoToken) throw new Error('lighting-demo-stop');
      setStatus(label);
      applyEffective(nl, il);
      await sleep(ms);
    };

    try {
      await stage('LIGHT BUS DEMO · NUMERICS FEED OPEN', 0, i, 1250);
      await stage('LIGHT BUS DEMO · NUMERICS FEED RESTORED', n, i, 650);
      await stage('LIGHT BUS DEMO · INTEGRAL FEED OPEN', n, 0, 1250);
      await stage('LIGHT BUS DEMO · INTEGRAL FEED RESTORED', n, i, 650);
      await stage('LIGHT BUS DEMO · BOTH LIGHTING FEEDS OPEN', 0, 0, 1100);
      await stage('LIGHT BUS DEMO · POWER RESTORED · RELAY STATE RETAINED', n, i, 900);
    } catch (error) {
      if (!error || error.message !== 'lighting-demo-stop') console.error('Lighting bus demo failed', error);
    } finally {
      if (token === demoToken) {
        demoActive = false;
        applyManual();
        if (button) button.textContent = 'LIGHT BUS DEMO';
      }
    }
  }

  function installLightingControls() {
    if (!controls || document.getElementById('numerics-light')) return;
    const oldDim = document.getElementById('dim');
    if (oldDim) oldDim.hidden = true;
    // The former whole-panel dim class is intentionally retired: physical
    // Block II NUMERICS and INTEGRAL lighting feeds are independent.
    document.body.classList.remove('dim');
    try { localStorage.setItem('dim', '0'); } catch (_) {}

    const numerics = document.createElement('button');
    numerics.id = 'numerics-light';
    numerics.addEventListener('click', () => { cycleNumerics(); window.showControls?.(); });

    const integral = document.createElement('button');
    integral.id = 'integral-light';
    integral.addEventListener('click', () => { cycleIntegral(); window.showControls?.(); });

    const demo = document.createElement('button');
    demo.id = 'lighting-bus-demo';
    demo.textContent = 'LIGHT BUS DEMO';
    demo.addEventListener('click', () => { lightingBusDemo(); window.showControls?.(); });

    const anchor = document.getElementById('dreambright') || controls.firstChild;
    controls.insertBefore(numerics, anchor);
    controls.insertBefore(integral, anchor);
    controls.insertBefore(demo, anchor);
    applyManual();
  }

  function prepareAnnunciatorLegends() {
    for (const lamp of document.querySelectorAll('.ann-grid .lamp:not(.blank)')) {
      if (lamp.firstElementChild && lamp.firstElementChild.classList.contains('lamp-legend')) continue;
      const span = document.createElement('span');
      span.className = 'lamp-legend';
      while (lamp.firstChild) span.appendChild(lamp.firstChild);
      lamp.appendChild(span);
    }
    document.body.classList.add('lamp-hardware-ready');
  }

  function keySound(returning = false) {
    try {
      if (localStorage.getItem('audioTickV4') === '0') return;
    } catch (_) {}
    const ctx = typeof window.ensureAudio === 'function' ? window.ensureAudio() : null;
    if (!ctx) return;
    const fire = () => {
      const when = ctx.currentTime + 0.001;
      const osc = ctx.createOscillator();
      const body = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(returning ? 330 : 520, when);
      osc.frequency.exponentialRampToValueAtTime(returning ? 210 : 250, when + (returning ? .010 : .007));
      body.gain.setValueAtTime(returning ? .028 : .052, when);
      body.gain.exponentialRampToValueAtTime(.0001, when + (returning ? .014 : .011));
      osc.connect(body); body.connect(ctx.destination); osc.start(when); osc.stop(when + .016);
    };
    if (ctx.state === 'running') fire(); else ctx.resume().then(fire).catch(() => {});
  }

  const keyState = new Map();
  function fireKeyContact(button, state) {
    if (!state || !state.down || state.fired) return;
    state.fired = true;
    keySound(false);
    try {
      if (typeof window.press === 'function') window.press(button.dataset.key);
    } catch (error) { console.error('DSKY key contact failed', error); }
  }

  function onKeyDown(event) {
    const button = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!button) return;
    // Suppress app.js's older instant-fire listener; this capture listener owns
    // the complete mechanical stroke/contact/release sequence.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    let state = keyState.get(button);
    if (state && state.down) return;
    state = {down:true, fired:false, timer:0, pointerId:event.pointerId};
    keyState.set(button, state);
    button.classList.add('pressed');
    try { button.setPointerCapture(event.pointerId); } catch (_) {}
    state.timer = setTimeout(() => fireKeyContact(button, state), KEY_CONTACT_MS);
  }

  function releaseKey(event, cancelled = false) {
    const button = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!button) return;
    const state = keyState.get(button);
    if (!state || !state.down) return;
    clearTimeout(state.timer);
    if (!cancelled && !state.fired) fireKeyContact(button, state); // fast tap still reaches switch make
    state.down = false;
    button.classList.remove('pressed');
    if (state.fired) setTimeout(() => keySound(true), KEY_RETURN_SOUND_MS);
    try { button.releasePointerCapture(state.pointerId); } catch (_) {}
    keyState.delete(button);
  }

  document.addEventListener('pointerdown', onKeyDown, {capture:true, passive:false});
  document.addEventListener('pointerup', event => releaseKey(event, false), {capture:true, passive:true});
  document.addEventListener('pointercancel', event => releaseKey(event, true), {capture:true, passive:true});

  prepareAnnunciatorLegends();
  installLightingControls();
  applyManual();

  window.AGCDSKY = window.AGCDSKY || {};
  window.AGCDSKY.lighting = Object.freeze({
    levels: () => ({numerics:effectiveNumerics, integral:effectiveIntegral, numericsIndex, integralIndex}),
    cycleNumerics,
    cycleIntegral,
    demo: lightingBusDemo,
    demoActive: () => demoActive,
    restore: applyManual
  });
})();
