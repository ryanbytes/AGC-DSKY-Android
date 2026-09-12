'use strict';

/*
 * Block II DSKY lighting electrical response.
 *
 * The spacecraft INTEGRAL control feeds two different DSKY load types:
 *   - keyboard legends: electroluminescent, variable 115 VAC / 400 Hz branch
 *   - status/caution indicators: incandescent, variable 0-5 VAC / 400 Hz branch
 *
 * The shared control is therefore historically correct, but the two loads do
 * not have the same light-output transfer function.  SCD/ICD material gives
 * the electrical branches and rated indicator brightness but not a measured
 * dimmer curve for MS24367-680/-713.  For the incandescent branch only, use
 * the standard engineering approximation luminous flux ∝ V^3.4.  This is
 * explicitly an estimate; it does not alter AGC/relay state or EL brightness.
 */
(() => {
  if (window.__DSKY_LIGHTING_ELECTRICAL_MODEL__) return;
  window.__DSKY_LIGHTING_ELECTRICAL_MODEL__ = true;

  const root = document.documentElement;
  const INCANDESCENT_FLUX_EXPONENT = 3.4;
  const STYLE_ID = 'dsky-lighting-electrical-model';
  let integralVoltageRatio = 1;
  let incandescentFluxRatio = 1;

  function clamp01(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  }

  function readIntegralControl() {
    const raw = root.style.getPropertyValue('--integral-level');
    if (raw && raw.trim() !== '') return clamp01(raw);
    const computed = getComputedStyle(root).getPropertyValue('--integral-level');
    return clamp01(computed || 1);
  }

  function incandescentFlux(voltageRatio) {
    const v = clamp01(voltageRatio);
    return v <= 0 ? 0 : Math.pow(v, INCANDESCENT_FLUX_EXPONENT);
  }

  function apply() {
    integralVoltageRatio = readIntegralControl();
    incandescentFluxRatio = incandescentFlux(integralVoltageRatio);
    root.style.setProperty('--integral-incandescent-level', incandescentFluxRatio.toFixed(5));
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
/* INTEGRAL drives the 5-VAC incandescent branch separately from key EL. */
body.spacecraft-cm.lamp-hardware-ready .lamp.on .lamp-source {
  opacity:calc(var(--integral-incandescent-level, var(--integral-level)) * var(--lamp-gain,1));
}
`;
    document.head.appendChild(style);
  }

  installStyle();
  apply();

  // flight-hardware-ui.js changes the normalized INTEGRAL control by writing
  // --integral-level on the root style.  Recompute the incandescent branch
  // after each such control/feed change, including LIGHT BUS DEMO transitions.
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.type === 'attributes' && m.attributeName === 'style')) apply();
  });
  observer.observe(root, {attributes:true, attributeFilter:['style']});

  window.AGCDSKY = window.AGCDSKY || {};
  window.AGCDSKY.lightingElectrical = Object.freeze({
    apply,
    incandescentFlux,
    state: () => Object.freeze({
      integralVoltageRatio,
      incandescentFluxRatio,
      incandescentFluxExponent:INCANDESCENT_FLUX_EXPONENT,
      keyBranch:'variable 115 VAC / 400 Hz EL',
      indicatorBranch:'variable 0-5 VAC / 400 Hz incandescent',
      curveSource:'engineering estimate; Apollo documents specify branch/rating, not lamp dimmer transfer curve'
    })
  });
})();
