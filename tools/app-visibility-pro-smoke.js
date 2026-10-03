#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const assets = path.resolve(__dirname, '../app/src/main/assets');
const read = name => fs.readFileSync(path.join(assets, name), 'utf8');
const apiSource = read('agc-api-runtime.js');
const transitionSource = read('runtime-transitions.js');
const inputSource = read('dsky-input-runtime.js');
const proceedSource = read('proceed-electrical.js');
const activitySource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const CHANNEL_032_PRO = 0o20000;
let mode = 'agc';
let channel032 = CHANNEL_032_PRO;
let coreRunning = true;
const events = [];
const pointerListeners = Object.create(null);
const documentListeners = Object.create(null);
const pressed = new Set();
const proButton = {
  classList:{add:name => pressed.add(name), remove:name => pressed.delete(name)},
  addEventListener(type, handler) {
    assert(!pointerListeners[type], `duplicate PRO ${type} listener`);
    pointerListeners[type] = handler;
  },
  setPointerCapture() {}
};
const documentObject = {
  hidden:false,
  querySelector(selector) { return selector === '[data-key="P"]' ? proButton : null; },
  addEventListener(type, handler) {
    assert(!documentListeners[type], `duplicate document ${type} listener`);
    documentListeners[type] = handler;
  }
};
const core = {
  proceedKey(held) {
    channel032 = held ? channel032 & ~CHANNEL_032_PRO : channel032 | CHANNEL_032_PRO;
    events.push(['pro', !!held, channel032]);
    return true;
  }
};
const lifecycle = {
  status:() => ({mode}),
  enterAgc(){mode='agc';coreRunning=true;return {mode};},
  enterClock(){mode='clock';coreRunning=false;return {mode};},
  setAppVisible(visible){
    events.push([visible ? 'show' : 'hide', channel032, coreRunning]);
    coreRunning = !!visible;
    return true;
  }
};
const context = {
  console,
  Date,
  Object,
  document:documentObject,
  AGCDSKY_APP_STATE:{selectedMission:'comanche055',ntpStatus:{}},
  AGCDSKY_CORE_SESSION:{core},
  AGCDSKY_SHELL:{initialize(){},clockTimeLabel:()=>'',accurateTime:()=>0,accurateDate:()=>new Date(0),updateNtpStatus(){}},
  AGCDSKY_RENDERER:{},
  AGCDSKY_ENVIRONMENT:{},
  AGCDSKY_AUDIO:{context:()=>null},
  AGCDSKY_CLOCK:{},
  AGCDSKY_DISPLAY:{onChannel(){}},
  AGCDSKY_SNAPSHOT:{save(){},clear(){},savedInfo(){},verifyRoundTrip(){},scheduleAutosave(){}},
  AGCDSKY_LIFECYCLE:lifecycle,
  window:null
};
context.window = context;
vm.createContext(context);
for (const [name, source] of [
  ['agc-api-runtime.js', apiSource],
  ['runtime-transitions.js', transitionSource],
  ['dsky-input-runtime.js', inputSource],
  ['proceed-electrical.js', proceedSource]
]) vm.runInContext(source, context, {filename:name});

function nativeJavascript(field) {
  const match = activitySource.match(new RegExp(`\\b${field}\\s*=\\s*"([^"]+)"`));
  assert(match, `${field} was not found in SensorMainActivity`);
  return match[1];
}
function runNativeCallback(field) {
  vm.runInContext(nativeJavascript(field), context, {filename:`SensorMainActivity.${field}`});
}
function pointer(type, pointerId) {
  const event = {
    pointerId,
    prevented:false,
    stopped:false,
    preventDefault(){this.prevented=true;},
    stopImmediatePropagation(){this.stopped=true;}
  };
  pointerListeners[type](event);
  return event;
}

assert(channel032 & CHANNEL_032_PRO, 'channel 032 must start with PRO released/high');
pointer('pointerdown', 17);
assert(!(channel032 & CHANNEL_032_PRO) && context.AGCDSKY.proceedElectrical.state().held,
  'the real input/PRO modules did not assert the channel-032 contact on pointerdown');

runNativeCallback('JS_APP_HIDDEN');
const hide = events.find(event => event[0] === 'hide');
assert(hide && (hide[1] & CHANNEL_032_PRO), 'native onPause hid the app before releasing PRO to channel 032');
assert(!context.AGCDSKY.proceedElectrical.state().held && !pressed.has('pressed'),
  'native onPause left the real PRO service or button ownership held');
assert(!coreRunning, 'native onPause did not reach the lifecycle pause after releasing PRO');

const callsAfterHide = events.filter(event => event[0] === 'pro').length;
runNativeCallback('JS_APP_VISIBLE');
assert(coreRunning, 'native onResume did not resume the lifecycle after its hide/show handoff');
pointer('pointerup', 17);
assert(events.filter(event => event[0] === 'pro').length === callsAfterHide,
  'stale pointerup after pause/resume changed the released PRO contact');

pointer('pointerdown', 23);
assert(!(channel032 & CHANNEL_032_PRO), 'a fresh post-resume PRO press was ignored');
pointer('pointerup', 23);
assert(channel032 & CHANNEL_032_PRO, 'a fresh post-resume PRO release did not restore the active-high input bit');
assert(!context.AGCDSKY.proceedElectrical.state().held, 'fresh post-resume PRO interaction retained pointer ownership');

console.log('app visibility / PRO integration smoke: PASS');
console.log('  native Activity hide/show callbacks, actual AGC API facade, actual input and PRO modules, channel-032 contact release-before-pause, stale-pointer cleanup, and fresh post-resume interaction verified');
