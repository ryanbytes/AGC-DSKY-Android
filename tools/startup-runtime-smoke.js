#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const read = name => fs.readFileSync(path.join(ASSETS, name), 'utf8');
const startup = read('startup-defaults.js');
const resources = read('page-resource-lifecycle.js');
const codec = read('agc-snapshot-codec.js');
const camera = read('camera-error-policy.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const forbidden of [
  'AudioContext',
  'requestAnimationFrame',
  'exportSnapshot',
  'importSnapshot',
  'console.error',
  'AGCLifecycle'
]) {
  assert(!startup.includes(forbidden), `startup-defaults retained extracted responsibility: ${forbidden}`);
}
assert(startup.includes("localStorage.getItem('runMode') === null"),
  'startup-defaults lost first-run CLOCK default');

for (const token of [
  'window.setTimeout =',
  'window.setInterval =',
  'window.requestAnimationFrame =',
  'audioContexts.add(context)',
  "if (context.state === 'closed') audioContexts.delete(context);",
  'window.AGCLifecycle = Object.freeze({',
  "window.addEventListener('pagehide'",
  "window.addEventListener('unload'"
]) assert(resources.includes(token), `page resource lifecycle missing ${token}`);
for (const forbidden of ['exportSnapshot', 'importSnapshot', 'SXT camera'])
  assert(!resources.includes(forbidden), `page resource lifecycle crossed boundary: ${forbidden}`);

for (const token of [
  'Core.prototype.exportSnapshot',
  'Core.prototype.importSnapshot',
  'ENCODE_BYTES = 0x6000',
  'DECODE_CHARS = 0x8000',
  "Object.defineProperty(Core.prototype, '__chunkedSnapshotCodec'"
]) assert(codec.includes(token), `snapshot codec missing ${token}`);
for (const forbidden of ['window.setTimeout =', 'AGCLifecycle', 'SXT camera'])
  assert(!codec.includes(forbidden), `snapshot codec crossed boundary: ${forbidden}`);

for (const token of [
  "args[0] === 'SXT camera'",
  "name === 'AbortError'",
  "name === 'NotAllowedError'",
  "name === 'SecurityError'",
  "Object.defineProperty(console, '__agcCameraErrorsClassified'"
]) assert(camera.includes(token), `camera policy missing ${token}`);
for (const forbidden of ['AGCLifecycle', 'exportSnapshot', 'window.setTimeout ='])
  assert(!camera.includes(forbidden), `camera policy crossed boundary: ${forbidden}`);

// startup default behavior
{
  const storage = new Map();
  const context = {
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value))
    }
  };
  vm.createContext(context);
  vm.runInContext(startup, context, {filename:'startup-defaults.js'});
  assert(storage.get('runMode') === 'clock', 'first-run CLOCK default not written');
  storage.set('runMode', 'agc');
  vm.runInContext(startup, context, {filename:'startup-defaults.js#second'});
  assert(storage.get('runMode') === 'agc', 'startup default overwrote existing run mode');
}

// page-scoped resource lifecycle behavior
{
  let timerId = 0;
  const timeouts = new Map();
  const intervals = new Map();
  const listeners = new Map();
  let coreStops = 0;

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.listeners = new Map();
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatch(type) {
      for (const fn of this.listeners.get(type) || []) fn();
    }
    close() {
      this.state = 'closed';
      this.dispatch('statechange');
      return Promise.resolve();
    }
  }

  const context = {
    console,
    Reflect,
    Object,
    Set,
    Promise,
    AudioContext: FakeAudioContext,
    webkitAudioContext: undefined,
    setTimeout(fn) { const id = ++timerId; timeouts.set(id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn) { const id = ++timerId; intervals.set(id, fn); return id; },
    clearInterval(id) { intervals.delete(id); },
    addEventListener(type, fn) { listeners.set(type, fn); },
    document: {querySelectorAll() { return []; }},
    AGCDSKY: {getCore() { return {stop() { coreStops += 1; }}; }}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(resources, context, {filename:'page-resource-lifecycle.js'});

  const t = context.setTimeout(() => {}, 100);
  const i = context.setInterval(() => {}, 100);
  assert(context.AGCLifecycle.counts().timeouts === 1, 'timeout not tracked');
  assert(context.AGCLifecycle.counts().intervals === 1, 'interval not tracked');
  context.clearTimeout(t);
  context.clearInterval(i);
  assert(context.AGCLifecycle.counts().timeouts === 0, 'timeout not released');
  assert(context.AGCLifecycle.counts().intervals === 0, 'interval not released');

  const audio = new context.AudioContext();
  assert(context.AGCLifecycle.counts().audioContexts === 1, 'AudioContext not tracked');
  audio.close();
  assert(context.AGCLifecycle.counts().audioContexts === 0, 'closed AudioContext retained');

  context.setTimeout(() => {}, 100);
  context.setInterval(() => {}, 100);
  context.AGCLifecycle.shutdown();
  assert(context.AGCLifecycle.counts().timeouts === 0, 'shutdown retained timeout');
  assert(context.AGCLifecycle.counts().intervals === 0, 'shutdown retained interval');
  assert(coreStops === 1, 'shutdown did not stop active AGC core');
  assert(typeof listeners.get('pagehide') === 'function' && typeof listeners.get('unload') === 'function',
    'teardown listeners not installed');
}

// chunked AGC snapshot codec behavior
{
  class FakeCore {
    constructor() {
      this.memory = {buffer:new ArrayBuffer(96)};
      this.channels = {old:true};
      this.totalSteps = 77;
      this.startTime = -1;
      this.stopCount = 0;
    }
    stop() { this.stopCount += 1; }
    snapshotFingerprint() {
      return Array.from(new Uint8Array(this.memory.buffer)).reduce((a,b) => (a + b) >>> 0, 0).toString(16);
    }
  }
  const context = {
    window:null,
    AgcCore:FakeCore,
    Object,
    Math,
    Uint8Array,
    ArrayBuffer,
    String,
    Error,
    performance:{now:() => 1234},
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary')
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(codec, context, {filename:'agc-snapshot-codec.js'});

  const source = new FakeCore();
  const sourceBytes = new Uint8Array(source.memory.buffer);
  for (let n = 0; n < sourceBytes.length; n++) sourceBytes[n] = (n * 37) & 0xff;
  const snapshot = source.exportSnapshot();
  assert(snapshot.schema === 1 && snapshot.byteLength === 96, 'snapshot metadata changed');

  const target = new FakeCore();
  assert(target.importSnapshot(snapshot) === true, 'snapshot import failed');
  assert(Buffer.from(target.memory.buffer).equals(Buffer.from(source.memory.buffer)),
    'snapshot round-trip changed AGC memory');
  assert(target.stopCount === 1, 'snapshot import did not stop core before restore');
  assert(Object.keys(target.channels).length === 0 && target.totalSteps === 0 && target.startTime === 1234,
    'snapshot import did not reset runtime accounting');
}

// camera console classification behavior
{
  const errors = [];
  const warnings = [];
  const fakeConsole = {
    error: (...args) => errors.push(args),
    warn: (...args) => warnings.push(args)
  };
  const context = {window:null, console:fakeConsole, Object, String};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(camera, context, {filename:'camera-error-policy.js'});

  context.console.error('SXT camera', {name:'NotAllowedError', message:'permission denied'});
  assert(warnings.length === 1 && errors.length === 0,
    'expected camera permission denial was not downgraded');
  assert(warnings[0][1] === 'NotAllowedError: permission denied',
    'camera warning detail lost DOMException information');

  context.console.error('SXT camera', {name:'NotReadableError', message:'device failed'});
  assert(errors.length === 1 && errors[0][1] === 'NotReadableError: device failed',
    'unexpected camera failure was not preserved as a useful error');
}

console.log('startup runtime smoke: PASS');
console.log('  startup default, page resource lifecycle, chunked AGC snapshot codec, and camera error policy are isolated and behaviorally preserved');
