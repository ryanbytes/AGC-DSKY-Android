#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GUARD_JS = path.join(ROOT, 'app/src/main/assets/background-audio-guard.js');
const STARTUP_DEFAULTS = path.join(ROOT, 'app/src/main/assets/startup-defaults.js');
const DEBUG_REPORTER = path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/DebugReporter.java');
const guardSource = fs.readFileSync(GUARD_JS, 'utf8');
const startupDefaultsSource = fs.readFileSync(STARTUP_DEFAULTS, 'utf8');
const debugReporterSource = fs.readFileSync(DEBUG_REPORTER, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeHarness({dream = false, hidden = false} = {}) {
  const reports = [];
  const instances = [];
  const scheduled = new Map();
  let timerId = 0;

  class FakeAudioContext {
    static nextState = 'running';
    static nextResumeError = null;
    constructor() {
      this.state = FakeAudioContext.nextState;
      this.resumeError = FakeAudioContext.nextResumeError;
      FakeAudioContext.nextState = 'running';
      FakeAudioContext.nextResumeError = null;
      this.currentTime = 1;
      this.listeners = new Map();
      this.closeCount = 0;
      instances.push(this);
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatch(type, event = {}) {
      for (const fn of this.listeners.get(type) || []) fn(event);
    }
    resume() {
      if (this.resumeError) return Promise.reject(this.resumeError);
      this.state = 'running';
      this.dispatch('statechange');
      return Promise.resolve();
    }
    close() {
      this.closeCount += 1;
      this.state = 'closed';
      this.dispatch('statechange');
      return Promise.resolve();
    }
  }

  const soundButton = {textContent: 'RELAY CLICKS ON'};
  const context = {
    console,
    Promise,
    WeakSet,
    Map,
    Object,
    Number,
    String,
    Math,
    Error,
    setTimeout(fn) {
      const id = ++timerId;
      scheduled.set(id, fn);
      return id;
    },
    clearTimeout(id) { scheduled.delete(id); },
    document: {
      hidden,
      getElementById(id) { return id === 'sound' ? soundButton : null; },
      addEventListener() {}
    },
    appVisible: !hidden,
    dream,
    tickSound: true,
    audioCtx: null,
    DebugBridge: {report(detail) { reports.push(String(detail)); }},
    AGCDSKY: {},
    instances,
    reports,
    soundButton,
    scheduled,
    FakeAudioContext,
    baseBurstCalls: 0,
    baseTickCalls: 0,
    applyCalls: 0
  };
  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(`
    function ensureAudio(){
      if(!audioCtx) audioCtx = new window.AudioContext();
      return audioCtx;
    }
    function emitTick(){ baseTickCalls++; }
    function playRelayBurst(){
      const ctx = ensureAudio();
      if(ctx) baseBurstCalls++;
    }
    function applyTickSound(){ applyCalls++; }
    function setTickSound(value){ tickSound=!!value; }
  `, context, {filename: 'audio-base.js'});
  context.AudioContext = FakeAudioContext;
  context.webkitAudioContext = undefined;
  vm.runInContext(guardSource, context, {filename: 'background-audio-guard.js'});
  return context;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

(async () => {
  assert(guardSource.includes("addEventListener('error'"),
    'background audio guard must listen for AudioContext renderer errors');
  assert(guardSource.includes("ctx.state === 'closed'"),
    'background audio guard must replace closed AudioContexts');
  assert(guardSource.includes('AUDIO_FAILURE_LIMIT = 2'),
    'background audio guard must bound automatic recovery attempts');
  assert(startupDefaultsSource.includes("if (context.state === 'closed') audioContexts.delete(context);"),
    'lifecycle tracker must release closed AudioContext wrappers');

  const chromiumMessage = 'The AudioContext encountered an error from the audio device or the WebAudio renderer.';
  assert(debugReporterSource.includes(chromiumMessage),
    'DebugReporter must recognize Chromium\'s recoverable renderer message');
  assert(debugReporterSource.includes('isRecoverableWebAudioRenderError(detail)'),
    'DebugReporter must suppress the raw Chromium message after JS recovery owns it');

  const h = makeHarness();
  const first = h.ensureAudio();
  assert(first === h.instances[0], 'first ensureAudio must return the first context');

  first.dispatch('error', {error: new Error('renderer failed')});
  assert(first.closeCount === 1, 'renderer failure must retire/close the failed context');
  assert(h.AGCDSKY.audioStatus().state === 'none', 'failed context must be cleared');
  assert(h.AGCDSKY.audioStatus().failures === 1, 'first renderer failure must be counted');
  assert(!h.AGCDSKY.audioStatus().circuitOpen, 'one failure must allow one replacement');

  const replacement = h.ensureAudio();
  assert(replacement && replacement !== first, 'next audible event must create a fresh context');
  assert(h.instances.length === 2, 'exactly one replacement context should be created');
  const stableTimerCount = h.scheduled.size;
  h.ensureAudio();
  h.ensureAudio();
  assert(h.scheduled.size === stableTimerCount,
    'ordinary relay activity must not perpetually restart the stability timer');

  replacement.dispatch('error', {error: new Error('replacement failed')});
  assert(h.AGCDSKY.audioStatus().circuitOpen,
    'second consecutive failure must open the circuit breaker');
  assert(h.reports.length === 1,
    'unrecovered repeated failure must create one local debug report');
  assert(/WebAudio recovery failed/.test(h.reports[0]),
    'debug report must identify WebAudio recovery failure');
  assert(/OFF\/ON TO RETRY/.test(h.soundButton.textContent),
    'sound button must explain manual retry');

  const countBeforeBlockedEnsure = h.instances.length;
  assert(h.ensureAudio() === null, 'circuit-open ensureAudio must return null');
  assert(h.instances.length === countBeforeBlockedEnsure,
    'circuit breaker must prevent automatic retry loops');

  h.setTickSound(false);
  h.applyTickSound();
  h.setTickSound(true);
  h.applyTickSound();
  assert(!h.AGCDSKY.audioStatus().circuitOpen,
    'RELAY CLICKS OFF/ON must reset the circuit breaker');
  const manualRetry = h.ensureAudio();
  assert(manualRetry && h.instances.length === 3,
    'manual retry must permit a fresh context');

  manualRetry.state = 'closed';
  const afterClosed = h.ensureAudio();
  assert(afterClosed && afterClosed !== manualRetry,
    'closed AudioContext must be replaced');
  assert(h.instances.length === 4,
    'closed-context replacement must create exactly one context');
  assert(h.AGCDSKY.audioStatus().failures === 0,
    'ordinary closed-context replacement is not a renderer failure');

  const r = makeHarness();
  r.FakeAudioContext.nextState = 'suspended';
  r.FakeAudioContext.nextResumeError = new Error('device unavailable');
  assert(r.ensureAudio(), 'suspended context should exist while resume settles');
  await flushPromises();
  assert(r.AGCDSKY.audioStatus().state === 'none',
    'resume rejection must retire the context');
  assert(r.AGCDSKY.audioStatus().failures === 1,
    'resume rejection must count as a recoverable failure');

  const p = makeHarness();
  p.FakeAudioContext.nextState = 'suspended';
  const policy = new Error('gesture required');
  policy.name = 'NotAllowedError';
  p.FakeAudioContext.nextResumeError = policy;
  const policyCtx = p.ensureAudio();
  await flushPromises();
  assert(p.AGCDSKY.audioStatus().state === 'suspended',
    'NotAllowedError must keep the context for a later user gesture');
  assert(p.AGCDSKY.audioStatus().failures === 0,
    'NotAllowedError must not count as renderer failure');
  assert(policyCtx.closeCount === 0,
    'NotAllowedError must not close the context');

  const dream = makeHarness({dream: true});
  assert(dream.ensureAudio() === null && dream.instances.length === 0,
    'late recovery guard must not re-enable WebAudio in Dream mode');

  const hidden = makeHarness({hidden: true});
  assert(hidden.ensureAudio() === null && hidden.instances.length === 0,
    'hidden app must not create/resume relay audio');

  console.log('audio recovery smoke: PASS');
  console.log('  renderer error -> one fresh context');
  console.log('  repeated failure -> circuit breaker + one debug report');
  console.log('  closed context -> replaced');
  console.log('  resume rejection -> retired; NotAllowedError retained');
  console.log('  Dream/hidden modes remain silent');
  console.log('  closed contexts are removed from lifecycle tracking');
  console.log('  raw Chromium renderer error is filtered from startup crash reports');
})();
