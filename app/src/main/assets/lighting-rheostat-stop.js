'use strict';

/*
 * Apollo CM NUMERICS / INTEGRAL rheostat mechanical stop.
 *
 * The app presents the two rheostats as continuous vertical-swipe rotary knobs.
 * Intermediate UI percentages are interpolated presentation values, not claimed
 * Apollo calibration marks. The normal control range cannot reach OFF.
 */
(() => {
  if (window.__DSKY_LIGHTING_RHEOSTAT_STOP__) return;
  window.__DSKY_LIGHTING_RHEOSTAT_STOP__ = true;

  const lighting = window.AGCDSKY && window.AGCDSKY.lighting;
  if (!lighting || typeof lighting.levels !== 'function') return;

  const MIN_NORMAL_LEVEL = 0.25;
  const MAX_NORMAL_LEVEL = 1.00;

  function clamp(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(MIN_NORMAL_LEVEL, Math.min(MAX_NORMAL_LEVEL, n)) : MAX_NORMAL_LEVEL;
  }

  function normalize() {
    const state = lighting.levels();
    if (typeof lighting.setNumerics === 'function' && state.numerics < MIN_NORMAL_LEVEL) {
      lighting.setNumerics(MAX_NORMAL_LEVEL);
    }
    if (typeof lighting.setIntegral === 'function' && state.integral < MIN_NORMAL_LEVEL) {
      lighting.setIntegral(MAX_NORMAL_LEVEL);
    }
  }

  normalize();

  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_LIGHTING_RHEOSTAT_STOP',Object.freeze({
    minimumNormalUiLevel:MIN_NORMAL_LEVEL,
    maximumNormalUiLevel:MAX_NORMAL_LEVEL,
    continuousUiInterpolation:true,
    completeOffMethod:'open lighting feed / circuit breaker, not normal rheostat rotation',
    clamp,
    state:() => ({...lighting.levels()})
  }),'lighting-rheostat-stop publication');
})();
