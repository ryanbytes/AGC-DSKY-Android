'use strict';

// Recreated DSKY relay click. The uploaded real-DSKY recording is used only as
// an acoustic reference: no audio from the recording is embedded or copied.
// The recording shows a short impulsive strike with several metallic resonances.
// Recreate that behavior synthetically, shifted upward to keep the result crisp
// on a phone speaker and away from the bassy/thuddy character of earlier builds.
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;

  let clickSerial = 0;

  function xorshift32(seed) {
    let state = seed | 0;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) / 4294967296) * 2 - 1;
    };
  }

  function buildRelayBuffer(ctx, seed) {
    const sr = ctx.sampleRate;
    const duration = 0.010;
    const n = Math.max(32, Math.floor(sr * duration));
    const buffer = ctx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);
    const rnd = xorshift32(seed || 1);

    // Resonance ratios are based on the character of the real DSKY reference,
    // but moved upward so the phone reproduces a dry metallic click rather than
    // a low clack. There is deliberately no low-frequency body oscillator.
    const f1 = 5600;
    const f2 = 8300;
    const f3 = 11600;
    const f4 = 14200;
    const p1 = rnd() * Math.PI;
    const p2 = rnd() * Math.PI;
    const p3 = rnd() * Math.PI;
    const p4 = rnd() * Math.PI;

    let prevNoise = 0;
    let prevDiff = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;

      // A twice-differenced random impulse supplies the initial mechanical
      // strike without adding sustained low-frequency noise.
      const noise = rnd();
      const diff = noise - prevNoise;
      const highNoise = diff - prevDiff;
      prevNoise = noise;
      prevDiff = diff;
      const strike = highNoise * Math.exp(-t / 0.00033) * 0.14;

      // Several independently decaying partials create the metallic relay
      // contact ring. All useful energy is kept above roughly 5 kHz.
      const ring =
          Math.sin(2 * Math.PI * f1 * t + p1) * Math.exp(-t / 0.00155) * 0.24 +
          Math.sin(2 * Math.PI * f2 * t + p2) * Math.exp(-t / 0.00185) * 0.34 +
          Math.sin(2 * Math.PI * f3 * t + p3) * Math.exp(-t / 0.00135) * 0.25 +
          Math.sin(2 * Math.PI * f4 * t + p4) * Math.exp(-t / 0.00095) * 0.13;

      // Start from zero to prevent a DAC/speaker step from becoming a thump.
      const attack = Math.min(1, t / 0.00009);
      data[i] = (strike + ring) * attack;
    }

    // Remove any residual DC introduced by the short window and normalize.
    let mean = 0;
    for (let i = 0; i < n; i++) mean += data[i];
    mean /= n;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      data[i] -= mean;
      peak = Math.max(peak, Math.abs(data[i]));
    }
    if (peak > 0) {
      const scale = 0.82 / peak;
      for (let i = 0; i < n; i++) data[i] *= scale;
    }
    return buffer;
  }

  emitTick = function recreatedDskyRelayClick(ctx, when = ctx.currentTime, strength = 1) {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const seed = 0x4d534b59 ^ (++clickSerial * 0x9e3779b9);
    source.buffer = buildRelayBuffer(ctx, seed);

    // Fast attack/decay keeps this a mechanical click rather than a tone.
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.43 * tickLevel * strength, when + 0.00008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.0060);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(when);
    source.stop(when + 0.010);
  };

  // One relay word activation is one audible mechanical event. Contact count
  // only changes its level slightly; it never creates a low-frequency click train.
  if (typeof playRelayBurst === 'function') {
    playRelayBurst = function recreatedRelayWordClick(count) {
      const ctx = ensureAudio();
      if (!ctx || count < 1) return;
      const go = () => {
        const strength = Math.min(1.06, 0.88 + Math.min(count, 6) * 0.03);
        emitTick(ctx, ctx.currentTime + 0.002, strength);
      };
      if (ctx.state === 'running') go();
      else ctx.resume().then(go).catch(() => {});
    };
  }
})();
