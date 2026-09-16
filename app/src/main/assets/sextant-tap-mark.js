'use strict';

/*
 * Tap-to-mark for the CM sextant view.
 *
 * A short tap inside the 1.8-degree circular field offsets the simulated SXT
 * shaft/trunnion CDU counters to the touched line of sight, waits for those
 * real CDU pulses to be accepted by the running AGC, then issues the normal
 * MARK discrete through navKeyPulse(). Drags never mark.
 */
(() => {
  if (window.__AGCDSKY_SEXTANT_TAP_MARK__) return;
  window.__AGCDSKY_SEXTANT_TAP_MARK__ = true;

  const api = window.AGCDSKY;
  if (!api) throw new Error('AGCDSKY public facade unavailable');
  const COUNTS_PER_DEG = 32768 / 360;
  const SHAFT_CH = 0o200 | 0o36;
  const TRUNNION_CH = 0o200 | 0o35;
  const PCDU = 0o01;
  const MCDU = 0o03;
  const MARK_BIT = 0o40;
  const SXT_FOV_DEG = 1.8;
  const MAX_PULSES_PER_STEP = 8;
  const TAP_DRAG_PX = 16;
  const TAP_MAX_MS = 700;
  const SETTLE_TIMEOUT_MS = 420;

  let pointer = null;
  let markToken = 0;
  let markerTimer = 0;
  let lastMark = null;
  let attachedEye = null;

  const core = () => typeof api.getCore === 'function' ? api.getCore() : null;

  function status(text) {
    const el = document.getElementById('sxt-status');
    if (el) el.textContent = text;
  }

  function resetStatusSoon(delay = 600) {
    setTimeout(() => {
      if (document.getElementById('sxt-view')?.classList.contains('open'))
        status('SXT · MOVE PHONE TO AIM · 1.8°');
    }, delay);
  }

  function pointFromEvent(event, eye = attachedEye) {
    if (!eye) return null;
    const rect = eye.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    if (!(radius > 0)) return null;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = (Number(event.clientX) - cx) / radius;
    const y = (Number(event.clientY) - cy) / radius;
    const distance = Math.hypot(x, y);
    if (!Number.isFinite(distance) || distance > .985) return null;
    return {x, y, distance, screenX:50 + x * 50, screenY:50 + y * 50};
  }

  function ensureMarker(eye) {
    let marker = document.getElementById('sxt-tap-mark');
    if (marker) return marker;
    marker = document.createElement('div');
    marker.id = 'sxt-tap-mark';
    marker.setAttribute('aria-hidden', 'true');
    marker.innerHTML = '<span></span>';
    eye.appendChild(marker);
    return marker;
  }

  function showMarker(point, state = 'aiming') {
    const marker = ensureMarker(attachedEye);
    clearTimeout(markerTimer);
    marker.style.setProperty('--tap-x', `${point.screenX.toFixed(2)}%`);
    marker.style.setProperty('--tap-y', `${point.screenY.toFixed(2)}%`);
    marker.classList.remove('marked', 'busy');
    if (state === 'marked') marker.classList.add('marked');
    if (state === 'busy') marker.classList.add('busy');
    marker.classList.add('active');
    markerTimer = setTimeout(
      () => marker.classList.remove('active', 'marked', 'busy'),
      state === 'marked' ? 900 : 650
    );
  }

  function writePulses(c, channel, counts) {
    return new Promise((resolve, reject) => {
      let left = Math.trunc(counts);
      const step = () => {
        if (!left) { resolve(); return; }
        const sign = left > 0 ? 1 : -1;
        const count = Math.min(Math.abs(left), MAX_PULSES_PER_STEP);
        for (let i = 0; i < count; i++) {
          const rc = c.writeIo(channel, sign > 0 ? PCDU : MCDU);
          if (!(rc > 0)) { reject(new Error('optics input busy')); return; }
          left -= sign;
        }
        setTimeout(step, 4);
      };
      step();
    });
  }

  async function waitForExistingOptics(token) {
    const deadline = performance.now() + SETTLE_TIMEOUT_MS;
    while (token === markToken) {
      const pending = api.sextantStatus?.().pending;
      const busy = pending && (Math.abs(Number(pending.shaft) || 0) + Math.abs(Number(pending.trunnion) || 0) > 0);
      if (!busy) return true;
      if (performance.now() >= deadline) return false;
      await new Promise(resolve => setTimeout(resolve, 8));
    }
    return false;
  }

  async function tapToMark(point) {
    const c = core();
    if (!c || !c.running || typeof c.writeIo !== 'function' || typeof c.navKeyPulse !== 'function') {
      status('SXT · AGC NOT RUNNING');
      showMarker(point, 'busy');
      return false;
    }

    const token = ++markToken;
    const halfFov = SXT_FOV_DEG / 2;
    const shaftOffsetDeg = point.x * halfFov;
    const trunnionOffsetDeg = -point.y * halfFov;
    const shaftCounts = Math.round(shaftOffsetDeg * COUNTS_PER_DEG);
    const trunnionCounts = Math.round(trunnionOffsetDeg * COUNTS_PER_DEG);

    lastMark = {
      timestamp:Date.now(),
      normalized:{x:point.x, y:point.y},
      offsetDeg:{shaft:shaftOffsetDeg, trunnion:trunnionOffsetDeg},
      counts:{shaft:shaftCounts, trunnion:trunnionCounts},
      target:api.sextantStatus?.().target || null,
      state:'aiming'
    };
    showMarker(point, 'aiming');
    status(`SXT · TAP AIM ${shaftOffsetDeg >= 0 ? '+' : ''}${shaftOffsetDeg.toFixed(2)}° / ${trunnionOffsetDeg >= 0 ? '+' : ''}${trunnionOffsetDeg.toFixed(2)}°`);

    try {
      if (!await waitForExistingOptics(token) || token !== markToken) throw new Error('optics input busy');
      await Promise.all([
        writePulses(c, SHAFT_CH, shaftCounts),
        writePulses(c, TRUNNION_CH, trunnionCounts)
      ]);
      if (token !== markToken) return false;
      const ok = c.navKeyPulse(MARK_BIT, 90);
      if (!ok) throw new Error('mark input busy');
      lastMark = {...lastMark, state:'marked', markedAt:Date.now()};
      showMarker(point, 'marked');
      status('SXT · TAP MARK');
      if (typeof api.scheduleAgcAutosave === 'function') api.scheduleAgcAutosave('SXT TAP MARK');
      resetStatusSoon(650);
      return true;
    } catch (_) {
      if (token !== markToken) return false;
      lastMark = {...lastMark, state:'busy'};
      showMarker(point, 'busy');
      status('SXT · TAP MARK INPUT BUSY');
      resetStatusSoon(900);
      return false;
    }
  }

  function begin(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const point = pointFromEvent(event);
    if (!point) return;
    pointer = {
      pointerId:event.pointerId,
      x:Number(event.clientX),
      y:Number(event.clientY),
      started:performance.now()
    };
    try { attachedEye?.setPointerCapture?.(event.pointerId); } catch (_) {}
  }

  function cancel(event) {
    if (!pointer) return;
    if (event && event.pointerId !== undefined && event.pointerId !== pointer.pointerId) return;
    pointer = null;
  }

  function complete(event) {
    const start = pointer;
    if (!start || event.pointerId !== start.pointerId) return;
    pointer = null;
    const travel = Math.hypot(Number(event.clientX) - start.x, Number(event.clientY) - start.y);
    const elapsed = performance.now() - start.started;
    if (travel > TAP_DRAG_PX || elapsed > TAP_MAX_MS) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    tapToMark(point);
  }

  function attach() {
    const eye = document.getElementById('sxt-eyepiece');
    if (!eye || eye === attachedEye) return !!eye;
    attachedEye = eye;
    ensureMarker(eye);
    eye.addEventListener('pointerdown', begin, {passive:true});
    eye.addEventListener('pointerup', complete, {passive:false});
    eye.addEventListener('pointercancel', cancel, {passive:true});
    eye.addEventListener('lostpointercapture', cancel, {passive:true});
    return true;
  }

  function attachWhenReady() {
    if (attach()) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (attach() || ++tries > 40) clearInterval(timer);
    }, 50);
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => setTimeout(attachWhenReady, 0), {once:true});
  else attachWhenReady();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pointer = null; markToken++; }
  });

  window.AGCDSKY_SEXTANT_TAP_MARK = Object.freeze({
    enabled:() => true,
    lastMark:() => lastMark ? JSON.parse(JSON.stringify(lastMark)) : null,
    cancel:() => { pointer = null; markToken++; }
  });
})();
