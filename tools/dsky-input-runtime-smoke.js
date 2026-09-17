#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {installServiceRegistry} = require('./test-service-registry');

const SOURCE = path.resolve(__dirname, '../app/src/main/assets/dsky-input-runtime.js');
const source = fs.readFileSync(SOURCE, 'utf8');

function fail(message) {
  console.error('DSKY INPUT RUNTIME SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const marker of [
  'const registry = window.AGCDSKY_SERVICE_REGISTRY;',
  "const runtime = registry.get('AGCDSKY_RUNTIME');",
  'function currentCore(action)',
  'function ready()',
  'function keyMake(code)',
  'function keyReset(coreOverride = null)',
  'function proceed(pressed)',
  'value <= 0',
  'core.keyPress(value)',
  'core.keyRelease()',
  'core.proceedKey(!!pressed)',
  "registry.publish('AGCDSKY_INPUT',input"
]) {
  assert(source.includes(marker), `input runtime missing marker: ${marker}`);
}
for (const forbidden of [
  'const api = window.AGCDSKY',
  'api.runtimeTransitions',
  'api.inputRuntime ='
]) {
  assert(!source.includes(forbidden), `input runtime regained public-facade dependency: ${forbidden}`);
}
assert(!/fetch\s*\(/.test(source) && !/XMLHttpRequest/.test(source),
  'input runtime must not depend on network activity');

let mode = 'clock';
const calls = [];
const core = {
  keyPress(code){ calls.push(['make', code]); return 1; },
  keyRelease(){ calls.push(['reset']); return true; },
  proceedKey(pressed){ calls.push(['proceed', !!pressed]); return 1; }
};
const MODES = Object.freeze({CLOCK:'clock',AGC_LOADING:'agc-loading',AGC:'agc'});
const runtime = Object.freeze({
  modes:MODES,
  mode(){ return mode; },
  core(){ return core; }
});
const AGCDSKY = {};
const context = {AGCDSKY, console, window:null};
context.window = context;
const registry = installServiceRegistry(context);
registry.publish('AGCDSKY_RUNTIME', runtime, 'input smoke runtime fixture');
Object.defineProperties(AGCDSKY, {
  runtimeTransitions:{enumerable:true,get(){ return context.AGCDSKY_RUNTIME || null; }},
  inputRuntime:{enumerable:true,get(){ return context.AGCDSKY_INPUT || null; }}
});
vm.createContext(context);
vm.runInContext(source, context, {filename:'dsky-input-runtime.js'});

assert(context.AGCDSKY_INPUT === AGCDSKY.inputRuntime,
  'bootstrap-owned inputRuntime getter did not resolve the shared controller');
assert(Object.isFrozen(AGCDSKY.inputRuntime),
  'input runtime API must be frozen');
assert(AGCDSKY.inputRuntime.ready() === false,
  'input runtime reported ready outside AGC mode');

let rejected = false;
try { AGCDSKY.inputRuntime.keyMake(0o21); } catch (_) { rejected = true; }
assert(rejected && calls.length === 0,
  'key make was accepted outside AGC mode');

mode = MODES.AGC;
assert(AGCDSKY.inputRuntime.ready() === true,
  'input runtime did not become ready with AGC mode/core');
assert(AGCDSKY.inputRuntime.keyMake(0o21) === 1,
  'key make result was not forwarded from the core');
assert(calls.length === 1 && calls[0][0] === 'make' && calls[0][1] === 0o21,
  'VERB keycode did not reach the core unchanged');

rejected = false;
try { AGCDSKY.inputRuntime.keyMake(0); } catch (_) { rejected = true; }
assert(rejected && calls.length === 1,
  'channel-015 zero was accepted as a key make instead of remaining KEYRST-only');

rejected = false;
try { AGCDSKY.inputRuntime.keyMake(0o40); } catch (_) { rejected = true; }
assert(rejected && calls.length === 1,
  'out-of-range channel-015 keycode was not rejected before core access');

assert(AGCDSKY.inputRuntime.proceed(true) === 1,
  'PRO make result was not forwarded from the core');
assert(AGCDSKY.inputRuntime.proceed(false) === 1,
  'PRO release result was not forwarded from the core');
assert(calls.filter(call => call[0] === 'proceed').map(call => call[1]).join(',') === 'true,false',
  'PRO maintained levels were not forwarded in order');

assert(AGCDSKY.inputRuntime.keyReset() === true,
  'KEYRST result was not forwarded from the core');
assert(calls.filter(call => call[0] === 'reset').length === 1,
  'KEYRST did not call the core exactly once');

mode = MODES.CLOCK;
assert(AGCDSKY.inputRuntime.keyReset(core) === true,
  'KEYRST override could not release the retained electrical core');
assert(calls.filter(call => call[0] === 'reset').length === 2,
  'retained-core KEYRST did not call the captured core exactly once');

const snap = AGCDSKY.inputRuntime.snapshot();
assert(snap.mode === MODES.CLOCK && snap.ready === false,
  'input runtime snapshot did not reflect current runtime state');

const prior = AGCDSKY.inputRuntime;
vm.runInContext(source, context, {filename:'dsky-input-runtime-second-load.js'});
assert(AGCDSKY.inputRuntime === prior && context.AGCDSKY_INPUT === prior,
  'second input-runtime load replaced the published controller');

console.log('DSKY input runtime smoke: PASS');
console.log('  registry-owned runtime lookup, bootstrap-owned getter, AGC gating, positive key makes, KEYRST-only zero, retained-core release, PRO maintained contact, validation, and idempotence verified');
