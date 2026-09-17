'use strict';

/*
 * Static DSKY display-glass geometry.
 *
 * The historical filename is retained so packaged/PWA caches do not need a
 * coordinated asset migration. Visual parallax itself is intentionally gone:
 * this module does not consume attitude sensors, browser orientation events,
 * pointer or touch input, does not create motion controls, and never moves the
 * EL panel.
 *
 * Drawing-backed 2004745 cover-glass dimensions remain available for the
 * fixed glass/depth presentation and diagnostics.
 */
(() => {
  if (window.__DSKY_DISPLAY_GLASS__) return;
  window.__DSKY_DISPLAY_GLASS__ = true;

  const dsky = document.getElementById('dsky');
  const elPanel = document.getElementById('elpanel');
  const registry = window.AGCDSKY_SERVICE_REGISTRY;
  if (!dsky || !elPanel || !document.body || !registry) return;

  const GLASS_CLEAR_WIDTH_IN = 2.354;
  const GLASS_EDGE_THICKNESS_IN = 0.109;
  const GLASS_CENTER_RISE_IN = 0.025;
  const GLASS_VIEW_THICKNESS_IN = GLASS_EDGE_THICKNESS_IN + GLASS_CENTER_RISE_IN;

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

  let physicalGlassWidthPx = 0;
  let physicalPxPerIn = 0;
  let physicalGlassDepthPx = 0;
  let physicalGlassEdgeDepthPx = 0;
  let physicalGlassCenterRisePx = 0;
  let geometryFrame = 0;

  function updatePhysicalDepth() {
    geometryFrame = 0;
    const reference = glassFront || elPanel;
    const rect = reference.getBoundingClientRect();
    const widthPx = Number(reference.offsetWidth) || rect.width || 0;
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

    dsky.style.setProperty('--dsky-glass-depth-px', `${glassDepthPx.toFixed(3)}px`);
    dsky.style.setProperty('--dsky-glass-edge-depth-px', `${edgeDepthPx.toFixed(3)}px`);
    dsky.style.setProperty('--dsky-glass-center-rise-px', `${centerRisePx.toFixed(3)}px`);
  }

  function scheduleGeometry() {
    if (geometryFrame) return;
    const raf = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
    geometryFrame = raf(updatePhysicalDepth);
  }

  /* Remove preferences that belonged only to the retired motion feature. */
  try {
    localStorage.removeItem('dskyParallaxTiltPct');
    localStorage.removeItem('dskyParallaxDepthPct');
  } catch (_) {}

  document.body.classList.remove('parallax-3d', 'parallax-user-motion');
  window.addEventListener('resize', scheduleGeometry, {passive:true});
  if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleGeometry).observe(glassFront);
  scheduleGeometry();

  const geometry = () => Object.freeze({
    glassClearWidthIn: GLASS_CLEAR_WIDTH_IN,
    glassEdgeThicknessIn: GLASS_EDGE_THICKNESS_IN,
    glassCenterRiseIn: GLASS_CENTER_RISE_IN,
    glassViewThicknessIn: GLASS_VIEW_THICKNESS_IN,
    renderedGlassWidthPx: physicalGlassWidthPx,
    pxPerIn: physicalPxPerIn,
    glassDepthPx: physicalGlassDepthPx,
    glassEdgeDepthPx: physicalGlassEdgeDepthPx,
    glassCenterRisePx: physicalGlassCenterRisePx
  });

  /* Registered compatibility service only. There is no motion controller. */
  registry.publish('AGCDSKY_PARALLAX', Object.freeze({
    state: () => Object.freeze({
      enabled:false, source:'removed', nativeActive:false,
      x:0, y:0, targetX:0, targetY:0, tiltPercent:0, depthPercent:0
    }),
    geometry
  }), 'retired parallax diagnostic compatibility');
})();
