'use strict';

/*
 * Lightweight presentation-only parallax controller.
 *
 * - native Android quaternion: primary motion source in the packaged app
 * - device orientation: browser/PWA fallback
 * - fine pointer: follows the cursor over the DSKY
 * - touch: samples the contact position without consuming the event
 * - no input: uses a tiny static bias so depth is still visible on a mounted Fire
 * - Dream/display-only/reduced-motion: flat and inactive; screen-only keeps EL depth
 *
 * Display-glass depth is scaled from drawing 2004745 geometry documented in
 * docs/DISPLAY_GLASS_GEOMETRY.md.  The external laminated panel has a
 * 2.354-in raised clear-view width, 0.109-in edge thickness, and a 0.025-in
 * raised central face, for 0.134 in from rear face to central viewing face.
 *
 * The 0.257/0.263-in SCD 1006315 dimension is the sealed digital-indicator
 * package thickness and is intentionally NOT used as cover-glass depth.
 *
 * No AGC, relay, channel, keycode, or persistence state is touched here.
 */
(() => {
  if (window.__DSKY_PARALLAX_3D__) return;
  window.__DSKY_PARALLAX_3D__ = true;

  const dsky = document.getElementById('dsky');
  if (!dsky || !document.body) return;
  const api = window.AGCDSKY = window.AGCDSKY || {};
  const elPanel = document.getElementById('elpanel');

  let glassFront = dsky.querySelector('.el-glass-sheen');
  if (!glassFront) {
    glassFront = document.createElement('div');
    glassFront.className = 'el-glass-sheen';
    glassFront.setAttribute('aria-hidden', 'true');
    dsky.appendChild(glassFront);
  }

  let glassRear = dsky.querySelector('.el-glass-rear');
  if (!glassRear) {
    glassRear = document.createElement('div');
    glassRear.className = 'el-glass-rear';
    glassRear.setAttribute('aria-hidden', 'true');
    dsky.insertBefore(glassRear, glassFront);
  }

  const reduceMotion = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const finePointer = typeof matchMedia === 'function'
    ? matchMedia('(hover: hover) and (pointer: fine)')
    : null;

  const STATIC_X = 0.075;
  const STATIC_Y = -0.055;
  const MAX_ROTATE_Y_DEG = 4.20;
  const MAX_ROTATE_X_DEG = 3.60;
  const MAX_SENSOR_DELTA_DEG = 8;
  const NATIVE_PRIORITY_MS = 600;

  // Drawing-accurate 2004745 reconstructed glass geometry, in inches.
  const GLASS_CLEAR_WIDTH_IN = 2.354;
  const GLASS_EDGE_THICKNESS_IN = 0.109;
  const GLASS_CENTER_RISE_IN = 0.025;
  const GLASS_VIEW_THICKNESS_IN = GLASS_EDGE_THICKNESS_IN + GLASS_CENTER_RISE_IN;

  let physicalGlassWidthPx = 0;
  let physicalPxPerIn = 0;
  let physicalGlassDepthPx = 0;
  let physicalGlassEdgeDepthPx = 0;
  let physicalGlassCenterRisePx = 0;

  let targetX = STATIC_X;
  let targetY = STATIC_Y;
  let currentX = STATIC_X;
  let currentY = STATIC_Y;
  let frameId = 0;
  let source = 'static';
  let orientationBase = null;
  let nativeBaseQ = null;
  let nativeDisplayAngle = null;
  let nativeSeenAt = 0;
  let touchReleaseTimer = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function presentationAllowed() {
    if (reduceMotion && reduceMotion.matches) return false;
    const body = document.body;
    return !body.classList.contains('dream')
      && !body.classList.contains('display-only');
  }

  function setPresentationClass() {
    document.body.classList.toggle('parallax-3d', presentationAllowed());
  }

  function updatePhysicalDepth() {
    const reference = glassFront || elPanel;
    if (!reference) return;
    const widthPx = Number(reference.offsetWidth) || reference.getBoundingClientRect().width || 0;
    if (!(widthPx > 0)) return;

    const pxPerIn = widthPx / GLASS_CLEAR_WIDTH_IN;
    const edgeDepthPx = pxPerIn * GLASS_EDGE_THICKNESS_IN;
    const centerRisePx = pxPerIn * GLASS_CENTER_RISE_IN;
    const glassDepthPx = edgeDepthPx + centerRisePx;

    physicalGlassWidthPx = widthPx;
    physicalPxPerIn = pxPerIn;
    physicalGlassDepthPx = glassDepthPx;
    physicalGlassEdgeDepthPx = edgeDepthPx;
    physicalGlassCenterRisePx = centerRisePx;

    // Front central glass surface is the Z datum.  The rear glass interface
    // and bonded EL face sit one physical 2004745 viewing thickness behind it.
    dsky.style.setProperty('--dsky-glass-rear-z', `${(-glassDepthPx).toFixed(3)}px`);
    dsky.style.setProperty('--dsky-el-z', `${(-glassDepthPx).toFixed(3)}px`);
    dsky.style.setProperty('--dsky-glass-depth-px', `${glassDepthPx.toFixed(3)}px`);
    dsky.style.setProperty('--dsky-glass-edge-depth-px', `${edgeDepthPx.toFixed(3)}px`);
    dsky.style.setProperty('--dsky-glass-center-rise-px', `${centerRisePx.toFixed(3)}px`);
  }

  function apply() {
    const allowed = presentationAllowed();
    const x = allowed ? currentX : 0;
    const y = allowed ? currentY : 0;
    const tiltX = -y * MAX_ROTATE_X_DEG;
    const tiltY = x * MAX_ROTATE_Y_DEG;
    const parallaxX = x * 3.8;
    const parallaxY = y * 3.8;
    const lightX = 50 + x * 28;
    const lightY = 45 + y * 24;
    const shadowX = -x * 7.0;
    const shadowY = 6.0 - y * 3.2;

    dsky.style.setProperty('--dsky-tilt-x', `${tiltX.toFixed(3)}deg`);
    dsky.style.setProperty('--dsky-tilt-y', `${tiltY.toFixed(3)}deg`);
    dsky.style.setProperty('--dsky-parallax-x', parallaxX.toFixed(3));
    dsky.style.setProperty('--dsky-parallax-y', parallaxY.toFixed(3));
    const setPx = (name, value) => dsky.style.setProperty(name, `${value.toFixed(2)}px`);
    setPx('--dsky-recess-x', parallaxX * -0.55);
    setPx('--dsky-recess-y', parallaxY * -0.55);
    setPx('--dsky-ann-x', parallaxX * 0.65);
    setPx('--dsky-ann-y', parallaxY * 0.65);
    setPx('--dsky-key-x', parallaxX * 1.25);
    setPx('--dsky-key-y', parallaxY * 1.25);
    setPx('--dsky-key-pressed-x', parallaxX * 0.72);
    setPx('--dsky-key-pressed-y', parallaxY * 0.72);
    setPx('--dsky-fastener-x', parallaxX * 0.45);
    setPx('--dsky-fastener-y', parallaxY * 0.45);
    setPx('--dsky-glass-shadow-dark-x', parallaxX * 1.15);
    setPx('--dsky-glass-shadow-dark-y', parallaxY * 1.10);
    setPx('--dsky-glass-shadow-light-x', parallaxX * -0.55);
    setPx('--dsky-glass-shadow-light-y', parallaxY * -0.50);
    setPx('--dsky-edge-dark-x', parallaxX * 0.95);
    setPx('--dsky-edge-dark-y', parallaxY * 0.90);
    setPx('--dsky-edge-light-x', parallaxX * -0.40);
    setPx('--dsky-edge-light-y', parallaxY * -0.36);
    setPx('--dsky-fs-shadow-dark-x', parallaxX * 1.55);
    setPx('--dsky-fs-shadow-dark-y', parallaxY * 1.45);
    setPx('--dsky-fs-shadow-light-x', parallaxX * -0.72);
    setPx('--dsky-fs-shadow-light-y', parallaxY * -0.66);
    setPx('--dsky-fs-edge-dark-x', parallaxX * 1.30);
    setPx('--dsky-fs-edge-dark-y', parallaxY * 1.20);
    setPx('--dsky-fs-edge-light-x', parallaxX * -0.55);
    setPx('--dsky-fs-edge-light-y', parallaxY * -0.48);
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
    currentX += (tx - currentX) * 0.24;
    currentY += (ty - currentY) * 0.24;
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

  function qMul(a, b) {
    return [
      a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
      a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
      a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
      a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0]
    ];
  }

  function qNorm(q) {
    const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    return q.map(v => v / n);
  }

  function qConj(q) {
    return [q[0], -q[1], -q[2], -q[3]];
  }

  function qScreenRotation(angleDeg) {
    const half = (-angleDeg * Math.PI / 180) / 2;
    return [Math.cos(half), 0, 0, Math.sin(half)];
  }

  function screenAdjustedQuaternion(w, x, y, z, displayAngle) {
    const angle = Number.isFinite(Number(displayAngle))
      ? ((Number(displayAngle) % 360) + 360) % 360
      : 0;
    let q = qNorm([Number(w), Number(x), Number(y), Number(z)]);
    q = qNorm(qMul(q, qScreenRotation(angle)));
    return {q, angle};
  }

  function eulerXY(q) {
    const [w,x,y,z] = q;
    const sinr = 2 * (w*x + y*z);
    const cosr = 1 - 2 * (x*x + y*y);
    const roll = Math.atan2(sinr, cosr) * 180 / Math.PI;
    const pitch = Math.asin(clamp(2 * (w*y - z*x), -1, 1)) * 180 / Math.PI;
    return [roll, pitch];
  }

  function onNativeQuaternion(w, x, y, z, displayAngle = 0) {
    if (!presentationAllowed()) return;
    if (![w,x,y,z].map(Number).every(Number.isFinite)) return;
    const sample = screenAdjustedQuaternion(w, x, y, z, displayAngle);
    const now = performance.now();
    if (!nativeBaseQ || nativeDisplayAngle !== sample.angle || now - nativeSeenAt > 1500) {
      nativeBaseQ = sample.q;
      nativeDisplayAngle = sample.angle;
      nativeSeenAt = now;
      return;
    }
    nativeSeenAt = now;
    const rel = qNorm(qMul(qConj(nativeBaseQ), sample.q));
    const [roll, pitch] = eulerXY(rel);
    const dx = clamp(pitch / MAX_SENSOR_DELTA_DEG, -1, 1);
    const dy = clamp(roll / MAX_SENSOR_DELTA_DEG, -1, 1);
    if (Math.abs(dx) < 0.006 && Math.abs(dy) < 0.006) return;
    setTarget(dx, dy, 'native-quaternion');
  }

  function installNativeQuaternionTap() {
    const prior = api.nativePhoneQuaternion;
    if (typeof prior !== 'function' || prior.__dskyParallaxWrapped) return false;
    const wrapped = function(w,x,y,z,displayAngle) {
      prior.call(api, w,x,y,z,displayAngle);
      try { onNativeQuaternion(w,x,y,z,displayAngle); } catch (_) {}
    };
    try { Object.defineProperty(wrapped, '__dskyParallaxWrapped', {value:true}); }
    catch (_) { wrapped.__dskyParallaxWrapped = true; }
    api.nativePhoneQuaternion = wrapped;
    return true;
  }

  function onPointerMove(event) {
    if (!finePointer || !finePointer.matches || !presentationAllowed()) return;
    const p = pointToNormalized(event.clientX, event.clientY, 1.0);
    if (p) setTarget(p.x, p.y, 'pointer');
  }

  function onPointerDown(event) {
    if ((finePointer && finePointer.matches) || !presentationAllowed()) return;
    const p = pointToNormalized(event.clientX, event.clientY, 0.70);
    if (!p) return;
    setTarget(p.x, p.y, 'touch');
    clearTimeout(touchReleaseTimer);
    touchReleaseTimer = setTimeout(() => setTarget(STATIC_X, STATIC_Y, 'static'), 1300);
  }

  function onPointerLeave() {
    if (finePointer && finePointer.matches) setTarget(STATIC_X, STATIC_Y, 'static');
  }

  function onDeviceOrientation(event) {
    if (!presentationAllowed()) return;
    if (performance.now() - nativeSeenAt < NATIVE_PRIORITY_MS) return;
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
    setTarget(dx, dy * 0.90, 'deviceorientation');
  }

  function refreshPhysicalDepthSoon() {
    const raf = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
    raf(updatePhysicalDepth);
  }

  function flatten() {
    orientationBase = null;
    nativeBaseQ = null;
    nativeDisplayAngle = null;
    targetX = presentationAllowed() ? STATIC_X : 0;
    targetY = presentationAllowed() ? STATIC_Y : 0;
    refreshPhysicalDepthSoon();
    scheduleFrame();
  }

  dsky.addEventListener('pointermove', onPointerMove, {passive:true});
  dsky.addEventListener('pointerdown', onPointerDown, {passive:true});
  dsky.addEventListener('pointerleave', onPointerLeave, {passive:true});
  window.addEventListener('deviceorientation', onDeviceOrientation, {passive:true});
  window.addEventListener('resize', refreshPhysicalDepthSoon, {passive:true});
  installNativeQuaternionTap();
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

  if (typeof ResizeObserver === 'function') {
    if (glassFront) new ResizeObserver(updatePhysicalDepth).observe(glassFront);
    else if (elPanel) new ResizeObserver(updatePhysicalDepth).observe(elPanel);
  }

  const controller = Object.freeze({
    enabled:() => presentationAllowed(),
    source:() => source,
    nativeActive:() => performance.now() - nativeSeenAt < NATIVE_PRIORITY_MS,
    reset:() => setTarget(STATIC_X, STATIC_Y, 'static'),
    geometry:() => Object.freeze({
      glassClearWidthIn:GLASS_CLEAR_WIDTH_IN,
      glassEdgeThicknessIn:GLASS_EDGE_THICKNESS_IN,
      glassCenterRiseIn:GLASS_CENTER_RISE_IN,
      glassViewThicknessIn:GLASS_VIEW_THICKNESS_IN,
      renderedGlassWidthPx:physicalGlassWidthPx,
      pxPerIn:physicalPxPerIn,
      glassDepthPx:physicalGlassDepthPx,
      glassEdgeDepthPx:physicalGlassEdgeDepthPx,
      glassCenterRisePx:physicalGlassCenterRisePx
    }),
    state:() => Object.freeze({
      enabled:presentationAllowed(),
      source,
      nativeActive:performance.now() - nativeSeenAt < NATIVE_PRIORITY_MS,
      x:currentX,
      y:currentY,
      targetX,
      targetY
    })
  });
  window.AGCDSKY_PARALLAX = controller;
  api.parallax3d = controller;

  setPresentationClass();
  updatePhysicalDepth();
  apply();
})();
