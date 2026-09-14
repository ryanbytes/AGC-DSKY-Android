'use strict';

// Recreated DSKY relay click. The real-DSKY recording is used only as an
// acoustic reference: no audio from the recording is embedded or copied.
//
// Block II display channel 010 selects one of 12 banks of 11 bistable relays.
// The 11 relay bits in the selected bank are commanded together; they are not
// electrically stepped one-at-a-time.  app.js passes the Hamming distance of
// the old/new low-11 latch states, so this layer emits one mechanical transient
// for every armature that actually changes state.  The tiny time offsets below
// represent mechanical pull-in scatter only, not serialized relay drive.
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

    const f1 = 5600, f2 = 8300, f3 = 11600, f4 = 14200;
    const p1 = rnd() * Math.PI, p2 = rnd() * Math.PI;
    const p3 = rnd() * Math.PI, p4 = rnd() * Math.PI;

    let prevNoise = 0, prevDiff = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const noise = rnd();
      const diff = noise - prevNoise;
      const highNoise = diff - prevDiff;
      prevNoise = noise;
      prevDiff = diff;
      const strike = highNoise * Math.exp(-t / 0.00033) * 0.14;
      const ring =
          Math.sin(2 * Math.PI * f1 * t + p1) * Math.exp(-t / 0.00155) * 0.24 +
          Math.sin(2 * Math.PI * f2 * t + p2) * Math.exp(-t / 0.00185) * 0.34 +
          Math.sin(2 * Math.PI * f3 * t + p3) * Math.exp(-t / 0.00135) * 0.25 +
          Math.sin(2 * Math.PI * f4 * t + p4) * Math.exp(-t / 0.00095) * 0.13;
      const attack = Math.min(1, t / 0.00009);
      data[i] = (strike + ring) * attack;
    }

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
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.43 * tickLevel * strength, when + 0.00008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.0060);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(when);
    source.stop(when + 0.010);
  };

  if (typeof playRelayBurst === 'function') {
    playRelayBurst = function recreatedRelayBankClicks(count) {
      const ctx = ensureAudio();
      count = Math.max(0, Math.min(11, Math.trunc(Number(count) || 0)));
      if (!ctx || count < 1) return;
      const go = () => {
        const base = ctx.currentTime + 0.002;
        const spreadMs = typeof RELAY_CLICK_SPREAD_MS === 'number'
          ? Math.max(0, RELAY_CLICK_SPREAD_MS)
          : 2.5;
        const rnd = xorshift32(0x44534b59 ^ (++clickSerial * 0x45d9f3b));
        const offsets = [];
        for (let i = 0; i < count; i++) offsets.push((rnd() + 1) * 0.5 * spreadMs / 1000);
        offsets.sort((a, b) => a - b);
        const strength = Math.min(1.02, 0.82 + Math.min(count, 11) * 0.018);
        for (let i = 0; i < count; i++) emitTick(ctx, base + offsets[i], strength);
      };
      if (ctx.state === 'running') go();
      else ctx.resume().then(go).catch(() => {});
    };
  }
})();
