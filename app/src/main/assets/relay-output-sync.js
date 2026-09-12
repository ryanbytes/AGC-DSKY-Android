'use strict';

/*
 * Android relay audio / visible-paint synchronization.
 *
 * hardware-fidelity.js remains authoritative for the electrical model: the
 * latching bank commits at the documented 20-ms drive/settle boundary. On
 * Android, relay impact audio is routed through an in-memory SoundPool bridge
 * when available so it does not inherit WebView/WebAudio's large output buffer.
 * WebAudio remains the exact fallback used by non-Android builds.
 *
 * Presentation timing never changes yaAGC state or relay latch timing. It only
 * holds relay-driven DOM paint long enough for the physical click to reach the
 * speaker before the EL/annunciator transition is shown.
 */
(() => {
  const WEB_AUDIO_GUARD_MS = 120;
  const NATIVE_AUDIO_GUARD_MS = 60;
  const RELAY_SETTLE_MS = 20;
  const LATCHING_RELAY_COUNT = 132;
  const AUX_ORDER = Object.freeze([
    'comp', 'uplink', 'temp', 'keyrel',
    'oprerr', 'flash', 'restart', 'stby'
  ]);
  const AUX_LABEL = Object.freeze({
    comp: 'COMP-ACTY', uplink: 'UPLINK-ACTY', temp: 'TEMP',
    keyrel: 'KEY-REL', oprerr: 'OPR-ERR', flash: 'FLASH',
    restart: 'RESTART', stby: 'STBY'
  });

  function nativeRelayAudioReady() {
    try { return !!(window.RelayAudioBridge && RelayAudioBridge.isReady()); }
    catch (_) { return false; }
  }

  function presentationAudioGuardMs() {
    return nativeRelayAudioReady() ? NATIVE_AUDIO_GUARD_MS : WEB_AUDIO_GUARD_MS;
  }

  function presentationVisualDelayMs() {
    return RELAY_SETTLE_MS + presentationAudioGuardMs();
  }

  /*
   * relay-identity-audio.js has already installed the deterministic per-relay
   * mechanical model by the time this file loads. Keep that implementation as
   * the WebAudio fallback, but on Android use the exported relay profiles to
   * schedule the same armature travel/contact-bounce chronology in SoundPool.
   */
  const webAudioEmitTick = emitTick;
  const identityHardware = window.AGCDSKY &&
    typeof window.AGCDSKY.hardware === 'function' ?
    window.AGCDSKY.hardware.bind(window.AGCDSKY) : null;

  function hardwareSnapshot() {
    try { return identityHardware ? identityHardware() : null; }
    catch (_) { return null; }
  }

  let lastNativeAux = Object.assign({},
    hardwareSnapshot() && hardwareSnapshot().auxRelays || {});

  function syncNativeAux() {
    const state = hardwareSnapshot();
    if (state && state.auxRelays) lastNativeAux = Object.assign({}, state.auxRelays);
  }

  const soundButton = document.getElementById('sound');
  if (soundButton) {
    soundButton.addEventListener('click', syncNativeAux, true);
    soundButton.addEventListener('click', () => setTimeout(syncNativeAux, 0));
  }
  setInterval(() => {
    try { if (typeof tickSound === 'boolean' && !tickSound) syncNativeAux(); }
    catch (_) {}
  }, 250);

  function changedAux(state) {
    const changes = [];
    const next = state && state.auxRelays || {};
    for (const name of AUX_ORDER) {
      const before = !!lastNativeAux[name];
      const after = !!next[name];
      if (before !== after) changes.push({name, on: after});
    }
    lastNativeAux = Object.assign({}, next);
    return changes;
  }

  function closestBit(deltaMs, settle) {
    let best = -1, error = Infinity;
    for (let bit = 0; bit < settle.length; bit++) {
      const e = Math.abs(deltaMs - Number(settle[bit]));
      if (e < error) { error = e; best = bit; }
    }
    return error <= 1.2 ? best : -1;
  }

  function relayOrdinal(row, bit) {
    return (row - 1) * 11 + bit;
  }

  function auxOrdinal(name) {
    const index = AUX_ORDER.indexOf(name);
    return LATCHING_RELAY_COUNT + Math.max(0, index);
  }

  function playNativeRelay(ctx, p, id, ordinal, engaging, strength, impactWhen) {
    try {
      const delayMs = Math.max(0, (impactWhen - ctx.currentTime) * 1000);
      const bounces = engaging ? p.setBounceTimesMs : p.resetBounceTimesMs;
      RelayAudioBridge.playRelay(
        id, ordinal, !!engaging, Number(strength) || 1,
        delayMs, Array.isArray(bounces) ? bounces.join(',') : ''
      );
      return true;
    } catch (_) { return false; }
  }

  emitTick = function androidNativeDskyRelayClick(
    ctx, when = ctx.currentTime, strength = 1
  ) {
    const relayModel = window.DSKY_RELAY_AUDIO;
    const state = hardwareSnapshot();
    if (!nativeRelayAudioReady() || !relayModel || !state) {
      const out = webAudioEmitTick(ctx, when, strength);
      syncNativeAux();
      return out;
    }

    const auxChanges = changedAux(state);
    if (auxChanges.length) {
      auxChanges.forEach((change, i) => {
        const p = relayModel.auxiliaryProfileFor(change.name);
        if (!p) return;
        const id = `AUX:${AUX_LABEL[change.name] || change.name.toUpperCase()}`;
        const travelMs = change.on ? p.setTravelMs : p.resetTravelMs;
        const individualStrength = change.on ? 0.66 : 0.58;
        playNativeRelay(
          ctx, p, id, auxOrdinal(change.name), change.on,
          individualStrength, when + travelMs / 1000 + i * 0.00008
        );
      });
      return;
    }

    const row = Number(state.activeDrive) || 0;
    const settle = Array.isArray(state.armatureSettleMs) ? state.armatureSettleMs : [];
    if (row >= 1 && row <= 12 && settle.length === 11) {
      const deltaMs = Math.max(0, (when - ctx.currentTime) * 1000);
      const bit = closestBit(deltaMs, settle);
      if (bit >= 0) {
        const target = state.lastWrite ? Number(state.lastWrite.low11) & 0o3777 : 0;
        const engaging = !!(target & (1 << bit));
        const p = relayModel.profileFor(row, bit);
        const id = relayModel.relayIdentity(row, bit);
        if (p && id) {
          const travelMs = engaging ? p.setTravelMs : p.resetTravelMs;
          if (playNativeRelay(
            ctx, p, id, relayOrdinal(row, bit), engaging,
            strength, ctx.currentTime + travelMs / 1000
          )) return;
        }
      }
    }

    return webAudioEmitTick(ctx, when, strength);
  };

  // hardware-fidelity.js asks AudioContext for a presentation estimate. Feed it
  // our chosen guard rather than Android WebView's under-reported value. The
  // actual sound is native when the bridge is ready; the AudioContext remains
  // present only because the existing hardware scheduler passes it to emitTick.
  const nativeEnsureAudio = ensureAudio;
  let nativeContext = null;
  let latencyProxy = null;

  ensureAudio = function relayOutputSynchronizedAudio() {
    const ctx = nativeEnsureAudio();
    if (!ctx) return null;
    if (ctx === latencyProxy) return latencyProxy;
    if (ctx === nativeContext && latencyProxy) return latencyProxy;

    nativeContext = ctx;
    latencyProxy = new Proxy(ctx, {
      get(target, property) {
        if (property === 'baseLatency') return presentationAudioGuardMs() / 1000;
        if (property === 'outputLatency') return 0;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
    audioCtx = latencyProxy;
    return latencyProxy;
  };

  const pendingPaints = new Set();
  function laterPaint(fn) {
    const id = setTimeout(() => {
      pendingPaints.delete(id);
      fn();
    }, presentationVisualDelayMs());
    pendingPaints.add(id);
  }

  function lampState(name) {
    const el = document.querySelector(`[data-lamp="${name}"]`);
    return !!(el && el.classList.contains('on'));
  }

  function restoreLamp(name, on) {
    setLamp(name, !!on);
  }

  function deferChangedLamp(name, before, after) {
    if (before === after) return;
    restoreLamp(name, before);
    laterPaint(() => restoreLamp(name, after));
  }

  const decode11BeforeSync = decodeChannel11;
  decodeChannel11 = function synchronizedDecodeChannel11(value) {
    const beforeComp = lampState('comp');
    const beforeUplink = lampState('uplink');
    const word = value & 0o77777;
    decode11BeforeSync.call(this, value);
    deferChangedLamp('comp', beforeComp, !!(word & 0o00002));
    deferChangedLamp('uplink', beforeUplink, !!(word & 0o00004));
  };

  const decode163BeforeSync = decodeChannel163;
  decode163BeforeSync = decodeChannel163;
