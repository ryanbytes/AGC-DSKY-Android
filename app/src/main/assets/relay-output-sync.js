'use strict';

/* Android native relay audio + relay-driven paint synchronization. */
(() => {
  const WEB_AUDIO_GUARD_MS = 120;
  const NATIVE_AUDIO_GUARD_MS = 220;
  const RELAY_SETTLE_MS = 20;
  const AUX_ORDER = Object.freeze([
    'comp', 'uplink', 'temp', 'keyrel', 'oprerr', 'flash', 'restart', 'stby'
  ]);
  const AUX_LABEL = Object.freeze({
    comp:'COMP-ACTY', uplink:'UPLINK-ACTY', temp:'TEMP', keyrel:'KEY-REL',
    oprerr:'OPR-ERR', flash:'FLASH', restart:'RESTART', stby:'STBY'
  });

  function nativeReady() {
    try { return !!(window.RelayAudioBridge && RelayAudioBridge.isReady()); }
    catch (_) { return false; }
  }
  function guardMs() { return nativeReady() ? NATIVE_AUDIO_GUARD_MS : WEB_AUDIO_GUARD_MS; }
  function visualDelayMs() { return RELAY_SETTLE_MS + guardMs(); }

  // hardware-fidelity.js intentionally caps its own WebAudio compensation at
  // 120 ms. Native SoundPool on this phone is empirically slower than that, so
  // add only the excess here at the final EL renderer boundary. The electrical
  // latch still commits at 20 ms; this affects presentation only.
  const HARDWARE_PRESENTATION_CAP_MS = 120;
  function nativeElExtraMs() {
    return nativeReady() ? Math.max(0, NATIVE_AUDIO_GUARD_MS - HARDWARE_PRESENTATION_CAP_MS) : 0;
  }
  function recentRelayWrite() {
    const s = snapshot();
    const last = s && s.lastWrite;
    if (!last || Number(last.relay) < 1 || Number(last.relay) > 12) return false;
    const age = performance.now() - Number(last.at);
    return Number.isFinite(age) && age >= 0 && age < 320;
  }

  const baseSet2ForRelaySync = set2;
  set2 = function relaySynchronizedSet2(id, text) {
    const extra = nativeElExtraMs();
    if (extra > 0 && recentRelayWrite() && (id === 'prog' || id === 'verb' || id === 'noun')) {
      const captured = String(text);
      setTimeout(() => baseSet2ForRelaySync(id, captured), extra);
      return;
    }
    return baseSet2ForRelaySync(id, text);
  };

  const baseRenderAgcRegForRelaySync = renderAgcReg;
  renderAgcReg = function relaySynchronizedRenderAgcReg(name) {
    const extra = nativeElExtraMs();
    if (extra > 0 && recentRelayWrite() && (name === 'r1' || name === 'r2' || name === 'r3')) {
      const r = agcDisplay[name];
      const sign = regSign(r);
      const digits = r.digits.join('');
      setTimeout(() => setReg(name, sign, digits), extra);
      return;
    }
    return baseRenderAgcRegForRelaySync(name);
  };

  // relay-identity-audio.js already owns deterministic relay profiles. Replace
  // only its final sound emitter when Android's native low-latency bridge is ready.
  const webAudioEmitTick = emitTick;
  const identityHardware = window.AGCDSKY && typeof window.AGCDSKY.hardware === 'function'
    ? window.AGCDSKY.hardware.bind(window.AGCDSKY) : null;
  function snapshot() { try { return identityHardware ? identityHardware() : null; } catch (_) { return null; } }
  let first = snapshot();
  let lastAux = Object.assign({}, first && first.auxRelays || {});

  function syncAux() {
    const s = snapshot();
    if (s && s.auxRelays) lastAux = Object.assign({}, s.auxRelays);
  }
  const soundButton = document.getElementById('sound');
  if (soundButton) {
    soundButton.addEventListener('click', syncAux, true);
    soundButton.addEventListener('click', () => setTimeout(syncAux, 0));
  }
  setInterval(() => {
    try { if (typeof tickSound === 'boolean' && !tickSound) syncAux(); } catch (_) {}
  }, 250);

  function changedAux(s) {
    const changes = [], next = s && s.auxRelays || {};
    for (const name of AUX_ORDER) {
      const before = !!lastAux[name], after = !!next[name];
      if (before !== after) changes.push({name, on:after});
    }
    lastAux = Object.assign({}, next);
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
  const relayOrdinal = (row, bit) => (row - 1) * 11 + bit;
  const auxOrdinal = name => 132 + Math.max(0, AUX_ORDER.indexOf(name));

  function nativePlay(ctx, p, id, ordinal, engaging, strength, impactWhen) {
    try {
      const delayMs = Math.max(0, (impactWhen - ctx.currentTime) * 1000);
      const bounce = engaging ? p.setBounceTimesMs : p.resetBounceTimesMs;
      RelayAudioBridge.playRelay(
        id, ordinal, !!engaging, Number(strength) || 1,
        delayMs, Array.isArray(bounce) ? bounce.join(',') : ''
      );
      return true;
    } catch (_) { return false; }
  }

  emitTick = function androidNativeDskyRelayClick(ctx, when = ctx.currentTime, strength = 1) {
    const model = window.DSKY_RELAY_AUDIO, s = snapshot();
    if (!nativeReady() || !model || !s) {
      const out = webAudioEmitTick(ctx, when, strength);
      syncAux();
      return out;
    }

    const aux = changedAux(s);
    if (aux.length) {
      aux.forEach((change, i) => {
        const p = model.auxiliaryProfileFor(change.name);
        if (!p) return;
        const travel = change.on ? p.setTravelMs : p.resetTravelMs;
        nativePlay(
          ctx, p, `AUX:${AUX_LABEL[change.name] || change.name.toUpperCase()}`,
          auxOrdinal(change.name), change.on, change.on ? 0.66 : 0.58,
          when + travel / 1000 + i * 0.00008
        );
      });
      return;
    }

    const row = Number(s.activeDrive) || 0;
    const settle = Array.isArray(s.armatureSettleMs) ? s.armatureSettleMs : [];
    if (row >= 1 && row <= 12 && settle.length === 11) {
      const bit = closestBit(Math.max(0, (when - ctx.currentTime) * 1000), settle);
      if (bit >= 0) {
        const target = s.lastWrite ? Number(s.lastWrite.low11) & 0o3777 : 0;
        const engaging = !!(target & (1 << bit));
        const p = model.profileFor(row, bit), id = model.relayIdentity(row, bit);
        if (p && id) {
          const travel = engaging ? p.setTravelMs : p.resetTravelMs;
          if (nativePlay(
            ctx, p, id, relayOrdinal(row, bit), engaging, strength,
            ctx.currentTime + travel / 1000
          )) return;
        }
      }
    }
    return webAudioEmitTick(ctx, when, strength);
  };

  // Keep the existing scheduler but replace Android WebView's bad latency report
  // with the guard that matches the active audio backend.
  const nativeEnsureAudio = ensureAudio;
  let nativeContext = null, latencyProxy = null;
  ensureAudio = function relayOutputSynchronizedAudio() {
    const ctx = nativeEnsureAudio();
    if (!ctx) return null;
    if (ctx === latencyProxy || (ctx === nativeContext && latencyProxy)) return latencyProxy;
    nativeContext = ctx;
    latencyProxy = new Proxy(ctx, {
      get(target, property) {
        if (property === 'baseLatency') return guardMs() / 1000;
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
    const id = setTimeout(() => { pendingPaints.delete(id); fn(); }, visualDelayMs());
    pendingPaints.add(id);
  }
  function lampState(name) {
    const el = document.querySelector(`[data-lamp="${name}"]`);
    return !!(el && el.classList.contains('on'));
  }
  function deferLamp(name, before, after) {
    if (before === after) return;
    setLamp(name, before);
    laterPaint(() => setLamp(name, after));
  }

  const decode11BeforeSync = decodeChannel11;
  decodeChannel11 = function synchronizedDecodeChannel11(value) {
    const comp = lampState('comp'), uplink = lampState('uplink'), word = value & 0o77777;
    decode11BeforeSync.call(this, value);
    deferLamp('comp', comp, !!(word & 0o00002));
    deferLamp('uplink', uplink, !!(word & 0o00004));
  };

  const decode163BeforeSync = decodeChannel163;
  decodeChannel163 = function synchronizedDecodeChannel163(value) {
    const before = {
      temp:lampState('temp'), keyrel:lampState('keyrel'), oprerr:lampState('oprerr'),
      restart:lampState('restart'), stby:lampState('stby')
    };
    const word = value & 0o77777;
    decode163BeforeSync.call(this, value);
    deferLamp('temp', before.temp, !!(word & 0o00010));
    deferLamp('keyrel', before.keyrel, !!(word & 0o00020));
    deferLamp('oprerr', before.oprerr, !!(word & 0o00100));
    deferLamp('restart', before.restart, !!(word & 0o00200));
    deferLamp('stby', before.stby, !!(word & 0o00400));
    // V/N flash and EL-OFF are electronic blanking behavior, not relay audio.
  };

  const resetBeforeSync = resetAgcFace;
  resetAgcFace = function synchronizedResetAgcFace(...args) {
    for (const id of pendingPaints) clearTimeout(id);
    pendingPaints.clear();
    return resetBeforeSync.apply(this, args);
  };

  if (window.AGCDSKY) {
    const before = window.AGCDSKY.hardware;
    if (typeof before === 'function') {
      window.AGCDSKY.hardware = () => {
        const s = before();
        s.presentationAudioGuardMs = guardMs();
        s.presentationVisualDelayMs = visualDelayMs();
        s.relayAudioBackend = nativeReady() ?
          'android-soundpool-low-latency' : 'web-audio-fallback';
        return s;
      };
    }
  }
})();
