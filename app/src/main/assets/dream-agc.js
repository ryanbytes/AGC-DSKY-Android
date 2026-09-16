'use strict';
(() => {
  const dreamState = window.AGCDSKY_APP_STATE;
  const dreamCore = window.AGCDSKY_CORE_SESSION;
  if (!dreamState) throw new Error('Shared application state unavailable');
  if (!dreamCore) throw new Error('Shared AGC core session unavailable');
  const params = new URLSearchParams(location.search);
  const dreamAgc = params.get('dream') === '1' && params.get('agc') === '1';
  if (!dreamAgc) return;

  let stoppedForVisibility = false;

  function routeDreamChannel(channel, value) {
    // Dream mode deliberately uses its own channel route instead of the normal
    // interactive onAgcChannel() path, which is gated on mode === 'agc'.
    if (channel === 0o10) decodeChannel10(value);
    else if (channel === 0o11) decodeChannel11(value);
    else if (channel === 0o13) decodeChannel13(value);
    else if (channel === 0o163) decodeChannel163(value);
  }

  function restoreDreamClone() {
    // Clone the most recent interactive AGC snapshot into this DreamService's
    // in-memory core. Never call the normal restore helper here: on malformed
    // data that helper deletes the user's saved snapshot. A dream is read-only
    // with respect to the interactive app's state.
    try {
      const raw = localStorage.getItem('agcSnapshotV1');
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (!payload || payload.schema !== 1 || payload.mission !== dreamState.selectedMission || !payload.core) {
        return false;
      }
      dreamCore.core.importSnapshot(payload.core);
      applySnapshotUi(payload.ui);
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
    stopClockQueue();
    resetAgcFace();
    const status = $('mode');
    if (status) status.textContent = 'AGC ERROR · DREAM';
  }

  async function startDreamAgc() {
    cancelLampTest();
    stopClockQueue();
    dreamState.mode = 'dream-agc-loading';
    resetAgcFace();

    try {
      const selected = missionSpec();
      // The dream owns this page's core session. It may clone the last saved
      // interactive AGC state, but it never saves back or changes runMode.
      if (dreamCore.core) dreamCore.core.stop();
      dreamCore.core = new AgcCore({
        onChannelUpdate: routeDreamChannel,
        onError: failDreamAgc
      });
      await dreamCore.core.load({ wasmUrl: 'yaAGC.wasm', ropeUrl: selected.rope });
      dreamCore.loadedMission = dreamState.selectedMission;
      const restored = restoreDreamClone();
      dreamState.mode = 'dream-agc';
      if (restored) renderAgcSnapshot();
      const status = $('mode');
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

  addEventListener('pagehide', () => {
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
