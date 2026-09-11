'use strict';

/*
 * Stable per-relay mechanical fingerprints for the Block II DSKY.
 *
 * hardware-fidelity.js owns the 20-ms bank-drive envelope.  This layer gives
 * every one of the 12 x 11 latching relays its own deterministic mechanical
 * settle time inside that envelope and applies the contact state when that
 * individual armature finishes moving.  The associated click starts at the
 * same instant as the contact transition, so a changing row can visibly and
 * audibly resolve as a short relay rattle instead of one 20-ms snap.
 *
 * The settle spread and acoustic tolerances are modeled manufacturing
 * variation, not measured values from the flown Apollo 11 DSKY.  No identified
 * relay uses per-click randomness: a physical relay keeps the same settle time
 * and timbre for the life of the app.
 */
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;

  const fallbackEmitTick = emitTick;
  const baseHardware = window.AGCDSKY.hardware.bind(window.AGCDSKY);
  const bufferCache = new Map();
  const driveVisuals = new Map();
  const latestDriveStamp = new Map();

  const LATCHING_RELAY_COUNT = 132;
  const SETTLE_MIN_MS = 5.2;
  const SETTLE_MAX_MS = 19.4;

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
  // old silent annunciator transition. Capture runs before app.js toggles sound
  // and plays its one confirmation click; the zero-delay sync catches the new
  // state after the app's click handler completes.
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

  // Use a full-period permutation of the 132 physical latching-relay ordinals.
  // Every relay therefore gets a unique, stable travel time while all contacts
  // still complete before the documented 20-ms bank-settle boundary.
  function settleMsForOrdinal(ordinal) {
    const slot = ((ordinal * 73) + 17) % LATCHING_RELAY_COUNT;
    return SETTLE_MIN_MS + slot * (SETTLE_MAX_MS - SETTLE_MIN_MS) / (LATCHING_RELAY_COUNT - 1);
  }

  function profile(id, ordinal) {
    const rnd = xorshift32(hash32(id));
    const centered = () => rnd() * 2 - 1;

    // Serial position plus deterministic tolerance gives each physical relay a
    // persistent acoustic fingerprint while keeping the family resemblance.
    const serialOffset = (ordinal - 69.5) * 0.00034; // about +/-2.4%
    const bodyScale = 1 + serialOffset + centered() * 0.0035;
    return Object.freeze({
      id,
      ordinal,
      settleMs: ordinal < LATCHING_RELAY_COUNT ? settleMsForOrdinal(ordinal) : null,
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
    const start = Math.max(ctx.currentTime + 0.00005, when);
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

  function applyRelayVisual(relay, low11) {
    const b = (low11 >> 10) & 1;
    const c = (low11 >> 5) & 0o37;
    const d = low11 & 0o37;
    switch (relay) {
      case 12:
        setLamp('vel', !!(low11 & 0o00004));
        setLamp('noatt', !!(low11 & 0o00010));
        setLamp('alt', !!(low11 & 0o00020));
        setLamp('gimbal', !!(low11 & 0o00040));
        setLamp('tracker', !!(low11 & 0o00200));
        setLamp('prog', !!(low11 & 0o00400));
        break;
      case 11:
        agcDisplay.prog[0] = relayDigit(c); agcDisplay.prog[1] = relayDigit(d);
        set2('prog', agcDisplay.prog.join(''));
        break;
      case 10:
        agcDisplay.verb[0] = relayDigit(c); agcDisplay.verb[1] = relayDigit(d);
        set2('verb', agcDisplay.verb.join(''));
        break;
      case 9:
        agcDisplay.noun[0] = relayDigit(c); agcDisplay.noun[1] = relayDigit(d);
        set2('noun', agcDisplay.noun.join(''));
        break;
      case 8:
        agcDisplay.r1.digits[0] = relayDigit(d); renderAgcReg('r1');
        break;
      case 7:
        agcDisplay.r1.plus = !!b; agcDisplay.r1.digits[1] = relayDigit(c); agcDisplay.r1.digits[2] = relayDigit(d); renderAgcReg('r1');
        break;
      case 6:
        agcDisplay.r1.minus = !!b; agcDisplay.r1.digits[3] = relayDigit(c); agcDisplay.r1.digits[4] = relayDigit(d); renderAgcReg('r1');
        break;
      case 5:
        agcDisplay.r2.plus = !!b; agcDisplay.r2.digits[0] = relayDigit(c); agcDisplay.r2.digits[1] = relayDigit(d); renderAgcReg('r2');
        break;
      case 4:
        agcDisplay.r2.minus = !!b; agcDisplay.r2.digits[2] = relayDigit(c); agcDisplay.r2.digits[3] = relayDigit(d); renderAgcReg('r2');
        break;
      case 3:
        agcDisplay.r2.digits[4] = relayDigit(c); agcDisplay.r3.digits[0] = relayDigit(d); renderAgcReg('r2'); renderAgcReg('r3');
        break;
      case 2:
        agcDisplay.r3.plus = !!b; agcDisplay.r3.digits[1] = relayDigit(c); agcDisplay.r3.digits[2] = relayDigit(d); renderAgcReg('r3');
        break;
      case 1:
        agcDisplay.r3.minus = !!b; agcDisplay.r3.digits[3] = relayDigit(c); agcDisplay.r3.digits[4] = relayDigit(d); renderAgcReg('r3');
        break;
    }
  }

  function driveRecord(state, row) {
    const last = state && state.lastWrite;
    if (!last || Number(last.relay) !== row) return null;
    const stamp = Number(last.at);
    const key = `${row}:${stamp}`;
    let record = driveVisuals.get(key);
    if (!record) {
      const prior = state.latches && Object.prototype.hasOwnProperty.call(state.latches, row)
        ? Number(state.latches[row]) & 0o3777
        : 0;
      record = {
        key,
        row,
        stamp,
        word: prior,
        target: Number(last.low11) & 0o3777
      };
      driveVisuals.set(key, record);
      latestDriveStamp.set(row, stamp);
      setTimeout(() => driveVisuals.delete(key), 40);
    }
    return record;
  }

  function settleContact(state, row, bit, delayMs) {
    const record = driveRecord(state, row);
    if (!record) return;
    const mask = 1 << bit;
    setTimeout(() => {
      if (latestDriveStamp.get(row) !== record.stamp) return;
      if (record.target & mask) record.word |= mask;
      else record.word &= ~mask;
      record.word &= 0o3777;
      try { agcRelayWords[row] = record.word; } catch (_) {}
      try { applyRelayVisual(row, record.word); } catch (_) {}
    }, Math.max(0, delayMs));
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
    // several changed on the same edge. Expand that transition back into the
    // individual physical relays, each with its own permanent fingerprint.
    const auxChanges = changedAux(state);
    if (auxChanges.length) {
      auxChanges.forEach((change, i) => {
        const id = `AUX:${AUX_LABEL[change.name] || change.name.toUpperCase()}`;
        const ordinal = auxOrdinal(change.name);
        // The old composite caller scales strength by how many relays changed.
        // Once expanded, restore a single-relay level so simultaneous lamps do
        // not become artificially louder merely because they share an edge.
        const individualStrength = change.on ? 0.66 : 0.58;
        playIdentity(ctx, when + i * 0.00016, individualStrength, id, ordinal, change.on);
      });
      return;
    }

    const row = Number(state.activeDrive) || 0;
    const baseSettle = Array.isArray(state.armatureSettleMs) ? state.armatureSettleMs : [];
    if (row >= 1 && row <= 12 && baseSettle.length === 11) {
      // hardware-fidelity.js still calls emitTick at its legacy per-bit marker.
      // Use that marker only to identify which physical armature is moving;
      // then reschedule the actual contact and sound to this relay's own stable
      // travel time inside the same 20-ms bank envelope.
      const deltaMs = Math.max(0, (when - ctx.currentTime) * 1000);
      const bit = closestBit(deltaMs, baseSettle);
      if (bit >= 0) {
        const target = state.lastWrite ? Number(state.lastWrite.low11) & 0o3777 : 0;
        const engaging = !!(target & (1 << bit));
        const id = relayIdentity(row, bit);
        const ordinal = relayOrdinal(row, bit);
        const p = profileFor(id, ordinal);
        const settleWhen = ctx.currentTime + p.settleMs / 1000;
        settleContact(state, row, bit, p.settleMs);
        playIdentity(ctx, settleWhen, strength, id, ordinal, engaging);
        return;
      }
    }

    // Non-hardware/legacy callers retain the previous generic click rather than
    // being falsely assigned to a physical relay.
    fallbackEmitTick(ctx, when, strength);
  };

  const RELAY_SETTLE_MS = Object.freeze(Array.from({length: 12}, (_, rowIndex) =>
    Object.freeze(Array.from({length: 11}, (_, bit) =>
      settleMsForOrdinal(relayOrdinal(rowIndex + 1, bit))
    ))
  ));

  // Keep the original hardware snapshot fields intact for compatibility, while
  // exposing the effective 12 x 11 individual-contact timing used by this
  // physical-settle layer for diagnostics and field verification.
  window.AGCDSKY.hardware = () => {
    const state = baseHardware();
    state.relaySettleMs = RELAY_SETTLE_MS.map(row => row.slice());
    state.relaySettleMinMs = SETTLE_MIN_MS;
    state.relaySettleMaxMs = SETTLE_MAX_MS;
    return state;
  };

  window.DSKY_RELAY_AUDIO = Object.freeze({
    latchingRelayCount: LATCHING_RELAY_COUNT,
    auxiliaryRelayCount: AUX_ORDER.length,
    totalIndividualRelays: LATCHING_RELAY_COUNT + AUX_ORDER.length,
    relayIdentity,
    settleMsFor: (row, bit) => settleMsForOrdinal(relayOrdinal(row, bit)),
    profileFor: (row, bit) => profileFor(relayIdentity(row, bit), relayOrdinal(row, bit)),
    auxiliaryProfileFor: name => profileFor(`AUX:${AUX_LABEL[name] || String(name).toUpperCase()}`, auxOrdinal(name))
  });
})();
