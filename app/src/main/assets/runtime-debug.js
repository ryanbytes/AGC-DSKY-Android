(function(global){
  'use strict';

  function report(kind, detail){
    try {
      if (global.DebugBridge && typeof global.DebugBridge.report === 'function') {
        global.DebugBridge.report(kind + '\n' + detail);
      }
    } catch (_) {
      // Diagnostic reporting must never create a second app failure.
    }
  }

  function describe(value){
    if (value && value.stack) return String(value.stack);
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  // app.js deliberately handles AGC/WASM failures by logging an Error object
  // and falling back to clock mode. Because those failures are handled,
  // window.onerror does not see them. Mirror stack-bearing console errors into
  // the local native report while keeping string-only stderr (including any
  // ordinary yaAGC/WASI text) out of the failure file. WebChromeClient still
  // sees all console errors for interactive debugging.
  if (global.console && typeof global.console.error === 'function') {
    const originalConsoleError = global.console.error.bind(global.console);
    global.console.error = function(){
      const args = Array.prototype.slice.call(arguments);
      originalConsoleError.apply(null, args);
      if (args.some(function(value){ return value && value.stack; })) {
        report('CONSOLE ERROR', args.map(describe).join('\n'));
      }
    };
  }

  global.addEventListener('error', function(event){
    const error = event && event.error;
    const stack = error && error.stack ? String(error.stack) : '';
    const message = event && event.message ? String(event.message) : String(error || 'unknown error');
    const source = event && event.filename ? String(event.filename) : '(unknown source)';
    const line = event && event.lineno ? ':' + event.lineno + ':' + (event.colno || 0) : '';
    report('UNHANDLED JAVASCRIPT ERROR', source + line + '\n' + message + (stack ? '\n' + stack : ''));
  });

  global.addEventListener('unhandledrejection', function(event){
    const reason = event ? event.reason : null;
    const detail = reason && reason.stack ? String(reason.stack) : String(reason || 'unknown rejection');
    report('UNHANDLED PROMISE REJECTION', detail);
  });
})(window);
