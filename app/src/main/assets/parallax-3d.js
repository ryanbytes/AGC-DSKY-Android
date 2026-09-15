'use strict';

/*
 * Lightweight presentation-only parallax controller.
 *
 * - fine pointer: follows the cursor over the DSKY
 * - touch: samples the contact position without consuming the event
 * - device orientation: relative motion from the first sensor sample
 * - no input: uses a tiny static bias so depth is still visible on a mounted Fire
 * - Dream/display-only/screen-only/reduced-motion: flat and inactive
 *
 * No AGC, relay, channel, keycode, or persistence state is touched here.
 */
(() => {
  if (window.__DSKY_PARALLAX_3D__) return;
  window.__DSKY_PARALLAX_3D__ = true;

  const dsky = document.getElementById('dsky');
  if (!dsky || !document.body) return;

  let glassSheen = dsky.querySelector('.el-glass-sheen');
  if (!glassSheen) {
    glassSheen = document.createElement('div');
    glassSheen.className = 'el-glass-sheen';
    glassSheen.setAttribute('aria-hidden', 'true');
    dsky.appendChild(glassSheen);
  }

  const reduceMotion = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const finePointer = typeof matchMedia === 'function'
    ? matchMedia('(hover: hover) and (pointer: fine)')
    : null;

  const STATIC_X = 0.055;
  const STATIC_Y = -0.040;
  const MAX_ROTATE_Y_DEG = 1.80;
  const MAX_ROTATE_X_DEG = 1.55;
  const MAX_SENSOR_DELTA_DEG = 12;

  let targetX = STATIC_X;
  let targetY = STATIC_Y;
  let currentX = STATIC_X;
  let currentY = STATIC_Y;
  let frameId = 0;
  let source = 'static';
  let orientationBase = null;
  let touchReleaseTimer = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function presentationAllowed() {
    if (reduceMotion && reduceMotion.matches) return false;
    const body = document.body;
    return !body.classList.contains('dream')
      && !body.classList.contains('display-only')
      && !body.classList.contains('screen-only');
  }

  function setPresentationClass() {
    document.body.classList.toggle('parallax-3d', presentationAllowed());
  }

  function apply() {
    const allowed = presentationAllowed();
    const x = allowed ? currentX : 0;
    const y = allowed ? currentY : 0;
    const tiltX = -y * MAX_ROTATE_X_DEG;
    const tiltY = x * MAX_ROTATE_Y_DEG;
    const parallaxX = x * 1.8;
    const parallaxY = y * 1.8;
    const lightX = 50 + x * 16;
    const lightY = 45 + y * 14;
    const shadowX = -x * 3.2;
    const shadowY = 5.0 - y * 1.8;

    dsky.style.setProperty('--dsky-tilt-x', `${tiltX.toFixed(3)}deg`);
    dsky.style.setProperty('--dsky-tilt-y', `${tiltY.toFixed(3)}deg`);
    dsky.style.setProperty('--dsky-parallax-x', parallaxX.toFixed(3));
    dsky.style.setProperty('--dsky-parallax-y', parallaxY.toFixed(3));
    dsky.style.setProperty('--dsky-light-x', `${lightX.toFixed(2)}%`);
    dsky.style.setProperty('--dsky-light-y', `${lightY.toFixed(2)}%`);
    dsky.style.setProperty('--dsky-shadow-x', `${shadowX.toFixed(2)}px`);
    dsky.style.setProperty('--dsky-shadow-y', `${shadowY.toFixed(2)}px`);
  }

  function scheduleFrame() {
    if (frameId) return;
    const raf = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
    frameId = raf(step);
  }

  function step() {
    frameId = 0;
    const allowed = presentationAllowed();
    const tx = allowed ? targetX : 0;
    const ty = allowed ? targetY : 0;
    currentX += (tx - currentX) * 0.18;
    currentY += (ty - currentY) * 0.18;
    if (Math.abs(tx - currentX) < 0.0008) currentX = tx;
    if (Math.abs(ty - currentY) < 0.0008) currentY = ty;
    setPresentationClass();
    apply();
    if (currentX !== tx || currentY !== ty) scheduleFrame();
  }

  function setTarget(x, y, nextSource) {
    targetX = clamp(x, -1, 1);
    targetY = clamp(y, -1, 1);
    source = nextSource || source;
    scheduleFrame();
  }

  function pointToNormalized(clientX, clientY, gain = 1) {
    const rect = dsky.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1) * gain,
      y: clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1) * gain
    };
  }

  function onPointerMove(event) {
    if (!finePointer || !finePointer.matches || !presentationAllowed()) return;
    const p = pointToNormalized(event.clientX, event.clientY, 0.82);
    if (p) setTarget(p.x, p.y, 'pointer');
  }

  function onPointerDown(event) {
    if ((finePointer && finePointer.matches) || !presentationAllowed()) return;
    const p = pointToNormalized(event.clientX, event.clientY, 0.32);
    if (!p) return;
    setTarget(p.x, p.y, 'touch');
    clearTimeout(touchReleaseTimer);
    touchReleaseTimer = setTimeout(() => setTarget(STATIC_X, STATIC_Y, 'static'), 850);
  }

  function onPointerLeave() {
    if (finePointer && finePointer.matches) setTarget(STATIC_X, STATIC_Y, 'static');
  }

  function onDeviceOrientation(event) {
    if (!presentationAllowed()) return;
    const beta = Number(event.beta);
    const gamma = Number(event.gamma);
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    if (!orientationBase) {
      orientationBase = {beta, gamma};
      return;
    }
    const dx = clamp((gamma - orientationBase.gamma) / MAX_SENSOR_DELTA_DEG, -1, 1);
    const dy = clamp((beta - orientationBase.beta) / MAX_SENSOR_DELTA_DEG, -1, 1);
    if (Math.abs(dx) < 0.012 && Math.abs(dy) < 0.012) return;
    setTarget(dx * 0.72, dy * 0.62, 'orientation');
  }

  function flatten() {
    orientationBase = null;
    targetX = presentationAllowed() ? STATIC_X : 0;
    targetY = presentationAllowed() ? STATIC_Y : 0;
    scheduleFrame();
  }

  dsky.addEventListener('pointermove', onPointerMove, {passive:true});
  dsky.addEventListener('pointerdown', onPointerDown, {passive:true});
  dsky.addEventListener('pointerleave', onPointerLeave, {passive:true});
  window.addEventListener('deviceorientation', onDeviceOrientation, {passive:true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      targetX = 0;
      targetY = 0;
      scheduleFrame();
    } else {
      flatten();
    }
  });

  if (reduceMotion) {
    const onMotionPreference = () => flatten();
    if (typeof reduceMotion.addEventListener === 'function') reduceMotion.addEventListener('change', onMotionPreference);
    else if (typeof reduceMotion.addListener === 'function') reduceMotion.addListener(onMotionPreference);
  }

  if (typeof MutationObserver === 'function') {
    new MutationObserver(flatten).observe(document.body, {attributes:true, attributeFilter:['class']});
  }

  const controller = Object.freeze({
    enabled:() => presentationAllowed(),
    source:() => source,
    reset:() => setTarget(STATIC_X, STATIC_Y, 'static'),
    state:() => Object.freeze({
      enabled:presentationAllowed(),
      source,
      x:currentX,
      y:currentY,
      targetX,
      targetY
    })
  });
  window.AGCDSKY_PARALLAX = controller;
  if (window.AGCDSKY) window.AGCDSKY.parallax3d = controller;

  setPresentationClass();
  apply();
})();
