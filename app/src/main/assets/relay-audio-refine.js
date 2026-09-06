'use strict';

// Dry mechanical contact sound for the DSKY latching relays.
// Deliberately omit any low-frequency armature/body oscillator: on a phone
// speaker that component reads as a bass beat ahead of the actual relay snap.
// Keep only a short, high-passed broadband contact strike plus two tiny bounce
// impulses. Relay timing itself is unchanged.
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;

  const CLICK_SPREAD_MS = 1.7;

  emitTick = function dskyRelayClick(ctx, when = ctx.currentTime) {
    const sr = ctx.sampleRate;
    const duration = 0.0052;
    const n = Math.max(1, Math.floor(sr * duration));
    const buf = ctx.createBuffer(1, n, sr);
    const data = buf.getChannelData(0);

    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let env = Math.exp(-t / 0.00055);
      if (t >= 0.00135) env += 0.24 * Math.exp(-(t - 0.00135) / 0.00034);
      if (t >= 0.00270) env += 0.10 * Math.exp(-(t - 0.00270) / 0.00028);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    const high = ctx.createBiquadFilter();
    const low = ctx.createBiquadFilter();
    const snap = ctx.createGain();
    src.buffer = buf;

    // Remove the thump/bass band entirely. The useful relay character is the
    // short 1.2-7 kHz contact transient, especially on a phone speaker.
    high.type = 'highpass';
    high.frequency.setValueAtTime(1200, when);
    high.Q.setValueAtTime(0.70, when);
    low.type = 'lowpass';
    low.frequency.setValueAtTime(7000, when);
    low.Q.setValueAtTime(0.50, when);
    snap.gain.setValueAtTime(0.50 * tickLevel, when);
    snap.gain.exponentialRampToValueAtTime(0.0001, when + 0.0060);

    src.connect(high);
    high.connect(low);
    low.connect(snap);
    snap.connect(ctx.destination);
    src.start(when);
  };

  if (typeof playRelayBurst === 'function') {
    playRelayBurst = function dryRelayBurst(count) {
      const ctx = ensureAudio();
      if (!ctx || count < 1) return;
      const go = () => {
        const base = ctx.currentTime + 0.002;
        for (let i = 0; i < count; i++) {
          emitTick(ctx, base + i * CLICK_SPREAD_MS / 1000);
        }
      };
      if (ctx.state === 'running') go();
      else ctx.resume().then(go).catch(() => {});
    };
  }
})();
