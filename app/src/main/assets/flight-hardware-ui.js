'use strict';

/*
 * Block II DSKY presentation hardware fidelity.
 *
 * - Separate NUMERICS (EL display) and INTEGRAL (key/annunciator) lighting.
 * - Lighting power never alters relay/AGC state; removing power only darkens it.
 * - SCD 1006387 alarm legends use three incandescent lamps each.  The flown
 *   drawings specify construction/electrical/brightness limits but not optical
 *   rise/decay times, so the thermal constants below remain labeled estimates.
 * - This layer owns key/lamp presentation personalities only. The parser-loaded
 *   keyboard-electrical-interlock.js is the single owner of normal keycoded
 *   channel-015 make/KEYRST behavior. PRO remains a separate channel-032
 *   control owned by the source-backed hardware-fidelity layer.
 * - Deterministic component personalities preserve small manufacturing-style
 *   differences between runs of the same simulated DSKY.
 * - NUMERICS and INTEGRAL are continuous app-side rheostat models with a
 *   mechanical minimum stop; intermediate percentages are interpolated UI values.
 */
(() => {
  if (window.__DSKY_FLIGHT_HARDWARE_UI__) return;
  window.__DSKY_FLIGHT_HARDWARE_UI__ = true;

  const root = document.documentElement;
  const controls = document.getElementById('controls');
  const MIN_LIGHT_LEVEL = 0.25;
  const MAX_LIGHT_LEVEL = 1.00;
  const LEGACY_LEVELS = Object.freeze([1.00, 0.75, 0.50, 0.25, 0.00]);
  const KEY_CONTACT_BASE_MS = 36;
  const KEY_RETURN_SOUND_BASE_MS = 18;
  const LAMP_MODEL = Object.freeze({
    white: Object.freeze({part:'MS24367-713', riseMs:32, fallMs:48}),
    yellow:Object.freeze({part:'MS24367-680', riseMs:40, fallMs:58})
  });
  const HARDWARE_SEED_KEY = 'dskyHardwareUnitSeedV1';
  const clampLight = value => Math.max(MIN_LIGHT_LEVEL, Math.min(MAX_LIGHT_LEVEL, Number(value) || MAX_LIGHT_LEVEL));
  const readLevel = (valueKey, legacyIndexKey) => {
    try {
      const stored = Number(localStorage.getItem(valueKey));
      if (Number.isFinite(stored) && stored >= MIN_LIGHT_LEVEL && stored <= MAX_LIGHT_LEVEL) return stored;
      const legacyIndex = Number(localStorage.getItem(legacyIndexKey));
      if (Number.isInteger(legacyIndex) && legacyIndex >= 0 && legacyIndex < LEGACY_LEVELS.length) {
        const migrated = LEGACY_LEVELS[legacyIndex];
        // Older builds could persist the demo-only 0% state. Preserve the
        // historical normalization behavior by returning full bright.
        return migrated < MIN_LIGHT_LEVEL ? MAX_LIGHT_LEVEL : migrated;
      }
    } catch (_) {}
    return MAX_LIGHT_LEVEL;
  };
  const saveLevel = (key, value) => {
    try { localStorage.setItem(key, clampLight(value).toFixed(4)); } catch (_) {}
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

  let effectiveNumerics = readLevel('dskyNumericsValue','dskyNumericsLevel');
  let effectiveIntegral = readLevel('dskyIntegralValue','dskyIntegralLevel');

  function levelText(value) {
    return `${Math.round(clampLight(value) * 100)}%`;
  }

  function applyEffective(numerics, integral) {
    effectiveNumerics = clampLight(numerics);
    effectiveIntegral = clampLight(integral);
    root.style.setProperty('--numerics-level', effectiveNumerics.toFixed(3));
    root.style.setProperty('--integral-level', effectiveIntegral.toFixed(3));

    const keyAlpha = 0.22 + 0.78 * effectiveIntegral;
    const glowAlpha = 0.46 * effectiveIntegral;
    root.style.setProperty('--key-el-color', `rgba(245,247,237,${keyAlpha.toFixed(3)})`);
    root.style.setProperty('--key-el-shadow', effectiveIntegral > 0.001
      ? `0 0 .18vmin rgba(244,250,236,${glowAlpha.toFixed(3)}),0 .08em #000`
      : '0 .08em #000');
    root.style.setProperty('--key-el-filter', effectiveIntegral > 0.001
      ? `drop-shadow(0 0 .18vmin rgba(244,250,236,${glowAlpha.toFixed(3)})) drop-shadow(0 .08vmin 0 #000)`
      : 'drop-shadow(0 .08vmin 0 #000)');
  }

  function knobAngle(value) {
    // Broad Apollo-style potentiometer arc. The app's swipe mapping is a UI
    // convenience; it does not claim a documented spacecraft calibration curve.
    const t = (clampLight(value) - MIN_LIGHT_LEVEL) / (MAX_LIGHT_LEVEL - MIN_LIGHT_LEVEL);
    return -132 + t * 264;
  }

  function updateLightingControl(kind) {
    const value = kind === 'numerics' ? effectiveNumerics : effectiveIntegral;
    const host = document.getElementById(`${kind}-light`);
    if (!host) return;
    const knob = host.querySelector('.lighting-knob');
    const output = host.querySelector('output');
    if (knob) {
      knob.style.setProperty('--knob-angle', `${knobAngle(value).toFixed(2)}deg`);
      knob.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      knob.setAttribute('aria-valuetext', levelText(value));
    }
    if (output) output.value = levelText(value);
  }

  function applyManual() {
    applyEffective(effectiveNumerics, effectiveIntegral);
    updateLightingControl('numerics');
    updateLightingControl('integral');
  }

  function setLightingLevel(kind, rawValue, persist = true) {
    const value = clampLight(rawValue);
    if (kind === 'numerics') {
      effectiveNumerics = value;
      if (persist) saveLevel('dskyNumericsValue', value);
    } else {
      effectiveIntegral = value;
      if (persist) saveLevel('dskyIntegralValue', value);
    }
    applyManual();
    return value;
  }

  function installVerticalKnobInteraction(kind, knob) {
    let activePointer = null;
    let startY = 0;
    let startValue = MAX_LIGHT_LEVEL;
    const span = MAX_LIGHT_LEVEL - MIN_LIGHT_LEVEL;
    const pixelsForFullRange = 180;

    const current = () => kind === 'numerics' ? effectiveNumerics : effectiveIntegral;
    const applyFromY = y => {
      const delta = (startY - y) / pixelsForFullRange;
      setLightingLevel(kind, startValue + delta * span);
      window.showControls?.();
    };

    knob.addEventListener('pointerdown', event => {
      activePointer = event.pointerId;
      startY = event.clientY;
      startValue = current();
      knob.classList.add('dragging');
      knob.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    knob.addEventListener('pointermove', event => {
      if (event.pointerId !== activePointer) return;
      applyFromY(event.clientY);
      event.preventDefault();
    });
    const release = event => {
      if (event.pointerId !== activePointer) return;
      applyFromY(event.clientY);
      activePointer = null;
      knob.classList.remove('dragging');
      knob.releasePointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    knob.addEventListener('pointerup', release);
    knob.addEventListener('pointercancel', event => {
      if (event.pointerId !== activePointer) return;
      activePointer = null;
      knob.classList.remove('dragging');
      event.preventDefault();
    });
    knob.addEventListener('keydown', event => {
      const step = event.shiftKey ? 0.10 : 0.01;
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') setLightingLevel(kind, current() + step);
      else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') setLightingLevel(kind, current() - step);
      else if (event.key === 'Home') setLightingLevel(kind, MIN_LIGHT_LEVEL);
      else if (event.key === 'End') setLightingLevel(kind, MAX_LIGHT_LEVEL);
      else return;
      window.showControls?.();
      event.preventDefault();
    });
  }

  function makeLightingKnob(kind, labelText) {
    const host = document.createElement('div');
    host.id = `${kind}-light`;
    host.className = 'lighting-control';
    host.innerHTML = `
      <span class="lighting-label">${labelText}</span>
      <button class="lighting-knob" type="button"
              aria-label="${labelText} brightness"
              aria-valuemin="25" aria-valuemax="100" aria-valuenow="100"
              title="Swipe up/down to adjust">
        <span class="lighting-knob-index" aria-hidden="true"></span>
      </button>
      <output aria-live="polite">100%</output>`;
    const knob = host.querySelector('.lighting-knob');
    installVerticalKnobInteraction(kind, knob);
    return host;
  }

  function installLightingControls() {
    if (!controls || document.getElementById('lighting-controls')) return;
    const oldDim = document.getElementById('dim');
    if (oldDim) oldDim.hidden = true;
    document.body.classList.remove('dim');
    try { localStorage.setItem('dim', '0'); } catch (_) {}

    const group = document.createElement('div');
    group.id = 'lighting-controls';
    group.className = 'lighting-controls';
    group.setAttribute('aria-label','DSKY lighting');
    group.appendChild(makeLightingKnob('numerics','NUMERICS'));
    group.appendChild(makeLightingKnob('integral','INTEGRAL'));

    const anchor = document.getElementById('dreambright') || controls.firstChild;
    controls.insertBefore(group, anchor);
    applyManual();
  }

  const lampPersonalities = Object.create(null);
  function prepareAnnunciatorLegends() {
    for (const lamp of document.querySelectorAll('.ann-grid .lamp:not(.blank)')) {
      const lampName = lamp.dataset.lamp || 'unknown';
      const family = lamp.classList.contains('yellow') ? 'yellow' : 'white';
      const model = LAMP_MODEL[family];
      lamp.dataset.lampPart = model.part;

      // Production markup carries fixed Gorton SVG outlines. Keep a text
      // fallback only for old/cached markup; never replace a vector legend.
      let legend = lamp.querySelector('.lamp-legend');
      if (!legend) {
        legend = document.createElement('span');
        legend.className = 'lamp-legend';
        while (lamp.firstChild) legend.appendChild(lamp.firstChild);
      }

      const sources = [];
      const sourceData = [];
      if (!lamp.querySelector('.lamp-source')) {
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
        for (const source of sources) lamp.insertBefore(source, legend);
      }
      // Keep the legend above the three simulated bulb-source layers.
      if (legend.parentNode === lamp) lamp.appendChild(legend);
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
      makePitch: Number(vary(520, 0.055, `key:${key}:make-pitch`).toFixed(1)),
      returnPitch: Number(vary(330, 0.055, `key:${key}:return-pitch`).toFixed(1)),
      soundGain: Number(vary(1, 0.09, `key:${key}:gain`).toFixed(3))
    });
    keyPersonalities[key] = p;
    return p;
  }

  function prepareKeys() {
    for (const button of document.querySelectorAll('[data-key]')) keyPersonality(button);
  }

  prepareAnnunciatorLegends();
  prepareKeys();
  installLightingControls();
  applyManual();

  const lighting = Object.freeze({
    levels: () => ({numerics:effectiveNumerics, integral:effectiveIntegral}),
    setNumerics: value => setLightingLevel('numerics', value),
    setIntegral: value => setLightingLevel('integral', value),
    minimumNormalUiLevel: MIN_LIGHT_LEVEL,
    maximumNormalUiLevel: MAX_LIGHT_LEVEL,
    restore: applyManual
  });
  function hardwarePersonality(){
    return {
      seed:hardwareSeed,
      lamps:Object.fromEntries(Object.entries(lampPersonalities).map(([name, value]) => [name, {part:value.part, sources:value.sources.map(x => ({...x}))}])),
      keys:Object.fromEntries(Object.entries(keyPersonalities).map(([name, value]) => [name, {...value}]))
    };
  }
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_FLIGHT_HARDWARE_UI',Object.freeze({lighting,hardwarePersonality}),'flight-hardware-ui publication');
})();
