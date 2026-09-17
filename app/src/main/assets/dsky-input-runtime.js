(() => {
  'use strict';

  const registry = window.AGCDSKY_SERVICE_REGISTRY;
  if (!registry) throw new Error('AGC service registry unavailable');
  if (registry.get('AGCDSKY_INPUT')) return;

  const runtime = registry.get('AGCDSKY_RUNTIME');
  if (!runtime
      || typeof runtime.mode !== 'function'
      || typeof runtime.core !== 'function'
      || !runtime.modes) {
    throw new Error('Shared AGC runtime authority unavailable');
  }

  function currentCore(action) {
    const currentMode = runtime.mode();
    if (currentMode !== runtime.modes.AGC) {
      throw new Error(`${action} requires AGC mode; current mode is ${currentMode || 'unknown'}`);
    }
    const core = runtime.core();
    if (!core) throw new Error(`${action} requires a loaded AGC core`);
    return core;
  }

  function ready() {
    try {
      return runtime.mode() === runtime.modes.AGC && !!runtime.core();
    } catch (_) {
      return false;
    }
  }

  function keyMake(code) {
    const value = Number(code);
    // Channel 015 zero is the all-released/KEYRST level, never a key make.
    if (!Number.isInteger(value) || value <= 0 || value > 0o37) {
      throw new Error(`Invalid DSKY keycode: ${code}`);
    }
    const core = currentCore('DSKY key make');
    if (typeof core.keyPress === 'function') return core.keyPress(value);
    if (typeof core.writeIo === 'function') return core.writeIo(0o15, value);
    throw new Error('AGC core has no channel-015 key make primitive');
  }

  function keyReset(coreOverride = null) {
    const core = coreOverride || currentCore('DSKY KEYRST');
    if (typeof core.keyRelease === 'function') return core.keyRelease();
    if (typeof core.writeIo === 'function') return core.writeIo(0o15, 0);
    throw new Error('AGC core has no channel-015 KEYRST primitive');
  }

  function proceed(pressed) {
    const core = currentCore('DSKY PRO contact');
    if (typeof core.proceedKey !== 'function') {
      throw new Error('AGC core has no channel-032 PRO primitive');
    }
    return core.proceedKey(!!pressed);
  }

  const input = Object.freeze({
    ready,
    keyMake,
    keyReset,
    proceed,
    snapshot:() => ({
      mode:runtime.mode(),
      ready:ready()
    })
  });

  registry.publish('AGCDSKY_INPUT',input,'dsky-input-runtime publication');
})();
