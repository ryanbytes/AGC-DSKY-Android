'use strict';
(() => {
  const params = new URLSearchParams(location.search);
  const dreamAgc = params.get('dream') === '1' && params.get('agc') === '1';
  if (!dreamAgc) return;

  let stoppedForVisibility = false;

  function routeDreamChannel(channel, value) {
    // Dream mode deliberately uses its own channel route instead of app.js's
    // onAgcChannel(), whose normal interactive path is gated on mode === 'agc'.
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
      if (!payload || payload.schema !== 1 || payload.mission !== selectedMission || !payload.core) {
        return false;
      }
      agcCore.importSnapshot(payload.core);
      applySnapshotUi(payload.ui);
      return true;
    } catch (error) {
      console.warn('Dream AGC snapshot clone ignored', String(error && error.message || error));
      return false;
    }
  }

  function failDreamAgc(error) {
    console.error('Dream AGC core stopped', error);
    try { if (agcCore) agcCore.stop(); } catch (_) {}
    mode = 'dream-agc-error';
    stopClockQueue();
    resetAgcFace();
    const status = $('mode');
    if (status) status.textContent = 'AGC ERROR · DREAM';
  }

  async function startDreamAgc() {
    cancelLampTest();
    stopClockQueue();
    mode = 'dream-agc-loading';
    resetAgcFace();

    try {
      const selected = missionSpec();
      // The dream owns a separate core. It may clone the last saved interactive
      // state, but it never saves back, changes runMode, or alters the live app.
      if (agcCore) agcCore.stop();
      agcCore = new AgcCore({
        onChannelUpdate: routeDreamChannel,
        onError: failDreamAgc
      });
      await agcCore.load({ wasmUrl: 'yaAGC.wasm', ropeUrl: selected.rope });
      agcLoadedMission = selectedMission;
      const restored = restoreDreamClone();
      mode = 'dream-agc';
      if (restored) renderAgcSnapshot();
      const status = $('mode');
      if (status) status.textContent = `${selected.label} · DREAM · ${agcCore.version()}${restored ? ' · STATE CLONED' : ''}`;
      if (!document.hidden) agcCore.start(1);
      else stoppedForVisibility = true;
    } catch (error) {
      failDreamAgc(error);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!agcCore || (mode !== 'dream-agc' && mode !== 'dream-agc-loading')) return;
    if (document.hidden) {
      if (agcCore.running) {
        agcCore.stop();
        stoppedForVisibility = true;
      }
    } else if (stoppedForVisibility && mode === 'dream-agc') {
      stoppedForVisibility = false;
      agcCore.start(1);
    }
  });

  addEventListener('pagehide', () => {
    try { if (agcCore) agcCore.stop(); } catch (_) {}
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
