'use strict';

/*
 * Apollo CM NUMERICS / INTEGRAL rheostat mechanical stop.
 *
 * Spacecraft lighting documentation states that these rheostats cannot be
 * rotated to OFF; complete disable is by opening the lighting circuit breaker.
 * flight-hardware-ui.js retains a zero level because LIGHT BUS DEMO needs to
 * model an electrically opened feed. This layer prevents that zero level from
 * being selected by ordinary rheostat clicks while preserving it for the feed-
 * open demonstration.
 */
(() => {
  if (window.__DSKY_LIGHTING_RHEOSTAT_STOP__) return;
  window.__DSKY_LIGHTING_RHEOSTAT_STOP__ = true;

  const lighting = window.AGCDSKY && window.AGCDSKY.lighting;
  if (!lighting || typeof lighting.levels !== 'function') return;

  const MIN_NORMAL_LEVEL = 0.25; // lowest discrete UI approximation, not a claimed rheostat calibration point

  function normalizeOne(kind) {
    let state = lighting.levels();
    let level = kind === 'numerics' ? state.numerics : state.integral;
    if (level > 0.001) return level;

    const cycle = kind === 'numerics' ? lighting.cycleNumerics : lighting.cycleIntegral;
    if (typeof cycle !== 'function') return level;
    cycle();
    state = lighting.levels();
    level = kind === 'numerics' ? state.numerics : state.integral;
    return level;
  }

  // A prior app version could have persisted the now-invalid 0% index.
  // Normalize it once without disturbing any other saved setting.
  normalizeOne('numerics');
  normalizeOne('integral');

  function cycleWithMechanicalStop(kind) {
    const cycle = kind === 'numerics' ? lighting.cycleNumerics : lighting.cycleIntegral;
    if (typeof cycle !== 'function') return;
    cycle();
    normalizeOne(kind); // if the private sequence reached zero, wrap immediately to full bright
  }

  window.addEventListener('click', event => {
    const button = event.target && event.target.closest ? event.target.closest('#numerics-light,#integral-light') : null;
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (button.id === 'numerics-light') cycleWithMechanicalStop('numerics');
    else cycleWithMechanicalStop('integral');
    if (typeof window.showControls === 'function') window.showControls();
  }, {capture:true, passive:false});

  window.AGCDSKY.lightingRheostatStop = Object.freeze({
    minimumNormalUiLevel:MIN_NORMAL_LEVEL,
    completeOffMethod:'open lighting feed / circuit breaker, not normal rheostat rotation',
    zeroReservedFor:'LIGHT BUS DEMO feed-open state',
    state:() => ({...lighting.levels()})
  });
})();
