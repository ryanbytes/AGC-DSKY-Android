'use strict';

// Sharper mechanical contact sound for the DSKY latching relays.
// Keep the existing relay timing model, but replace the long low clack with a
// short broadband contact snap, two tiny contact-bounce impulses, and only a
// trace of low-frequency armature body. This affects clock relay bursts, AGC
// output-channel relay changes, and the V35 relay test through the shared
// emitTick() path.
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;

  const CLICK_SPREAD_MS = 1.7;

  emitTick = function dskyRelayClick(ctx, when = ctx.currentTime) {
    const sr = ctx.sampleRate;
    const duration = 0.0065;
    const n = Math.max(1, Math.floor(sr * duration));
    const buf = ctx.createBuffer(1, n, sr);
    const data = buf.getChannelData(0);

    // Three very short impulses simulate the initial contact strike and the
    // small amount of mechanical bounce heard from a relay rather than a soft
    // electronic tick. The first impulse carries most of the energy.
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let env = Math.exp(-t / 0.00075);
      if (t >= 0.00155) env += 0.30 * Math.exp(-(t - 0.00155) / 0.00048);
      if (t >= 0.00305) env += 0.13 * Math.exp(-(t - 0.00305) / 0.00038);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    const high = ctx.createBiquadFilter();
    const low = ctx.createBiquadFilter();
    const snap = ctx.createGain();
    src.buffer = buf;

    // Concentrate the transient in the mechanical 'click' band while avoiding
    // a hissy top end from raw white noise.
    high.type = 'highpass';
    high.frequency.setValueAtTime(760, when);
    high.Q.setValueAtTime(0.65, when);
    low.type = 'lowpass';
    low.frequency.setValueAtTime(5600, when);
    low.Q.setValueAtTime(0.55, when);
    snap.gain.setValueAtTime(0.52 * tickLevel, when);
    snap.gain.exponentialRampToValueAtTime(0.0001, when + 0.0075);

    src.connect(high);
    high.connect(low);
    low.connect(snap);
    snap.connect(ctx.destination);
    src.start(when);

    // A much shorter/quieter armature body than the old 28 ms triangle tone.
    // It gives the click a little physical mass without turning it into a thud.
    const bodyOsc = ctx.createOscillator();
    const body = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(610, when);
    bodyOsc.frequency.exponentialRampToValueAtTime(270, when + 0.007);
    body.gain.setValueAtTime(0.045 * tickLevel, when);
    body.gain.exponentialRampToValueAtTime(0.0001, when + 0.010);
    bodyOsc.connect(body);
    body.connect(ctx.destination);
    bodyOsc.start(when);
    bodyOsc.stop(when + 0.011);
  };

  // Tighter contact spacing makes multi-contact relay changes read as a crisp
  // mechanical snap instead of a miniature drum roll.
  if (typeof playRelayBurst === 'function') {
    playRelayBurst = function clickierRelayBurst(count) {
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
