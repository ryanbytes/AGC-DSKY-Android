'use strict';

// Own page-scoped browser resources so WebView teardown can synchronously retire
// timers, animation callbacks, Web Audio contexts, media tracks, and the AGC core.
(() => {
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const nativeRequestAnimationFrame = typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window) : null;
  const nativeCancelAnimationFrame = typeof window.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame.bind(window) : null;

  const audioContexts = new Set();
  (() => {
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    if (typeof NativeAudioContext !== 'function') return;
    function TrackedAudioContext(...args) {
      const context = Reflect.construct(NativeAudioContext, args, NativeAudioContext);
      audioContexts.add(context);
      if (typeof context.addEventListener === 'function') {
        context.addEventListener('statechange', () => {
          if (context.state === 'closed') audioContexts.delete(context);
        });
      }
      return context;
    }
    TrackedAudioContext.prototype = NativeAudioContext.prototype;
    try { Object.setPrototypeOf(TrackedAudioContext, NativeAudioContext); } catch (_) {}
    try { window.AudioContext = TrackedAudioContext; } catch (_) {}
    try {
      if (window.webkitAudioContext === NativeAudioContext) {
        window.webkitAudioContext = TrackedAudioContext;
      }
    } catch (_) {}
  })();

  const timeouts = new Set();
  const intervals = new Set();
  const animationFrames = new Set();
  let shuttingDown = false;

  window.setTimeout = (callback, delay, ...args) => {
    let id = 0;
    if (typeof callback === 'function') {
      id = nativeSetTimeout((...callbackArgs) => {
        timeouts.delete(id);
        callback(...callbackArgs);
      }, delay, ...args);
    } else {
      id = nativeSetTimeout(callback, delay, ...args);
    }
    timeouts.add(id);
    return id;
  };

  window.clearTimeout = id => {
    timeouts.delete(id);
    intervals.delete(id);
    return nativeClearTimeout(id);
  };

  window.setInterval = (callback, delay, ...args) => {
    const id = nativeSetInterval(callback, delay, ...args);
    intervals.add(id);
    return id;
  };

  window.clearInterval = id => {
    intervals.delete(id);
    timeouts.delete(id);
    return nativeClearInterval(id);
  };

  if (nativeRequestAnimationFrame && nativeCancelAnimationFrame) {
    window.requestAnimationFrame = callback => {
      let id = 0;
      id = nativeRequestAnimationFrame(timestamp => {
        animationFrames.delete(id);
        callback(timestamp);
      });
      animationFrames.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => {
      animationFrames.delete(id);
      return nativeCancelAnimationFrame(id);
    };
  }

  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const id of timeouts) nativeClearTimeout(id);
    for (const id of intervals) nativeClearInterval(id);
    if (nativeCancelAnimationFrame) {
      for (const id of animationFrames) nativeCancelAnimationFrame(id);
    }
    timeouts.clear();
    intervals.clear();
    animationFrames.clear();

    for (const context of audioContexts) {
      try {
        if (context && context.state !== 'closed' && typeof context.close === 'function') {
          context.close().catch(() => {});
        }
      } catch (_) {}
    }
    audioContexts.clear();

    try {
      const core = window.AGCDSKY && typeof window.AGCDSKY.getCore === 'function'
        ? window.AGCDSKY.getCore() : null;
      if (core && typeof core.stop === 'function') core.stop();
    } catch (_) {}

    try {
      document.querySelectorAll('video,audio').forEach(media => {
        try { media.pause(); } catch (_) {}
        const stream = media.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
          for (const track of stream.getTracks()) {
            try { track.stop(); } catch (_) {}
          }
        }
        try { media.srcObject = null; } catch (_) {}
      });
    } catch (_) {}
  }

  window.AGCLifecycle = Object.freeze({
    shutdown,
    counts: () => ({
      timeouts: timeouts.size,
      intervals: intervals.size,
      animationFrames: animationFrames.size,
      audioContexts: audioContexts.size
    })
  });

  window.addEventListener('pagehide', event => {
    if (!event.persisted) shutdown();
  }, {capture:true});
  window.addEventListener('unload', shutdown, {capture:true, once:true});
})();
