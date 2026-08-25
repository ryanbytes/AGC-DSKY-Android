#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const activity = fs.readFileSync(
    path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/MainActivity.java'), 'utf8');
const dreamService = fs.readFileSync(
    path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/AgcDreamService.java'), 'utf8');
const runtimeDebug = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/runtime-debug.js'), 'utf8');
const app = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/app.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function checkNativeConsoleFilter(source, label) {
    assert(source.includes('message.messageLevel() == ConsoleMessage.MessageLevel.ERROR'),
        `${label} must keep native ERROR-level console diagnostics`);
    assert(source.includes('!text.startsWith("[yaAGC]")'),
        `${label} must not persist informational [yaAGC] WASI stderr as an app failure`);
    assert(source.includes('DebugReporter.appendWebError'),
        `${label} must still persist non-yaAGC console errors`);
}

checkNativeConsoleFilter(activity, 'MainActivity');
checkNativeConsoleFilter(dreamService, 'AgcDreamService');

assert(activity.includes(
        'AGCDSKY.setAppVisible(false);AGCDSKY.setAppVisible(true)'),
    'MainActivity resume must force a hidden transition before visible resume');
assert(app.includes('if(!appVisible){\n    releaseAgcProceed();'),
    'frontend hidden transition must release a held PRO input');

assert(runtimeDebug.includes("console.error = function()"),
    'runtime debug console-error wrapper missing');
assert(runtimeDebug.includes('value && value.stack'),
    'runtime debug must only persist stack-bearing handled console errors');
assert(runtimeDebug.includes("addEventListener('error'"),
    'runtime debug must preserve unhandled JavaScript error capture');
assert(runtimeDebug.includes("addEventListener('unhandledrejection'"),
    'runtime debug must preserve unhandled promise rejection capture');

console.log('native diagnostic source smoke: PASS');
