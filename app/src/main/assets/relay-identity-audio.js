'use strict';

/*
 * Stable per-relay mechanical fingerprints for the Block II DSKY.
 *
 * hardware-fidelity.js owns the authoritative 20-ms bank-drive/settle model and
 * the visible/latching relay state. This layer gives every physical relay a
 * persistent manufacturing fingerprint: set/reset armature travel, DPST pole
 * skew, contact-bounce trace, and acoustic response. Those characteristics are
 * deterministic for a given relay identity; they are not re-randomized on each
 * operation.
 *
 * The electrical bounce trace is modeled internally and exposed for diagnostics
 * and sound synthesis, but it is deliberately not written into agcRelayWords or
 * rendered to the EL face. Surviving Apollo documentation gives the 20-ms relay
 * drive/settle allowance, but not a flown unit's per-contact optical chronology.
 * The visible DSKY therefore changes only at hardware-fidelity.js's guaranteed
 * settled boundary, preventing modeled sub-20-ms contact motion from becoming a
 * persistent or invented display state.
 *
 * Manufacturing spreads below are bounded engineering models, not measurements
 * of the individual relays installed in the Apollo 11 DSKY.
 */
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;

  const fallbackEmitTick = emitTick;
  const baseHardware = window.AGCDSKY.hardware.bind(window.AGCDSKY);
  const bufferCache = new Map();
  const contactBufferCache = new Map();

  const LATCHING_RELAY_COUNT = 132;
  const DRIVE_ENVELOPE_MS = 20;
  const CONTACT_GUARD_MS = 0.35;
  const MAX_CONTACT_STABLE_MS = DRIVE_ENVELOPE_MS - CONTACT_GUARD_MS;

  // Bounded manufacturing spread. Set/reset are intentionally asymmetric:
  // opposite magnetic/mechanical travel paths in a latching relay need not have
  // identical timing. These bounds stay comfortably inside the documented
  // 20-ms drive/settle interval even after the modeled contact bounce.
  const SET_TRAVEL_MIN_MS = 5.1;
  const SET_TRAVEL_MAX_MS = 13.6;
  const RESET_TRAVEL_MIN_MS = 4.7;
  const RESET_TRAVEL_MAX_MS = 12.8;

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
    try { return baseHardware(); } catch (_) { return null; }
  }

  const firstSnapshot = snapshot();
  let lastAux = Object.assign({}, firstSnapshot && firstSnapshot.auxRelays || {});

  function syncAuxSnapshot() {
    const state = snapshot();
    if (state && state.auxRelays) lastAux = Object.assign({}, state.auxRelays);
  }

  // If sound was disabled while hardware state changed, resynchronize before
  // the next audible event so a later numeric relay is never mistaken for an
  // old silent annunciator transition.
  const soundButton = document.getElementById('sound');
  if (soundButton) {
    soundButton.addEventListener('click', syncAuxSnapshot, true);
    soundButton.addEventListener('click', () => setTimeout(syncAuxSnapshot, 0));
  }
  setInterval(() => {
    try { if (typeof tickSound === 'boolean' && !tickSound) syncAuxSnapshot(); } catch (_) {}
  }, 250);

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

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
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
    return LATCHING_RELAY_COUNT + Math.max(0, i);
  }

  function bouncePattern(rnd, count, windowMs) {
    if (count <= 0 || windowMs <= 0) return Object.freeze([]);
    const out = [];
    const slot = windowMs / (count + 1);
    for (let i = 1; i <= count; i++) {
      // Stable relay-specific irregularity around an otherwise monotonic decay.
      const jitter = (rnd() * 2 - 1) * slot * 0.24;
      out.push(clamp(i * slot + jitter, 0.05, windowMs - 0.03));
    }
    out.sort((a, b) => a - b);
    return Object.freeze(out);
  }

  function manufacturingProfile(id, ordinal) {
    const rnd = xorshift32(hash32(`${id}:manufacture`));

    // Every relay receives a unique fixed timing bias from both identity and
    // installed position, then a smaller fixed tolerance around it.
    const positionPhase = ((ordinal * 73 + 17) % LATCHING_RELAY_COUNT) /
      Math.max(1, LATCHING_RELAY_COUNT - 1);
    const setTravelMs = clamp(
      SET_TRAVEL_MIN_MS +
        (SET_TRAVEL_MAX_MS - SET_TRAVEL_MIN_MS) *
        clamp(0.58 * positionPhase + 0.42 * rnd(), 0, 1),
      SET_TRAVEL_MIN_MS, SET_TRAVEL_MAX_MS
    );
    const resetTravelMs = clamp(
      RESET_TRAVEL_MIN_MS +
        (RESET_TRAVEL_MAX_MS - RESET_TRAVEL_MIN_MS) *
        clamp(0.52 * (1 - positionPhase) + 0.48 * rnd(), 0, 1),
      RESET_TRAVEL_MIN_MS, RESET_TRAVEL_MAX_MS
    );

    // A DPST relay's two poles are mechanically linked but not perfectly
    // simultaneous. Keep the skew sub-millisecond and fixed for this relay.
    const poleSkewUs = Math.round((rnd() * 2 - 1) * 185);

    // Contact bounce is repeatably characteristic of the relay/contact set.
    // We model a small fixed number of reversals whose intervals decay within a
    // short window; the final stable contact state still arrives before 20 ms.
    const setBounceCount = 2 + Math.floor(rnd() * 5);   // 2..6 reversals
    const resetBounceCount = 1 + Math.floor(rnd() * 4); // 1..4 reversals
    const setBounceWindowMs = 0.55 + rnd() * 2.35;
    const resetBounceWindowMs = 0.35 + rnd() * 1.85;
    const setBounceTimesMs = bouncePattern(rnd, setBounceCount, setBounceWindowMs);
    const resetBounceTimesMs = bouncePattern(rnd, resetBounceCount, resetBounceWindowMs);
    const setTailMs = 0.12 + rnd() * 0.34;
    const resetTailMs = 0.10 + rnd() * 0.28;

    const setLastBounce = setBounceTimesMs.length ?
      setBounceTimesMs[setBounceTimesMs.length - 1] : 0;
    const resetLastBounce = resetBounceTimesMs.length ?
      resetBounceTimesMs[resetBounceTimesMs.length - 1] : 0;

    const setStableMs = Math.min(
      MAX_CONTACT_STABLE_MS, setTravelMs + setLastBounce + setTailMs
    );
    const resetStableMs = Math.min(
      MAX_CONTACT_STABLE_MS, resetTravelMs + resetLastBounce + resetTailMs
    );

    return Object.freeze({
      setTravelMs,
      resetTravelMs,
      setStableMs,
      resetStableMs,
      setBounceCount,
      resetBounceCount,
      setBounceTimesMs,
      resetBounceTimesMs,
      setBounceWindowMs,
      resetBounceWindowMs,
      poleSkewUs
    });
  }

  function contactTraceFromProfile(p, engaging) {
    const travelMs = engaging ? p.setTravelMs : p.resetTravelMs;
    const stableMs = engaging ? p.setStableMs : p.resetStableMs;
    const bounceTimes = engaging ? p.setBounceTimesMs : p.resetBounceTimesMs;
    const finalState = !!engaging;
    let state = finalState;
    const events = [{atMs: travelMs, state, kind: 'armature'}];

    // Each listed bounce is a contact reversal. The final "settled" event
    // restores the commanded state regardless of reversal parity.
    for (const offset of bounceTimes) {
      state = !state;
      events.push({atMs: travelMs + offset, state, kind: 'bounce'});
    }
    events.push({atMs: stableMs, state: finalState, kind: 'settled'});
    return events;
  }

  function profile(id, ordinal) {
    const m = manufacturingProfile(id, ordinal);
    const rnd = xorshift32(hash32(`${id}:acoustic`));
    const centered = () => rnd() * 2 - 1;

    // Serial position plus deterministic tolerance gives each physical relay a
    // persistent acoustic fingerprint while keeping the family resemblance.
    const serialOffset = (ordinal - 69.5) * 0.00034; // about +/-2.4%
    const bodyScale = 1 + serialOffset + centered() * 0.0035;
    return Object.freeze({
      id,
      ordinal,
      ...m,
      // Compatibility field: worst-case stable-contact time for this relay.
      settleMs: Math.max(m.setStableMs, m.resetStableMs),
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
      phaseSeed: hash32(`${id}:phase`),
      contactSeed: hash32(`${id}:contact`)
    });
  }

  const profileCache = new Map();
  function profileFor(id, ordinal) {
    const key = `${id}|${ordinal}`;
    if (!profileCache.has(key)) profileCache.set(key, profile(id, ordinal));
    return profileCache.get(key);
  }

  function buildRelayBuffer(ctx, p, engaging) {
    const key = `${ctx.sampleRate}|${p.id}|${engaging ? 'set' : 'reset'}`;
    const cached = bufferCache.get(key);
    if (cached) return cached;

    const sr = ctx.sampleRate;
    const duration = engaging ? 0.0105 : 0.0097;
    const n = Math.max(32, Math.floor(sr * duration));
    const buffer = ctx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);
    const rnd = xorshift32(p.phaseSeed ^ (engaging ? 0x53455421 : 0x52535421));

    const p1 = rnd() * Math.PI * 2;
    const p2 = rnd() * Math.PI * 2;
    const p3 = rnd() * Math.PI * 2;
    const p4 = rnd() * Math.PI * 2;
    const resetScale = engaging ? 1 : 0.93;
    const decayScale = engaging ? 1 : 0.90;

    let prevNoise = 0, prevDiff = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const noise = rnd() * 2 - 1;
      const diff = noise - prevNoise;
      const highNoise = diff - prevDiff;
      prevNoise = noise;
      prevDiff = diff;

      const strike = highNoise * Math.exp(-t / p.strikeDecay) *
        p.strikeMix * resetScale;
      const ring = p.ringMix * (
        Math.sin(2 * Math.PI * p.f1 * t + p1) *
          Math.exp(-t / (p.d1 * decayScale)) * 0.24 +
        Math.sin(2 * Math.PI * p.f2 * t + p2) *
          Math.exp(-t / (p.d2 * decayScale)) * 0.34 +
        Math.sin(2 * Math.PI * p.f3 * t + p3) *
          Math.exp(-t / (p.d3 * decayScale)) * 0.25 +
        Math.sin(2 * Math.PI * p.f4 * t + p4) *
          Math.exp(-t / (p.d4 * decayScale)) * 0.13
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

  function buildContactBuffer(ctx, p, engaging) {
    const key = `${ctx.sampleRate}|${p.id}|contact|${engaging ? 'set' : 'reset'}`;
    const cached = contactBufferCache.get(key);
    if (cached) return cached;

    const sr = ctx.sampleRate;
    const duration = 0.00135;
    const n = Math.max(24, Math.floor(sr * duration));
    const buffer = ctx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);
    const rnd = xorshift32(
      p.contactSeed ^ (engaging ? 0x434d414b : 0x4342524b)
    );
    const f = 10500 + rnd() * 5200;
    const phase = rnd() * Math.PI * 2;
    let previous = 0;

    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const noise = rnd() * 2 - 1;
      const high = noise - previous;
      previous = noise;
      const envelope = Math.exp(-t / 0.00019);
      const ring = Math.sin(2 * Math.PI * f * t + phase) *
        Math.exp(-t / 0.00034);
      data[i] = (high * 0.72 + ring * 0.28) * envelope;
    }

    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak > 0) {
      const scale = 0.66 / peak;
      for (let i = 0; i < n; i++) data[i] *= scale;
    }

    contactBufferCache.set(key, buffer);
    return buffer;
  }

  function playContactBounce(ctx, impactWhen, strength, p, engaging) {
    const times = engaging ? p.setBounceTimesMs : p.resetBounceTimesMs;
    if (!times.length) return;

    times.forEach((offsetMs, index) => {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const start = Math.max(
        ctx.currentTime + 0.00005,
        impactWhen + offsetMs / 1000
      );
      // Successive rebounds lose mechanical energy.
      const decay = Math.pow(0.68, index);
      const level = (typeof tickLevel === 'number' ? tickLevel : 1);
      source.buffer = buildContactBuffer(ctx, p, engaging);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(
        0.13 * level * strength * p.level * decay,
        start + 0.000025
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.00072);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(start);
      source.stop(start + 0.0015);
    });
  }

  function playIdentity(ctx, impactWhen, strength, id, ordinal, engaging) {
    const p = profileFor(id, ordinal);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const start = Math.max(ctx.currentTime + 0.00005, impactWhen);
    const level = (typeof tickLevel === 'number' ? tickLevel : 1);
    const setReset = engaging ? 1.035 : 0.915;

    source.buffer = buildRelayBuffer(ctx, p, engaging);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(
      0.43 * level * strength * p.level * setReset,
      start + 0.00008
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001, start + (engaging ? 0.0062 : 0.0055)
    );
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + 0.0115);

    playContactBounce(ctx, start, strength, p, engaging);
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

  emitTick = function individualDskyRelayClick(
    ctx, when = ctx.currentTime, strength = 1
  ) {
    const state = snapshot();
    if (!state) return fallbackEmitTick(ctx, when, strength);

    // Auxiliary relays are expanded from the old composite click into distinct
    // physical relays. They receive the same persistent manufacturing model.
    const auxChanges = changedAux(state);
    if (auxChanges.length) {
      auxChanges.forEach((change, i) => {
        const id = `AUX:${AUX_LABEL[change.name] || change.name.toUpperCase()}`;
        const ordinal = auxOrdinal(change.name);
        const p = profileFor(id, ordinal);
        const individualStrength = change.on ? 0.66 : 0.58;
        const travelMs = change.on ? p.setTravelMs : p.resetTravelMs;
        playIdentity(
          ctx,
          when + travelMs / 1000 + i * 0.00008,
          individualStrength,
          id,
          ordinal,
          change.on
        );
      });
      return;
    }

    const row = Number(state.activeDrive) || 0;
    const baseSettle = Array.isArray(state.armatureSettleMs) ?
      state.armatureSettleMs : [];
    if (row >= 1 && row <= 12 && baseSettle.length === 11) {
      // hardware-fidelity.js calls emitTick at a legacy per-bit marker. Use
      // that marker only to identify the physical armature; actual set/reset
      // travel and bounce come from this relay's persistent manufacturing
      // profile. No display/latch state is changed here.
      const deltaMs = Math.max(0, (when - ctx.currentTime) * 1000);
      const bit = closestBit(deltaMs, baseSettle);
      if (bit >= 0) {
        const target = state.lastWrite ?
          Number(state.lastWrite.low11) & 0o3777 : 0;
        const engaging = !!(target & (1 << bit));
        const id = relayIdentity(row, bit);
        const ordinal = relayOrdinal(row, bit);
        const p = profileFor(id, ordinal);
        const travelMs = engaging ? p.setTravelMs : p.resetTravelMs;
        const impactWhen = ctx.currentTime + travelMs / 1000;
        playIdentity(ctx, impactWhen, strength, id, ordinal, engaging);
        return;
      }
    }

    // Non-hardware/legacy callers retain the previous generic click rather than
    // being falsely assigned to a physical relay.
    fallbackEmitTick(ctx, when, strength);
  };

  const RELAY_SETTLE_MS = Object.freeze(
    Array.from({length: 12}, (_, rowIndex) =>
      Object.freeze(Array.from({length: 11}, (_, bit) => {
        const p = profileFor(
          relayIdentity(rowIndex + 1, bit),
          relayOrdinal(rowIndex + 1, bit)
        );
        return Math.max(p.setStableMs, p.resetStableMs);
      }))
    )
  );

  const allStable = RELAY_SETTLE_MS.flat();

  // Keep the original hardware snapshot fields intact for compatibility while
  // exposing effective worst-case stable-contact timing for diagnostics.
  window.AGCDSKY.hardware = () => {
    const state = baseHardware();
    state.relaySettleMs = RELAY_SETTLE_MS.map(row => row.slice());
    state.relaySettleMinMs = Math.min(...allStable);
    state.relaySettleMaxMs = Math.max(...allStable);
    state.relayManufacturingModel = 'deterministic-per-relay-set-reset-bounce-v1';
    return state;
  };

  window.DSKY_RELAY_AUDIO = Object.freeze({
    latchingRelayCount: LATCHING_RELAY_COUNT,
    auxiliaryRelayCount: AUX_ORDER.length,
    totalIndividualRelays: LATCHING_RELAY_COUNT + AUX_ORDER.length,
    driveEnvelopeMs: DRIVE_ENVELOPE_MS,
    maxContactStableMs: MAX_CONTACT_STABLE_MS,
    relayIdentity,
    settleMsFor: (row, bit) => {
      const p = profileFor(
        relayIdentity(row, bit),
        relayOrdinal(row, bit)
      );
      return Math.max(p.setStableMs, p.resetStableMs);
    },
    profileFor: (row, bit) =>
      profileFor(relayIdentity(row, bit), relayOrdinal(row, bit)),
    contactTraceFor: (row, bit, engaging) =>
      contactTraceFromProfile(
        profileFor(relayIdentity(row, bit), relayOrdinal(row, bit)),
        !!engaging
      ),
    auxiliaryProfileFor: name =>
      profileFor(
        `AUX:${AUX_LABEL[name] || String(name).toUpperCase()}`,
        auxOrdinal(name)
      )
  });
})();
