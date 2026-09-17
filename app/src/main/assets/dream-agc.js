'use strict';
(() => {
  const dreamState = window.AGCDSKY_APP_STATE;
  const dreamCore = window.AGCDSKY_CORE_SESSION;
  const dreamShell = window.AGCDSKY_SHELL;
  const dreamClock = window.AGCDSKY_CLOCK;
  const dreamDisplay = window.AGCDSKY_DISPLAY;
  const DreamAgcCore = window.AgcCore;
  if (!dreamState) throw new Error('Shared application state unavailable');
  if (!dreamCore) throw new Error('Shared AGC core session unavailable');
  if (!dreamShell) throw new Error('Application shell service unavailable');
  if (!dreamClock) throw new Error('Clock service unavailable');
  if (!dreamDisplay) throw new Error('AGC display service unavailable');
  if (typeof DreamAgcCore !== 'function') throw new Error('AGC core constructor unavailable');
  const params = new URLSearchParams(window.location.search);
  const dreamAgc = params.get('dream') === '1' && params.get('agc') === '1';
  if (!dreamAgc) return;

  let stoppedForVisibility = false;

  function routeDreamChannel(channel, value) {
    // Dream mode deliberately uses its own channel route instead of the normal
    // interactive display.onChannel() path, which is gated on interactive AGC
    // mode. Resolve the display-owned implementation slot at dispatch time so
    // late fidelity wrappers remain authoritative.
    if (channel === 0o10) dreamDisplay.implementation('decodeChannel10')(value);
    else if (channel === 0o11) dreamDisplay.implementation('decodeChannel11')(value);
    else if (channel === 0o13) dreamDisplay.implementation('decodeChannel13')(value);
    else if (channel === 0o163) dreamDisplay.implementation('decodeChannel163')(value);
  }

  function restoreDreamClone() {
    // Clone the most recent interactive AGC snapshot into this DreamService's
    // in-memory core. Never call the normal restore helper here: on malformed
    // data that helper deletes the user's saved snapshot. A dream is read-only
    // with respect to the interactive app's state.
    try {
      const raw = dreamShell.store.get('agcSnapshotV1');
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (!payload || payload.schema !== 1 || payload.mission !== dreamState.selectedMission || !payload.core) {
        return false;
      }
      dreamCore.core.importSnapshot(payload.core);
      dreamDisplay.applySnapshotUi(payload.ui);
      return true;
    } catch (error) {
      console.warn('Dream AGC snapshot clone ignored', String(error && error.message || error));
      return false;
    }
  }

  function failDreamAgc(error) {
    console.error('Dream AGC core stopped', error);
    try { if (dreamCore.core) dreamCore.core.stop(); } catch (_) {}
    dreamState.mode = 'dream-agc-error';
    dreamClock.stopQueue();
    dreamDisplay.resetFace();
    const status = dreamShell.element('mode');
    if (status) status.textContent = 'AGC ERROR · DREAM';
  }

  async function startDreamAgc() {
    dreamClock.cancelLampTest();
    dreamClock.stopQueue();
    dreamState.mode = 'dream-agc-loading';
    dreamDisplay.resetFace();

    try {
      const selected = dreamShell.missionSpec();
      // The dream owns this page's core session. It may clone the last saved
      // interactive AGC state, but it never saves back or changes runMode.
      if (dreamCore.core) dreamCore.core.stop();
      dreamCore.core = new DreamAgcCore({
        onChannelUpdate: routeDreamChannel,
        onError: failDreamAgc
      });
      await dreamCore.core.load({ wasmUrl: 'yaAGC.wasm', ropeUrl: selected.rope });
      dreamCore.loadedMission = dreamState.selectedMission;
      const restored = restoreDreamClone();
      dreamState.mode = 'dream-agc';
      if (restored) dreamDisplay.renderSnapshot();
      const status = dreamShell.element('mode');
      if (status) status.textContent = `${selected.label} · DREAM · ${dreamCore.core.version()}${restored ? ' · STATE CLONED' : ''}`;
      if (!document.hidden) dreamCore.core.start(1);
      else stoppedForVisibility = true;
    } catch (error) {
      failDreamAgc(error);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!dreamCore.core || (dreamState.mode !== 'dream-agc' && dreamState.mode !== 'dream-agc-loading')) return;
    if (document.hidden) {
      if (dreamCore.core.running) {
        dreamCore.core.stop();
        stoppedForVisibility = true;
      }
    } else if (stoppedForVisibility && dreamState.mode === 'dream-agc') {
      stoppedForVisibility = false;
      dreamCore.core.start(1);
    }
  });

  window.addEventListener('pagehide', () => {
    try { if (dreamCore.core) dreamCore.core.stop(); } catch (_) {}
  });

  startDreamAgc();
})();

// This is intentionally last in index.html's script order. On debuggable
// builds it gives the device smoke a native marker only after every packaged
// frontend layer has evaluated and the interactive API is available.
(() => {
  const bridge = window.DebugBridge;
  if (bridge && typeof bridge.ready === 'function'
      && window.AGCDSKY && typeof window.AGCDSKY.appStatus === 'function') {
    bridge.ready('app');
  }
})();