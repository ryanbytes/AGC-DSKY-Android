(() => {
  try {
    if (localStorage.getItem('runMode') === null) {
      localStorage.setItem('runMode', 'clock');
    }
  } catch (e) {
    // app.js already handles unavailable localStorage; leave its in-memory clock default alone.
  }

  // Track page-owned asynchronous work so WebView teardown does not leave
  // timers, animation callbacks, camera tracks, or a running AGC core alive
  // while Chromium releases the document.
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const nativeRequestAnimationFrame = typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window) : null;
  const nativeCancelAnimationFrame = typeof window.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame.bind(window) : null;

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
      animationFrames: animationFrames.size
    })
  });

  window.addEventListener('pagehide', event => {
    if (!event.persisted) shutdown();
  }, {capture:true});
  window.addEventListener('unload', shutdown, {capture:true, once:true});
})();
