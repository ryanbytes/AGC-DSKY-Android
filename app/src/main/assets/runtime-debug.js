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
