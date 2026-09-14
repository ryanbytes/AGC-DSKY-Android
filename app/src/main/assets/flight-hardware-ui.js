'use strict';

/*
 * Block II DSKY presentation hardware fidelity.
 *
 * - Separate NUMERICS (EL display) and INTEGRAL (key/annunciator) lighting.
 * - Lighting power never alters relay/AGC state; removing power only darkens it.
 * - SCD 1006387 alarm legends use three incandescent lamps each.  The flown
 *   drawings specify construction/electrical/brightness limits but not optical
 *   rise/decay times, so the thermal constants below remain labeled estimates.
 * - Keycaps travel into the panel, make contact partway through the stroke,
 *   keep channel 015 asserted while held, and return channel 015 to zero on
 *   physical release.  PRO remains a separate channel-032 control owned by the
 *   source-backed hardware-fidelity layer.
 * - Deterministic component personalities preserve small manufacturing-style
 *   differences between runs of the same simulated DSKY.
 * - LIGHT BUS DEMO opens the lighting feeds without pausing Comanche/clock.
 */
(() => {
  if (window.__DSKY_FLIGHT_HARDWARE_UI__) return;
  window.__DSKY_FLIGHT_HARDWARE_UI__ = true;

  const root = document.documentElement;
  const controls = document.getElementById('controls');
  const modeLabel = document.getElementById('mode');
  const LEVELS = Object.freeze([1.00, 0.75, 0.50, 0.25, 0.00]);
  const NORMAL_KEY_CHANNEL = 0o15;
  const DSKY_KEY_CODE = Object.freeze({
    '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
    V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
  });
  const KEY_CONTACT_BASE_MS = 36;
  const KEY_RETURN_SOUND_BASE_MS = 18;
  // Best-estimate optical timing only.  White legends use MS24367-713 lamps;
  // yellow legends use MS24367-680.  No surviving Apollo/MS24367 source found
  // so far specifies transient light-output timing for either part.
  const LAMP_MODEL = Object.freeze({
    white: Object.freeze({part:'MS24367-713', riseMs:32, fallMs:48}),
    yellow:Object.freeze({part:'MS24367-680', riseMs:40, fallMs:58})
  });
  const HARDWARE_SEED_KEY = 'dskyHardwareUnitSeedV1';
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

  function readHardwareSeed() {
    try {
      const prior = localStorage.getItem(HARDWARE_SEED_KEY);
      if (prior && /^[0-9a-f]{8}$/i.test(prior)) return prior.toLowerCase();
      let value = 0x6d2b79f5;
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const words = new Uint32Array(1);
        window.crypto.getRandomValues(words);
        value = words[0] >>> 0;
      } else {
        value = (Math.floor(performance.timeOrigin || Date.now()) ^ Math.floor(performance.now() * 1000)) >>> 0;
      }
      const seed = value.toString(16).padStart(8, '0');
      localStorage.setItem(HARDWARE_SEED_KEY, seed);
      return seed;
    } catch (_) {
      return '6d2b79f5';
    }
  }

  const hardwareSeed = readHardwareSeed();
  function hash32(text) {
    let h = 0x811c9dc5;
    const s = `${hardwareSeed}|${text}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function signedUnit(id) {
    return (hash32(id) / 0xffffffff) * 2 - 1;
  }
  function vary(base, fraction, id) {
    return base * (1 + signedUnit(id) * fraction);
  }

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

  const lampPersonalities = Object.create(null);
  function prepareAnnunciatorLegends() {
    for (const lamp of document.querySelectorAll('.ann-grid .lamp:not(.blank)')) {
      if (lamp.querySelector('.lamp-legend')) continue;
      const lampName = lamp.dataset.lamp || 'unknown';
      const family = lamp.classList.contains('yellow') ? 'yellow' : 'white';
      const model = LAMP_MODEL[family];
      lamp.dataset.lampPart = model.part;

      const legend = document.createElement('span');
      legend.className = 'lamp-legend';
      while (lamp.firstChild) legend.appendChild(lamp.firstChild);

      const sources = [];
      const sourceData = [];
      for (let i = 0; i < 3; i++) {
        const source = document.createElement('span');
        source.className = `lamp-source lamp-source-${i + 1}`;
        source.setAttribute('aria-hidden', 'true');
        const prefix = `lamp:${lampName}:${i + 1}`;
        const rise = vary(model.riseMs, 0.13, `${prefix}:rise`);
        const fall = vary(model.fallMs, 0.13, `${prefix}:fall`);
        const gain = Math.max(0.82, Math.min(1.18, vary(1, 0.10, `${prefix}:gain`)));
        source.style.setProperty('--lamp-rise', `${rise.toFixed(1)}ms`);
        source.style.setProperty('--lamp-fall', `${fall.toFixed(1)}ms`);
        source.style.setProperty('--lamp-gain', gain.toFixed(3));
        sources.push(source);
        sourceData.push(Object.freeze({riseMs:Number(rise.toFixed(1)), fallMs:Number(fall.toFixed(1)), gain:Number(gain.toFixed(3))}));
      }
      for (const source of sources) lamp.appendChild(source);
      lamp.appendChild(legend);
      lampPersonalities[lampName] = Object.freeze({part:model.part, sources:Object.freeze(sourceData)});
    }
    document.body.classList.add('lamp-hardware-ready');
  }

  const keyPersonalities = Object.create(null);
  function keyPersonality(button) {
    const key = button && button.dataset ? button.dataset.key : '?';
    if (keyPersonalities[key]) return keyPersonalities[key];
    const p = Object.freeze({
      contactMs: Number(vary(KEY_CONTACT_BASE_MS, 0.14, `key:${key}:contact`).toFixed(1)),
      returnSoundMs: Number(vary(KEY_RETURN_SOUND_BASE_MS, 0.18, `key:${key}:return`).toFixed(1)),
      travelVmin: Number(vary(0.42, 0.08, `key:${key}:travel`).toFixed(3)),
      makePitch: Number(vary(520, 0.055, `key:${key}:make-pitch`).toFixed(1)),
      returnPitch: Number(vary(330, 0.055, `key:${key}:return-pitch`).toFixed(1)),
      soundGain: Number(vary(1, 0.09, `key:${key}:gain`).toFixed(3))
    });
    keyPersonalities[key] = p;
    if (button) button.style.setProperty('--key-travel', `${p.travelVmin}vmin`);
    return p;
  }

  function prepareKeys() {
    for (const button of document.querySelectorAll('[data-key]')) keyPersonality(button);
  }

  function keySound(button, returning = false) {
    try {
      if (localStorage.getItem('audioTickV4') === '0') return;
    } catch (_) {}
    const ctx = typeof window.ensureAudio === 'function' ? window.ensureAudio() : null;
    if (!ctx) return;
    const p = keyPersonality(button);
    const fire = () => {
      const when = ctx.currentTime + 0.001;
      const osc = ctx.createOscillator();
      const body = ctx.createGain();
      const startHz = returning ? p.returnPitch : p.makePitch;
      const endHz = returning ? startHz * 0.64 : startHz * 0.48;
      const gain = (returning ? .028 : .052) * p.soundGain;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(startHz, when);
      osc.frequency.exponentialRampToValueAtTime(endHz, when + (returning ? .010 : .007));
      body.gain.setValueAtTime(gain, when);
      body.gain.exponentialRampToValueAtTime(.0001, when + (returning ? .014 : .011));
      osc.connect(body); body.connect(ctx.destination); osc.start(when); osc.stop(when + .016);
    };
    if (ctx.state === 'running') fire(); else ctx.resume().then(fire).catch(() => {});
  }

  function agcCoreNow() {
    try { return window.AGCDSKY && typeof window.AGCDSKY.getCore === 'function' ? window.AGCDSKY.getCore() : null; }
    catch (_) { return null; }
  }

  function releaseAgcKey(state) {
    if (!state || !state.agcHeld) return;
    const core = state.core || agcCoreNow();
    state.agcHeld = false;
    try {
      if (core && typeof core.writeIo === 'function') core.writeIo(NORMAL_KEY_CHANNEL, 0);
    } catch (error) { console.error('DSKY key-reset release failed', error); }
  }

  const keyState = new Map();
  function fireKeyContact(button, state) {
    if (!state || !state.down || state.fired) return;
    state.fired = true;
    keySound(button, false);
    try {
      const key = button.dataset.key;
      const core = agcCoreNow();
      if (core && typeof mode !== 'undefined' && mode === 'agc') {
        const code = DSKY_KEY_CODE[key];
        if (code !== undefined) {
          if (typeof core.keyPress === 'function') core.keyPress(code);
          else if (typeof core.writeIo === 'function') core.writeIo(NORMAL_KEY_CHANNEL, code);
          state.agcHeld = true;
          state.core = core;
          state.keyCode = code;
          if (window.AGCDSKY && typeof window.AGCDSKY.scheduleAgcAutosave === 'function') {
            window.AGCDSKY.scheduleAgcAutosave('DSKY key make');
          }
          return;
        }
      }
      if (typeof window.press === 'function') window.press(key);
    } catch (error) { console.error('DSKY key contact failed', error); }
  }

  function onKeyDown(event) {
    const button = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!button) return;
    // PRO is not a keyboard key. hardware-fidelity.js owns its dedicated
    // channel-032 press-and-hold path and standby behavior.
    if (button.dataset.key === 'P') return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    let state = keyState.get(button);
    if (state && state.down) return;
    const p = keyPersonality(button);
    state = {down:true, fired:false, timer:0, pointerId:event.pointerId, agcHeld:false, core:null, keyCode:0};
    keyState.set(button, state);
    button.classList.add('pressed');
    try { button.setPointerCapture(event.pointerId); } catch (_) {}
    state.timer = setTimeout(() => fireKeyContact(button, state), p.contactMs);
  }

  function finishRelease(button, state, cancelled) {
    clearTimeout(state.timer);
    if (!cancelled && !state.fired) fireKeyContact(button, state);
    releaseAgcKey(state);
    state.down = false;
    button.classList.remove('pressed');
    if (state.fired) {
      const p = keyPersonality(button);
      setTimeout(() => keySound(button, true), p.returnSoundMs);
    }
    try { button.releasePointerCapture(state.pointerId); } catch (_) {}
    keyState.delete(button);
  }

  function releaseKey(event, cancelled = false) {
    const button = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!button || button.dataset.key === 'P') return;
    const state = keyState.get(button);
    if (!state || !state.down) return;
    finishRelease(button, state, cancelled);
  }

  function releaseAllKeys() {
    for (const [button, state] of Array.from(keyState.entries())) {
      if (!state || !state.down) continue;
      finishRelease(button, state, true);
    }
  }

  document.addEventListener('pointerdown', onKeyDown, {capture:true, passive:false});
  document.addEventListener('pointerup', event => releaseKey(event, false), {capture:true, passive:true});
  document.addEventListener('pointercancel', event => releaseKey(event, true), {capture:true, passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAllKeys(); }, {capture:true});
  window.addEventListener('blur', releaseAllKeys, {passive:true});

  prepareAnnunciatorLegends();
  prepareKeys();
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
  window.AGCDSKY.hardwarePersonality = () => ({
    seed:hardwareSeed,
    lamps:Object.fromEntries(Object.entries(lampPersonalities).map(([name, value]) => [name, {part:value.part, sources:value.sources.map(x => ({...x}))}])),
    keys:Object.fromEntries(Object.entries(keyPersonalities).map(([name, value]) => [name, {...value}]))
  });
})();
