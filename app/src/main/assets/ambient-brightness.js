(() => {
  'use strict';

  const button = document.getElementById('auto-brightness');
  const bridge = window.BrightnessBridge;
  const api = window.AGCDSKY = window.AGCDSKY || {};
  let state = {
    supported: !!bridge,
    enabled: false,
    active: false,
    source: bridge ? 'waiting' : 'unavailable',
    lux: null,
    brightness: null
  };

  function parseStatus(value) {
    if (!value) return null;
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function render(next) {
    if (next) state = Object.assign({}, state, next);
    if (!button) return;
    button.setAttribute('aria-pressed', state.enabled ? 'true' : 'false');
    if (!bridge) {
      button.textContent = 'AUTO BRIGHTNESS NATIVE ONLY';
      button.disabled = true;
      return;
    }
    if (!state.supported) {
      button.textContent = 'AUTO BRIGHTNESS NO SENSOR';
      button.disabled = true;
      return;
    }
    button.disabled = false;
    if (!state.enabled) {
      button.textContent = 'AUTO BRIGHTNESS OFF';
      return;
    }
    if (Number.isFinite(Number(state.lux))) {
      button.textContent = `AUTO BRIGHTNESS ON · ${Math.round(Number(state.lux))} LX`;
      return;
    }
    button.textContent = 'AUTO BRIGHTNESS ON · WAITING';
  }

  function refresh() {
    if (!bridge || typeof bridge.getStatus !== 'function') {
      render({supported:false, enabled:false, active:false, source:'unavailable'});
      return Object.assign({}, state);
    }
    const next = parseStatus(bridge.getStatus());
    if (next) render(next);
    return Object.assign({}, state);
  }

  if (button) {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!bridge || !state.supported || typeof bridge.setEnabled !== 'function') return;
      bridge.setEnabled(!state.enabled);
      setTimeout(refresh, 80);
    }, true);
  }

  api.nativeAmbientBrightnessStatus = value => {
    const next = parseStatus(value);
    if (next) render(next);
  };
  api.ambientBrightnessStatus = () => Object.assign({}, state);
  api.setAmbientBrightnessEnabled = enabled => {
    if (!bridge || typeof bridge.setEnabled !== 'function') return false;
    bridge.setEnabled(!!enabled);
    setTimeout(refresh, 80);
    return true;
  };
  api.refreshAmbientBrightness = refresh;

  refresh();
})();
