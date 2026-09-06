'use strict';

// V35 acoustic timing correction.
// Luminary 99 QUIKDSP writes one dirty DSKY relay word, removes relay drive
// 20 ms later, then writes the next dirty word 20 ms after that. Therefore
// audible word activations begin 40 ms apart. The individual contact bits in a
// single word are energized together; they are not a serial click train.
(() => {
  const rowPeriodMs = typeof CLOCK_DIRTY_BANK_MS !== 'undefined' ? CLOCK_DIRTY_BANK_MS
    : (typeof V35_ROW_MS !== 'undefined' ? V35_ROW_MS : 40);

  function playV35RowClack(changed) {
    if (!changed || !tickSound) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const go = () => emitTick(ctx, ctx.currentTime + 0.002);
    if (ctx.state === 'running') go();
    else ctx.resume().then(go).catch(() => {});
  }

  // Canonical source path.
  if (typeof scheduleClockV35RowBursts === 'function') {
    scheduleClockV35RowBursts = function correctedClockV35Rows(rows) {
      clearClockV35SoundTimers();
      if (!tickSound || !rows || !rows.length) return;
      let sequence = 0;
      for (const row of rows) {
        if (!row || !row.changed) continue;
        const delay = sequence++ * rowPeriodMs;
        const timer = setTimeout(() => {
          clockV35SoundTimers = clockV35SoundTimers.filter((id) => id !== timer);
          playV35RowClack(row.changed);
        }, delay);
        clockV35SoundTimers.push(timer);
      }
    };
  }

  // v0.9 clean-SDK compatibility path.
  if (typeof scheduleV35RelaySounds === 'function') {
    scheduleV35RelaySounds = function correctedV35RelaySounds(from, to) {
      clearLampTestSoundTimers();
      if (!tickSound) return;
      const order = [11,10,9,8,7,6,5,4,3,2,1,12];
      let sequence = 0;
      for (const relay of order) {
        const changed = popcount11((from[relay] || 0) ^ (to[relay] || 0));
        if (!changed) continue;
        const delay = sequence++ * rowPeriodMs;
        const id = setTimeout(() => {
          lampTestSoundTimers = lampTestSoundTimers.filter((x) => x !== id);
          playV35RowClack(changed);
        }, delay);
        lampTestSoundTimers.push(id);
      }
    };
  }
})();
