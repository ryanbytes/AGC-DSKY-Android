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
      // A dream always starts a fresh core. It intentionally does not call the
      // interactive snapshot restore/save helpers, so the screensaver cannot
      // alter the user's normal AGC session.
      if (agcCore) agcCore.stop();
      agcCore = new AgcCore({
        onChannelUpdate: routeDreamChannel,
        onError: failDreamAgc
      });
      await agcCore.load({ wasmUrl: 'yaAGC.wasm', ropeUrl: selected.rope });
      agcLoadedMission = selectedMission;
      mode = 'dream-agc';
      const status = $('mode');
      if (status) status.textContent = `${selected.label} · DREAM · ${agcCore.version()}`;
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
