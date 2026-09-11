'use strict';

/*
 * Stable per-relay acoustic fingerprints for the Block II DSKY.
 *
 * The electrical model remains authoritative in hardware-fidelity.js.  This
 * layer changes sound only.  Every one of the 12 x 11 latching relays and each
 * non-latching annunciator/flash relay gets a deterministic, slightly different
 * mechanical click.  The differences are intentionally small: they represent
 * unit-to-unit manufacturing tolerance, not different relay types.
 *
 * The same physical relay always gets the same base timbre for the life of the
 * app.  Pull-in and release share that fingerprint, with only the expected
 * make/break strength/decay difference.  No per-click random timbre is used for
 * identified DSKY relays.
 */
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;

  const fallbackEmitTick = emitTick;
  const bufferCache = new Map();

  const AUX_ORDER = Object.freeze([
    'comp', 'uplink', 'temp', 'keyrel',
    'oprerr', 'flash', 'restart', 'stby'
  ]);

  const AUX_LABEL = Object.freeze({
    comp: 'COMP-ACTY',
    uplink: 'UPLINK-ACTY',
    temp: 'TEMP',
    keyrel: 'KEY-REL',
    oprerr: 'OPR-ERR',
    flash: 'FLASH',
    restart: 'RESTART',
    stby: 'STBY'
  });

  function snapshot() {
    try { return window.AGCDSKY.hardware(); } catch (_) { return null; }
  }

  const firstSnapshot = snapshot();
  let lastAux = Object.assign({}, firstSnapshot && firstSnapshot.auxRelays || {});

  function hash32(text) {
    let h = 0x811c9dc5;
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
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

  function bitName(bit) {
    if (bit === 10) return 'B';
    if (bit >= 5) return `C-K${bit - 4}`;
    return `D-K${bit + 1}`;
  }

  function relayIdentity(row, bit) {
    return `ROW-${String(row).padStart(2, '0')}:${bitName(bit)}`;
  }

  function relayOrdinal(row, bit) {
    return (row - 1) * 11 + bit;
  }

  function auxOrdinal(name) {
    const i = AUX_ORDER.indexOf(name);
    return 132 + Math.max(0, i);
  }

  function profile(id, ordinal) {
    const rnd = xorshift32(hash32(id));
    const centered = () => rnd() * 2 - 1;

    // Give every physical relay one guaranteed-unique center offset, then add
    // smaller deterministic tolerances to individual resonances and damping.
    const serialOffset = (ordinal - 69.5) * 0.00034; // about +/-2.4%
    const bodyScale = 1 + serialOffset + centered() * 0.0035;
    return Object.freeze({
      id,
      ordinal,
      f1: 5600 * bodyScale * (1 + centered() * 0.0040),
      f2: 8300 * bodyScale * (1 + centered() * 0.0045),
      f3: 11600 * bodyScale * (1 + centered() * 0.0050),
      f4: 14200 * bodyScale * (1 + centered() * 0.0055),
      d1: 0.00155 * (1 + centered() * 0.09),
      d2: 0.00185 * (1 + centered() * 0.09),
      d3: 0.00135 * (1 + centered() * 0.10),
      d4: 0.00095 * (1 + centered() * 0.11),
      strikeDecay: 0.00033 * (1 + centered() * 0.12),
      strikeMix: 0.14 * (1 + centered() * 0.10),
      ringMix: 1 + centered() * 0.045,
      level: 1 + centered() * 0.050,
      // Purely acoustic placement scatter.  Electrical settling remains the
      // 20-ms model in hardware-fidelity.js.
      acousticSkewMs: centered() * 0.22,
      phaseSeed: hash32(`${id}:phase`)
    });
  }

  const profileCache = new Map();
  function profileFor(id, ordinal) {
    const key = `${id}|${ordinal}`;
    if (!profileCache.has(key)) profileCache.set(key, profile(id, ordinal));
    return profileCache.get(key);
  }

  function buildRelayBuffer(ctx, p, engaging) {
    const key = `${ctx.sampleRate}|${p.id}|${engaging ? 'make' : 'break'}`;
    const cached = bufferCache.get(key);
    if (cached) return cached;

    const sr = ctx.sampleRate;
    const duration = engaging ? 0.0105 : 0.0097;
    const n = Math.max(32, Math.floor(sr * duration));
    const buffer = ctx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);
    const rnd = xorshift32(p.phaseSeed ^ (engaging ? 0x4d414b45 : 0x4252454b));

    const p1 = rnd() * Math.PI * 2;
    const p2 = rnd() * Math.PI * 2;
    const p3 = rnd() * Math.PI * 2;
    const p4 = rnd() * Math.PI * 2;
    const releaseScale = engaging ? 1 : 0.93;
    const decayScale = engaging ? 1 : 0.90;

    let prevNoise = 0, prevDiff = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const noise = rnd() * 2 - 1;
      const diff = noise - prevNoise;
      const highNoise = diff - prevDiff;
      prevNoise = noise;
      prevDiff = diff;

      const strike = highNoise * Math.exp(-t / p.strikeDecay) * p.strikeMix * releaseScale;
      const ring = p.ringMix * (
        Math.sin(2 * Math.PI * p.f1 * t + p1) * Math.exp(-t / (p.d1 * decayScale)) * 0.24 +
        Math.sin(2 * Math.PI * p.f2 * t + p2) * Math.exp(-t / (p.d2 * decayScale)) * 0.34 +
        Math.sin(2 * Math.PI * p.f3 * t + p3) * Math.exp(-t / (p.d3 * decayScale)) * 0.25 +
        Math.sin(2 * Math.PI * p.f4 * t + p4) * Math.exp(-t / (p.d4 * decayScale)) * 0.13
      );
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

    bufferCache.set(key, buffer);
    return buffer;
  }

  function playIdentity(ctx, when, strength, id, ordinal, engaging) {
    const p = profileFor(id, ordinal);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const start = Math.max(ctx.currentTime + 0.00005, when + p.acousticSkewMs / 1000);
    const level = (typeof tickLevel === 'number' ? tickLevel : 1);
    const makeBreak = engaging ? 1.035 : 0.915;

    source.buffer = buildRelayBuffer(ctx, p, engaging);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.43 * level * strength * p.level * makeBreak, start + 0.00008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (engaging ? 0.0062 : 0.0055));
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + 0.0115);
  }

  function changedAux(current) {
    const changes = [];
    const next = current && current.auxRelays || {};
    for (const name of AUX_ORDER) {
      const before = !!lastAux[name];
      const after = !!next[name];
      if (before !== after) changes.push({name, on: after});
    }
    lastAux = Object.assign({}, next);
    return changes;
  }

  function closestBit(deltaMs, settle) {
    let best = -1, error = Infinity;
    for (let bit = 0; bit < settle.length; bit++) {
      const e = Math.abs(deltaMs - Number(settle[bit]));
      if (e < error) { error = e; best = bit; }
    }
    return error <= 1.2 ? best : -1;
  }

  emitTick = function individualDskyRelayClick(ctx, when = ctx.currentTime, strength = 1) {
    const state = snapshot();
    if (!state) return fallbackEmitTick(ctx, when, strength);

    // Auxiliary relays used to be collapsed into one composite sound when
    // several changed on the same edge.  Expand that transition back into the
    // individual physical relays, each with its own permanent fingerprint.
    const auxChanges = changedAux(state);
    if (auxChanges.length) {
      auxChanges.forEach((change, i) => {
        const id = `AUX:${AUX_LABEL[change.name] || change.name.toUpperCase()}`;
        const ordinal = auxOrdinal(change.name);
        playIdentity(ctx, when + i * 0.00016, strength, id, ordinal, change.on);
      });
      return;
    }

    const row = Number(state.activeDrive) || 0;
    const settle = Array.isArray(state.armatureSettleMs) ? state.armatureSettleMs : [];
    if (row >= 1 && row <= 12 && settle.length === 11) {
      const deltaMs = Math.max(0, (when - ctx.currentTime) * 1000);
      const bit = closestBit(deltaMs, settle);
      if (bit >= 0) {
        const target = state.lastWrite ? Number(state.lastWrite.low11) & 0o3777 : 0;
        const engaging = !!(target & (1 << bit));
        playIdentity(ctx, when, strength, relayIdentity(row, bit), relayOrdinal(row, bit), engaging);
        return;
      }
    }

    // Non-hardware/legacy callers retain the previous generic click rather than
    // being falsely assigned to a physical relay.
    fallbackEmitTick(ctx, when, strength);
  };

  window.DSKY_RELAY_AUDIO = Object.freeze({
    latchingRelayCount: 132,
    auxiliaryRelayCount: AUX_ORDER.length,
    totalIndividualRelays: 132 + AUX_ORDER.length,
    relayIdentity,
    profileFor: (row, bit) => profileFor(relayIdentity(row, bit), relayOrdinal(row, bit)),
    auxiliaryProfileFor: name => profileFor(`AUX:${AUX_LABEL[name] || String(name).toUpperCase()}`, auxOrdinal(name))
  });
})();
