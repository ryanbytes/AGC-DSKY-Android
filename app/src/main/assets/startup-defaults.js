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


  // Track every Web Audio context created by the page. app.js normally creates
  // only one relay-click context, but closing all of them here guarantees native
  // audio resources are released immediately during WebView teardown.
  const audioContexts = new Set();
  (() => {
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    if (typeof NativeAudioContext !== 'function') return;
    function TrackedAudioContext(...args) {
      const context = Reflect.construct(NativeAudioContext, args, NativeAudioContext);
      audioContexts.add(context);
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

  // Keep the existing snapshot schema while encoding/decoding the WebAssembly
  // image in chunks. This avoids constructing a second full-size binary string
  // during export and avoids one giant atob() result during import.
  (() => {
    const Core = window.AgcCore;
    if (!Core || !Core.prototype || Core.prototype.__chunkedSnapshotCodec) return;
    const ENCODE_BYTES = 0x6000; // 24 KiB, divisible by 3.
    const DECODE_CHARS = 0x8000; // 32 KiB base64, divisible by 4.

    Core.prototype.exportSnapshot = function() {
      if (!this.memory) throw new Error('AGC core not loaded');
      const bytes = new Uint8Array(this.memory.buffer);
      const pieces = [];
      for (let i = 0; i < bytes.length; i += ENCODE_BYTES) {
        const part = bytes.subarray(i, Math.min(bytes.length, i + ENCODE_BYTES));
        let binary = '';
        for (let j = 0; j < part.length; j += 0x1000) {
          const block = part.subarray(j, Math.min(part.length, j + 0x1000));
          binary += String.fromCharCode.apply(null, block);
        }
        pieces.push(btoa(binary));
      }
      return {
        schema: 1,
        byteLength: bytes.length,
        fingerprint: this.snapshotFingerprint(),
        memoryB64: pieces.join('')
      };
    };

    Core.prototype.importSnapshot = function(snapshot) {
      if (!this.memory) throw new Error('AGC core not loaded');
      if (!snapshot || snapshot.schema !== 1 || typeof snapshot.memoryB64 !== 'string') {
        throw new Error('Unsupported AGC snapshot');
      }
      const bytes = new Uint8Array(this.memory.buffer);
      if (snapshot.byteLength !== bytes.length) {
        throw new Error('AGC snapshot memory size mismatch');
      }
      const encoded = snapshot.memoryB64;
      const expectedChars = 4 * Math.ceil(bytes.length / 3);
      if (encoded.length !== expectedChars
          || (encoded.length & 3) !== 0
          || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
        throw new Error('AGC snapshot base64 size/format mismatch');
      }

      this.stop();
      let offset = 0;
      for (let i = 0; i < encoded.length; i += DECODE_CHARS) {
        const binary = atob(encoded.slice(i, Math.min(encoded.length, i + DECODE_CHARS)));
        if (offset + binary.length > bytes.length) {
          throw new Error('AGC snapshot decoded length overflow');
        }
        for (let j = 0; j < binary.length; j++) {
          bytes[offset++] = binary.charCodeAt(j) & 0xff;
        }
      }
      if (offset !== bytes.length) {
        throw new Error('AGC snapshot decoded length mismatch');
      }
      if (snapshot.fingerprint && this.snapshotFingerprint() !== snapshot.fingerprint) {
        throw new Error('AGC snapshot fingerprint mismatch');
      }
      this.channels = Object.create(null);
      this.totalSteps = 0;
      this.startTime = performance.now();
      return true;
    };

    Object.defineProperty(Core.prototype, '__chunkedSnapshotCodec', {
      value: true,
      enumerable: false
    });
  })();

  // WebView may briefly change page visibility while Android is presenting the
  // runtime camera permission UI. optics.js can therefore enter getUserMedia()
  // twice before its first request has populated the stream variable. Coalesce
  // simultaneous native camera requests so Chromium never has to arbitrate two
  // camera opens from the same page.
  (() => {
    const media = navigator.mediaDevices;
    if (!media || typeof media.getUserMedia !== 'function' || media.__agcSingleFlightCamera) return;
    const nativeGetUserMedia = media.getUserMedia.bind(media);
    let inFlight = null;
    try {
      media.getUserMedia = constraints => {
        if (inFlight) return inFlight;
        const request = Promise.resolve().then(() => nativeGetUserMedia(constraints));
        inFlight = request.finally(() => {
          if (inFlight) inFlight = null;
        });
        return inFlight;
      };
      Object.defineProperty(media, '__agcSingleFlightCamera', {
        value: true,
        enumerable: false
      });
    } catch (_) {}
  })();

  // The prototype debug reporter intentionally records console.error. Camera
  // permission denial and WebView lifecycle AbortError are normal UI outcomes,
  // not application failures. Downgrade those specific SXT cases to warnings;
  // for real camera failures preserve console.error but stringify the DOMException
  // so the report contains its useful name/message instead of [object DOMException].
  (() => {
    if (!window.console || typeof console.error !== 'function' || console.__agcCameraErrorsClassified) return;
    const nativeError = console.error.bind(console);
    const nativeWarn = typeof console.warn === 'function'
      ? console.warn.bind(console) : nativeError;
    console.error = (...args) => {
      if (args[0] === 'SXT camera' && args[1] && typeof args[1] === 'object') {
        const err = args[1];
        const name = err.name ? String(err.name) : 'CameraError';
        const message = err.message ? String(err.message) : '';
        const detail = message ? `${name}: ${message}` : name;
        if (name === 'AbortError' || name === 'NotAllowedError' || name === 'SecurityError') {
          nativeWarn('SXT camera', detail);
          return;
        }
        nativeError('SXT camera', detail);
        return;
      }
      nativeError(...args);
    };
    try {
      Object.defineProperty(console, '__agcCameraErrorsClassified', {
        value: true,
        enumerable: false
      });
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
