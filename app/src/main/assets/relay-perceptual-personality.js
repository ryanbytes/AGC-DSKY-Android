'use strict';

/*
 * Perceptual relay-identity layer.
 *
 * relay-identity-audio.js already owns the source-backed/mechanical model for
 * individual relay set/reset travel and contact bounce.  On a phone speaker,
 * however, its intentionally narrow acoustic tolerances are difficult to hear.
 * This layer keeps the same physical identities/timing but widens only the
 * audible timbre envelope enough that individual relays are distinguishable.
 * It does not alter AGC state, relay latch timing, or the 20-ms settled-display
 * boundary.
 */
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;
  if (!window.DSKY_RELAY_AUDIO || typeof window.DSKY_RELAY_AUDIO.profileFor !== 'function') return;

  const fallbackEmitTick = emitTick;
  const buffers = new Map();
  const audioModel = window.DSKY_RELAY_AUDIO;

  function hash32(text) {
    let h = 0x811c9dc5;
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function xorshift32(seed) {
    let state = (seed >>> 0) || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function unitSeed() {
    try { return localStorage.getItem('dskyHardwareUnitSeedV1') || '6d2b79f5'; }
    catch (_) { return '6d2b79f5'; }
  }

  function closestBit(deltaMs, settle) {
    let best = -1, error = Infinity;
    for (let bit = 0; bit < settle.length; bit++) {
      const e = Math.abs(deltaMs - Number(settle[bit]));
      if (e < error) { error = e; best = bit; }
    }
    return error <= 1.2 ? best : -1;
  }

  function activeIdentity(ctx, when) {
    let state;
    try { state = window.AGCDSKY.hardware(); } catch (_) { return null; }
    if (!state) return null;
    const row = Number(state.activeDrive) || 0;
    const settle = Array.isArray(state.armatureSettleMs) ? state.armatureSettleMs : [];
    if (row < 1 || row > 12 || settle.length !== 11) return null;
    const deltaMs = Math.max(0, (when - ctx.currentTime) * 1000);
    const bit = closestBit(deltaMs, settle);
    if (bit < 0) return null;
    const target = state.lastWrite ? Number(state.lastWrite.low11) & 0o3777 : 0;
    const engaging = !!(target & (1 << bit));
    const p = audioModel.profileFor(row, bit);
    return {row, bit, engaging, p};
  }

  function buildBuffer(ctx, identity) {
    const {row, bit, engaging, p} = identity;
    const seedText = `${unitSeed()}|${row}|${bit}|${engaging ? 'set' : 'reset'}`;
    const key = `${ctx.sampleRate}|${seedText}`;
    if (buffers.has(key)) return buffers.get(key);

    const rnd = xorshift32(hash32(seedText));
    const serial = ((p.ordinal * 37 + 11) % 131) / 130;
    // Keep a recognizable relay-family sound but widen the installed-unit
    // character enough to survive Android phone-speaker bandwidth/compression.
    const pitchScale = 0.86 + serial * 0.28 + (rnd() - 0.5) * 0.035;
    const brightScale = 0.90 + rnd() * 0.22;
    const decayScale = 0.78 + rnd() * 0.48;
    const duration = (engaging ? 0.0125 : 0.0115) * decayScale;
    const sr = ctx.sampleRate;
    const n = Math.max(64, Math.floor(sr * duration));
    const buffer = ctx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);

    const f1 = 3600 * pitchScale;
    const f2 = 5350 * pitchScale * brightScale;
    const f3 = 7600 * pitchScale * brightScale;
    const ph1 = rnd() * Math.PI * 2, ph2 = rnd() * Math.PI * 2, ph3 = rnd() * Math.PI * 2;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const noise = rnd() * 2 - 1;
      const edge = noise - prev;
      prev = noise;
      const strike = edge * Math.exp(-t / (0.00024 * decayScale)) * (0.16 + rnd() * 0.035);
      const ring =
        Math.sin(2 * Math.PI * f1 * t + ph1) * Math.exp(-t / (0.00175 * decayScale)) * 0.31 +
        Math.sin(2 * Math.PI * f2 * t + ph2) * Math.exp(-t / (0.00135 * decayScale)) * 0.36 +
        Math.sin(2 * Math.PI * f3 * t + ph3) * Math.exp(-t / (0.00092 * decayScale)) * 0.23;
      const attack = Math.min(1, t / 0.000075);
      data[i] = (strike + ring) * attack;
    }

    let mean = 0, peak = 0;
    for (let i = 0; i < n; i++) mean += data[i];
    mean /= n;
    for (let i = 0; i < n; i++) {
      data[i] -= mean;
      peak = Math.max(peak, Math.abs(data[i]));
    }
    if (peak > 0) {
      const scale = 0.84 / peak;
      for (let i = 0; i < n; i++) data[i] *= scale;
    }
    buffers.set(key, buffer);
    return buffer;
  }

  function playPerceptibleIdentity(ctx, identity, strength) {
    const {engaging, p} = identity;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const travelMs = engaging ? p.setTravelMs : p.resetTravelMs;
    const when = Math.max(ctx.currentTime + 0.00005, ctx.currentTime + travelMs / 1000);
    const level = typeof tickLevel === 'number' ? tickLevel : 1;
    const relayGain = 0.92 + (((p.ordinal * 19) % 29) / 28) * 0.18;
    source.buffer = buildBuffer(ctx, identity);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(
      0.48 * level * strength * relayGain * (engaging ? 1.04 : 0.92), when + 0.00007
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, when + (engaging ? 0.0072 : 0.0063));
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(when);
    source.stop(when + 0.015);

    const bounceTimes = engaging ? p.setBounceTimesMs : p.resetBounceTimesMs;
    for (let i = 0; i < bounceTimes.length; i++) {
      const bounce = ctx.createOscillator();
      const bg = ctx.createGain();
      const bt = when + bounceTimes[i] / 1000;
      const freq = (6200 + ((p.ordinal * 97 + i * 311) % 2600)) * (0.96 + i * 0.015);
      bounce.type = 'triangle';
      bounce.frequency.setValueAtTime(freq, bt);
      bg.gain.setValueAtTime(0.055 * level * strength * Math.pow(0.58, i), bt);
      bg.gain.exponentialRampToValueAtTime(0.0001, bt + 0.00055);
      bounce.connect(bg); bg.connect(ctx.destination);
      bounce.start(bt); bounce.stop(bt + 0.00075);
    }
  }

  emitTick = function perceptibleIndividualRelay(ctx, when = ctx.currentTime, strength = 1) {
    const identity = activeIdentity(ctx, when);
    if (!identity) return fallbackEmitTick(ctx, when, strength);
    playPerceptibleIdentity(ctx, identity, strength);
  };

  window.DSKY_RELAY_PERCEPTUAL = Object.freeze({
    model: 'deterministic-installed-unit-audible-spread-v1',
    unitSeed: unitSeed(),
    pitchSpread: Object.freeze({minScale:0.86, maxScale:1.14}),
    timingSource: 'DSKY_RELAY_AUDIO set/reset travel profiles'
  });
})();
