'use strict';

/*
 * Android/WebView relay audio/paint synchronization.
 *
 * The electrical model in hardware-fidelity.js remains authoritative: latching
 * relay state commits at the documented 20-ms boundary. Some Android/Fire
 * WebView audio stacks report a base/output latency far below the delay heard at
 * the speaker. That makes an electrically correct relay event sound late
 * relative to the DOM paint.
 *
 * Native Android relay audio uses a shorter guard because SoundPool bypasses
 * WebView's output buffer. WebAudio fallback keeps the conservative 120-ms guard.
 * The same presentation shift is applied to
 * the relay-driven annunciator/COMP ACTY states. It never changes yaAGC state,
 * relay latches, channel timing, V/N electronic flashing, or EL-OFF timing.
 */
(() => {
  const WEB_AUDIO_GUARD_MS = 120;
  const NATIVE_AUDIO_GUARD_MS = 60;
  const RELAY_SETTLE_MS = 20;

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

  // Make hardware-fidelity.js see the real AudioContext through a transparent
  // proxy, except for baseLatency. Its presentation helper already clamps to
  // 120 ms; advertising that full budget avoids Android's under-reporting while
  // all Web Audio methods still execute with the native context as `this`.
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
    // Restore synchronously, before the browser can paint the decoder's
    // immediate mutation, then replay the same transition after audio playout.
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
  decodeChannel163 = function synchronizedDecodeChannel163(value) {
    const before = {
      temp: lampState('temp'),
      keyrel: lampState('keyrel'),
      oprerr: lampState('oprerr'),
      restart: lampState('restart'),
      stby: lampState('stby')
    };
    const word = value & 0o77777;
    decode163BeforeSync.call(this, value);
    deferChangedLamp('temp', before.temp, !!(word & 0o00010));
    deferChangedLamp('keyrel', before.keyrel, !!(word & 0o00020));
    deferChangedLamp('oprerr', before.oprerr, !!(word & 0o00100));
    deferChangedLamp('restart', before.restart, !!(word & 0o00200));
    deferChangedLamp('stby', before.stby, !!(word & 0o00400));
    // V/N flash and EL-OFF are deliberately not restored: those channel-163
    // states are electronic blanking behavior, not a new audible relay event.
  };

  const resetBeforeSync = resetAgcFace;
  resetAgcFace = function synchronizedResetAgcFace(...args) {
    for (const id of pendingPaints) clearTimeout(id);
    pendingPaints.clear();
    return resetBeforeSync.apply(this, args);
  };

  if (window.AGCDSKY) {
    const hardwareBeforeSync = window.AGCDSKY.hardware;
    if (typeof hardwareBeforeSync === 'function') {
      window.AGCDSKY.hardware = () => {
        const state = hardwareBeforeSync();
        state.presentationAudioGuardMs = presentationAudioGuardMs();
        state.presentationVisualDelayMs = presentationVisualDelayMs();
        state.presentationAudioBackend = nativeRelayAudioReady() ?
          'android-soundpool-low-latency' : 'web-audio-fallback';
        return state;
      };
    }
  }
})();
