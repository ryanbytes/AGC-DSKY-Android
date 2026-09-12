'use strict';

/*
 * Apollo Block II DSKY pushbutton mechanical specification overlay.
 *
 * Source-backed geometry / acceptance envelope:
 *   - R-700 §3.10.1.5: cap housing travels ~3/16 in to switch actuation and
 *     permits another 1/16 in before bottoming (~1/4 in total stroke).
 *   - Compression spring drawing 2004941: 3.0-3.5 lb/in rate, 0.500 in free
 *     length (REF), 0.100 in max solid height, ~1.2 lb load at solid height.
 *   - Sensitive switch SCD 1010901: 7 oz max actuating force, 1 oz min release
 *     force, 0.030 in max pretravel, 0.006 in max differential movement,
 *     0.003 in min overtravel, 3 lb max overtravel force, SPDT.
 *   - Shaft assembly 2003975 procurement requirements: key EL legend >=2.0
 *     foot-lamberts when excited at 75 Vrms, 400 Hz.
 *
 * Acceptance limits are not statistical distributions. Only the compression
 * spring gives a documented bounded rate range suitable for deterministic
 * per-key variation. Touch-to-contact and return-audio timing remain explicitly
 * presentation/gesture estimates and are therefore NOT randomized as if they
 * were manufacturing tolerances.
 *
 * IMPORTANT FORCE LIMITATION: the surviving drawings checked so far do not
 * establish the installed/rest length of spring 2004941, hence its preload is
 * unknown. The leaf-spring lever geometry, switch load and friction also
 * contribute to finger force. We therefore expose only the spring FORCE CHANGE
 * caused by the documented 3/16-in and 1/4-in strokes. We do not claim a total
 * key force from replica/reconstruction figures.
 */
(() => {
  if (window.__DSKY_KEY_MECHANICAL_SPEC__) return;
  window.__DSKY_KEY_MECHANICAL_SPEC__ = true;

  const ASSEMBLY = Object.freeze({
    actuationTravelIn: 3 / 16,
    overtravelToBottomIn: 1 / 16,
    totalTravelIn: 1 / 4
  });
  const COMPRESSION_SPRING = Object.freeze({
    drawing: '2004941',
    rateLbPerInMin: 3.0,
    rateLbPerInMax: 3.5,
    freeLengthInRef: 0.500,
    maxSolidHeightIn: 0.100,
    approxLoadAtSolidLb: 1.2,
    outsideDiameterIn: 0.245,
    wireDiameterIn: 0.016
  });
  const SENSITIVE_SWITCH = Object.freeze({
    drawing: '1010901',
    actuatingForceOzMax: 7,
    releaseForceOzMin: 1,
    pretravelInMax: 0.030,
    differentialMovementInMax: 0.006,
    overtravelInMin: 0.003,
    overtravelForceLbMax: 3,
    contactArrangement: 'SPDT',
    minimumOperatingCycles: 25000
  });
  const KEY_EL = Object.freeze({
    shaftAssembly: '2003975-011',
    minimumBrightnessFootLamberts: 2.0,
    testVrms: 75,
    testHz: 400
  });
  const SPRING_FORCE_ENVELOPE = Object.freeze({
    // F = kx. These are DELTAS from the unknown installed/rest spring force.
    forceIncreaseToActuationOzMin: COMPRESSION_SPRING.rateLbPerInMin * ASSEMBLY.actuationTravelIn * 16,
    forceIncreaseToActuationOzMax: COMPRESSION_SPRING.rateLbPerInMax * ASSEMBLY.actuationTravelIn * 16,
    forceIncreaseToBottomOzMin: COMPRESSION_SPRING.rateLbPerInMin * ASSEMBLY.totalTravelIn * 16,
    forceIncreaseToBottomOzMax: COMPRESSION_SPRING.rateLbPerInMax * ASSEMBLY.totalTravelIn * 16,
    totalFingerForceOzMin: null,
    totalFingerForceOzMax: null,
    unresolvedBecause: Object.freeze([
      'installed/rest compression-spring length or preload not established by the checked surviving drawings',
      'cap-housing leaf-spring lever contribution not reduced to a sourced force curve',
      'sensitive-switch load and sliding/seal friction cannot be summed without the installed geometry'
    ]),
    excludedSecondaryEstimate: 'Replica/reconstruction reports of roughly 21-26 oz are not treated as Apollo drawing requirements.'
  });
  const PRESENTATION_ESTIMATES = Object.freeze({
    contactMs: 36,
    returnSoundMs: 18,
    visualTravelVmin: 0.42,
    note: 'Timing and screen-depth rendering are interaction estimates, not Apollo manufacturing tolerances.'
  });

  function hash32(seed, text) {
    let h = 0x811c9dc5;
    const s = `${seed}|${text}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function bounded(seed, id, lo, hi) {
    const u = hash32(seed, id) / 0xffffffff;
    return lo + (hi - lo) * u;
  }

  const previous = window.AGCDSKY && typeof window.AGCDSKY.hardwarePersonality === 'function'
    ? window.AGCDSKY.hardwarePersonality
    : null;

  function build() {
    const base = previous ? previous() : {seed:'6d2b79f5', lamps:{}, keys:{}};
    const seed = base && base.seed ? String(base.seed) : '6d2b79f5';
    const keys = {};
    const baseKeys = base && base.keys ? base.keys : {};

    for (const button of document.querySelectorAll('[data-key]')) {
      const key = button.dataset.key || '?';
      const old = baseKeys[key] || {};
      const springRate = bounded(seed, `key:${key}:compression-spring-rate`,
        COMPRESSION_SPRING.rateLbPerInMin, COMPRESSION_SPRING.rateLbPerInMax);
      const springIncrementAtActuationOz = springRate * ASSEMBLY.actuationTravelIn * 16;
      const springIncrementAtBottomOz = springRate * ASSEMBLY.totalTravelIn * 16;

      // Keep the existing on-screen depth calibration, but stop pretending its
      // small per-key spread is a documented hardware tolerance.
      button.style.setProperty('--key-travel', `${PRESENTATION_ESTIMATES.visualTravelVmin}vmin`);
      button.dataset.keyStrokeIn = ASSEMBLY.totalTravelIn.toFixed(4);
      button.dataset.keyActuationIn = ASSEMBLY.actuationTravelIn.toFixed(4);
      button.dataset.keySpringRate = springRate.toFixed(3);

      keys[key] = Object.freeze({
        ...old,
        contactMs: PRESENTATION_ESTIMATES.contactMs,
        returnSoundMs: PRESENTATION_ESTIMATES.returnSoundMs,
        travelVmin: PRESENTATION_ESTIMATES.visualTravelVmin,
        springRateLbPerIn: Number(springRate.toFixed(3)),
        springIncrementAtActuationOz: Number(springIncrementAtActuationOz.toFixed(2)),
        springIncrementAtBottomOz: Number(springIncrementAtBottomOz.toFixed(2)),
        totalFingerForceOz: null,
        assembly: ASSEMBLY,
        compressionSpring: COMPRESSION_SPRING,
        sensitiveSwitch: SENSITIVE_SWITCH,
        keyEl: KEY_EL,
        springForceEnvelope: SPRING_FORCE_ENVELOPE,
        estimateFields: Object.freeze(['contactMs','returnSoundMs','travelVmin','makePitch','returnPitch','soundGain'])
      });
    }

    return Object.freeze({
      ...base,
      keys:Object.freeze(keys),
      keyMechanicalSpec:Object.freeze({
        assembly:ASSEMBLY,
        compressionSpring:COMPRESSION_SPRING,
        sensitiveSwitch:SENSITIVE_SWITCH,
        keyEl:KEY_EL,
        springForceEnvelope:SPRING_FORCE_ENVELOPE,
        presentationEstimates:PRESENTATION_ESTIMATES,
        variationPolicy:'Only documented bounded spring-rate range is varied per key; acceptance maxima/minima are retained as envelopes, not sampled distributions.',
        forcePolicy:'Only source-derivable spring force increments are reported. Total finger force remains unresolved until installed preload and complete lever/friction geometry are source-backed.'
      })
    });
  }

  let cached = null;
  const get = () => cached || (cached = build());
  window.AGCDSKY = window.AGCDSKY || {};
  window.AGCDSKY.hardwarePersonality = get;
  window.AGCDSKY.keyMechanicalSpec = () => get().keyMechanicalSpec;
  get();
})();