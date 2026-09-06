'use strict';

// Dry mechanical contact sound for the DSKY latching relays.
// One energized relay word is one mechanical event: its contacts move together.
// Do not synthesize one audible click per changed contact bit, because a 1-2 ms
// click train creates a strong low-frequency amplitude envelope that sounds like
// a bass beat on phone speakers. Changed-bit count only changes click intensity.
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;

  emitTick = function dskyRelayClick(ctx, when = ctx.currentTime, strength = 1) {
    const sr = ctx.sampleRate;
    const duration = 0.0032;
    const n = Math.max(1, Math.floor(sr * duration));
    const buf = ctx.createBuffer(1, n, sr);
    const data = buf.getChannelData(0);

    // Very short contact strike with one small internal bounce. Keeping the
    // event inside a single transient avoids a perceptible rhythmic envelope.
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let env = Math.exp(-t / 0.00034);
      if (t >= 0.00092) env += 0.18 * Math.exp(-(t - 0.00092) / 0.00022);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    const high = ctx.createBiquadFilter();
    const low = ctx.createBiquadFilter();
    const snap = ctx.createGain();
    src.buffer = buf;

    // Keep essentially all relay energy out of the bass/lower-mid band.
    // The audible character is a dry 2.4-8.5 kHz contact snap.
    high.type = 'highpass';
    high.frequency.setValueAtTime(2400, when);
    high.Q.setValueAtTime(0.72, when);
    low.type = 'lowpass';
    low.frequency.setValueAtTime(8500, when);
    low.Q.setValueAtTime(0.50, when);
    snap.gain.setValueAtTime(0.42 * tickLevel * strength, when);
    snap.gain.exponentialRampToValueAtTime(0.0001, when + 0.0038);

    src.connect(high);
    high.connect(low);
    low.connect(snap);
    snap.connect(ctx.destination);
    src.start(when);
  };

  if (typeof playRelayBurst === 'function') {
    playRelayBurst = function singleRelayClack(count) {
      const ctx = ensureAudio();
      if (!ctx || count < 1) return;
      const go = () => {
        // Contacts within one relay word actuate together. More changed contacts
        // make the clack slightly stronger, not a rapid series of separate hits.
        const strength = Math.min(1.08, 0.84 + Math.min(count, 6) * 0.04);
        emitTick(ctx, ctx.currentTime + 0.002, strength);
      };
      if (ctx.state === 'running') go();
      else ctx.resume().then(go).catch(() => {});
    };
  }
})();
