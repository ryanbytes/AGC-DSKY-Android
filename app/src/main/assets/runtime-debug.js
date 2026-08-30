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

  // A strict CSP intentionally protects the offline page. If a WebView version
  // rejects the WASM exception or a future edit tries to load an unauthorized
  // resource, make the violation visible in the native debug report instead of
  // leaving only a blank/partially initialized WebView as evidence.
  global.addEventListener('securitypolicyviolation', function(event){
    const directive = event && event.effectiveDirective
      ? String(event.effectiveDirective) : '(unknown directive)';
    const blocked = event && event.blockedURI ? String(event.blockedURI) : '(unknown resource)';
    const source = event && event.sourceFile ? String(event.sourceFile) : '(unknown source)';
    const line = event && event.lineNumber
      ? ':' + event.lineNumber + ':' + (event.columnNumber || 0) : '';
    report('CONTENT SECURITY POLICY VIOLATION',
      'Directive: ' + directive + '\nBlocked: ' + blocked + '\nSource: ' + source + line);
  });

  // Device smoke tests need more than a live Android process: prove the local
  // frontend initialized far enough to render EL glyphs and load the complete
  // public relay-diagnostic layer. The callback runs after all ordinary page
  // scripts, including app-refine.js. The native ready() bridge emits only in
  // debuggable builds.
  global.addEventListener('load', function(){
    try {
      const doc = global.document;
      const prog = doc && doc.getElementById ? doc.getElementById('prog') : null;
      const mission = doc && doc.getElementById ? doc.getElementById('mission') : null;
      const initialized = !!(global.AGCDSKY
          && typeof global.AGCDSKY.snapshotRelays === 'function'
          && typeof global.AGCDSKY.snapshotDsky === 'function'
          && prog && typeof prog.innerHTML === 'string' && prog.innerHTML.indexOf('el-glyph') >= 0
          && mission && String(mission.textContent || '').length > 0);
      if (initialized
          && global.DebugBridge
          && typeof global.DebugBridge.ready === 'function') {
        const dream = doc.body && doc.body.classList && doc.body.classList.contains('dream');
        global.DebugBridge.ready(dream ? 'dream' : 'app');
      }
    } catch (_) {
      // A missing readiness marker will fail the device smoke. Do not turn the
      // diagnostic helper itself into a second app error.
    }
  });
})(window);
