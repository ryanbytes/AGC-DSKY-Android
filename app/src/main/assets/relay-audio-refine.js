'use strict';

// Ultra-dry relay contact click for the DSKY.
// Phone speakers and DSP can turn even a high-passed noise burst into a small
// thump because the burst envelope itself contains low-frequency energy. Avoid
// that completely: synthesize only two short ultrasonic-adjacent audio-band
// partials with a zero-start attack and no noise, no body tone, and no bounce.
(() => {
  if (typeof emitTick !== 'function' || typeof ensureAudio !== 'function') return;

  function highClick(ctx, when, strength) {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, when);
    master.gain.linearRampToValueAtTime(0.30 * tickLevel * strength, when + 0.00008);
    master.gain.exponentialRampToValueAtTime(0.0001, when + 0.00155);
    master.connect(ctx.destination);

    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(5200, when);
    g1.gain.setValueAtTime(1.0, when);
    o1.connect(g1);
    g1.connect(master);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(7600, when);
    g2.gain.setValueAtTime(0.42, when);
    o2.connect(g2);
    g2.connect(master);

    o1.start(when);
    o2.start(when);
    o1.stop(when + 0.0018);
    o2.stop(when + 0.0018);
  }

  emitTick = function dskyRelayClick(ctx, when = ctx.currentTime, strength = 1) {
    highClick(ctx, when, strength);
  };

  // One energized relay word is one audible event. Contact count affects only
  // level very slightly, never timing or the number of clicks.
  if (typeof playRelayBurst === 'function') {
    playRelayBurst = function singleHighRelayClick(count) {
      const ctx = ensureAudio();
      if (!ctx || count < 1) return;
      const go = () => {
        const strength = Math.min(1.0, 0.86 + Math.min(count, 6) * 0.02);
        emitTick(ctx, ctx.currentTime + 0.002, strength);
      };
      if (ctx.state === 'running') go();
      else ctx.resume().then(go).catch(() => {});
    };
  }
})();
