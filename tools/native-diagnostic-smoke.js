#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const activity = fs.readFileSync(
    path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java'), 'utf8');
const dreamService = fs.readFileSync(
    path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/AgcDreamService.java'), 'utf8');
const reporter = fs.readFileSync(
    path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/DebugReporter.java'), 'utf8');
const diagnostics = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/diagnostics.js'), 'utf8');
const fidelity = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/hardware-fidelity.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function compact(source) {
    return source.replace(/\s+/g, '');
}

function checkNativeConsoleFilter(source, label) {
    const text = compact(source);
    assert(text.includes('message.messageLevel()==ConsoleMessage.MessageLevel.ERROR'),
        `${label} must keep native ERROR-level console diagnostics`);
    assert(text.includes('!text.startsWith("[yaAGC]")'),
        `${label} must not persist informational [yaAGC] WASI stderr as an app failure`);
    assert(text.includes('DebugReporter.appendWebError'),
        `${label} must still persist non-yaAGC console errors`);
}

checkNativeConsoleFilter(activity, 'SensorMainActivity');
checkNativeConsoleFilter(dreamService, 'AgcDreamService');

assert(activity.includes('DebugReporter.install(this)'),
    'SensorMainActivity must install the native crash/error reporter');
assert(compact(activity).includes('newDebugReporter.JsBridge(this),"DebugBridge"'),
    'SensorMainActivity must expose the local diagnostic bridge to packaged content');
assert(activity.includes('AGCDSKY.setAppVisible(false);AGCDSKY.setAppVisible(true)'),
    'SensorMainActivity resume must force a hidden transition before visible resume');

assert(fidelity.includes('function releaseProceed()'),
    'hardware fidelity layer must retain the held-PRO release helper');
assert(fidelity.includes('agcCore.proceedKey(false)'),
    'held PRO release must deassert the AGC proceed input');
assert(fidelity.includes("document.addEventListener('visibilitychange'"),
    'held PRO must be released when the document becomes hidden');

const reporterCompact = compact(reporter);
assert(reporterCompact.includes('newFile(context.getFilesDir(),REPORT_FILE)'),
    'debug reports must remain in app-private local storage');
assert(reporterCompact.includes('WebView.getCurrentWebViewPackage()'),
    'native report must identify the installed WebView package');
assert(reporterCompact.includes('packageVersion(context)'),
    'native report must include the exact app version');
assert(reporter.includes('location coordinates are intentionally not included'),
    'native report must continue excluding saved location coordinates');

for (const token of [
    "api.appStatus",
    "api.getCore",
    "api.phoneIcduStatus",
    "api.sextantStatus",
    "api.saveAgcState",
    "api.verifySnapshotRoundTrip",
    "api.clearSavedAgcState",
    "ARM 5-SECOND PIPA MOTION TEST"
]) {
    assert(diagnostics.includes(token), `diagnostics surface missing: ${token}`);
}
assert(diagnostics.includes("api.openDiagnostics=open"),
    'diagnostics module must expose the current openDiagnostics entry point');

console.log('native diagnostic source smoke: PASS');
console.log('  local native crash/error reporting, sensor activity resume, held-PRO release, and diagnostics surface verified');
