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
const proceed = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/proceed-electrical.js'), 'utf8');
const input = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/dsky-input-runtime.js'), 'utf8');
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

assert(proceed.includes('function releaseProceed()'),
    'PRO electrical controller must retain the held-contact release helper');
assert(proceed.includes('input.proceed(false)'),
    'held PRO release must deassert channel 032 through the shared input runtime');
assert(proceed.includes("document.addEventListener('visibilitychange'"),
    'held PRO must be released when the document becomes hidden');
assert(proceed.includes('runtime.onBeforeClock(releaseProceed)'),
    'held PRO must release before CLOCK transition ownership changes');
assert(input.includes('core.proceedKey(!!pressed)'),
    'input runtime must remain the single direct AGC PRO primitive');
for (const obsolete of ['function releaseProceed()','agcCore.proceedKey(false)','proceedKey(true)','proceedKey(false)']) {
    assert(!fidelity.includes(obsolete), `hardware fidelity regained obsolete PRO ownership: ${obsolete}`);
}

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
    "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_PARALLAX')",
    "api.saveAgcState",
    "api.verifySnapshotRoundTrip",
    "api.clearSavedAgcState",
    "ARM 5-SECOND PIPA MOTION TEST",
    "PARALLAX / DISPLAY DEPTH",
    "Parallax state",
    "Parallax current → target",
    "Parallax intensity",
    "Glass view depth"
]) {
    assert(diagnostics.includes(token), `diagnostics surface missing: ${token}`);
}
assert(diagnostics.includes("typeof parallaxService.state==='function'"),
    'diagnostics must read live parallax controller state from the owning service');
assert(diagnostics.includes("typeof parallaxService.geometry==='function'"),
    'diagnostics must read physical parallax geometry from the owning service');
assert(!diagnostics.includes('window.AGCDSKY_PARALLAX'),
    'diagnostics must not consume the parallax compatibility-global view internally');
assert(!diagnostics.includes('api.parallax3d'),
    'diagnostics must not depend on a duplicate parallax public-facade alias');
assert(diagnostics.includes('const api=window.AGCDSKY;')&&!diagnostics.includes('window.AGCDSKY=window.AGCDSKY||{}'),
    'diagnostics must consume the existing public facade instead of creating it');
assert(diagnostics.includes("window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_DIAGNOSTICS',Object.freeze({open,close})"),
    'diagnostics module must publish open/close explicitly through the dedicated diagnostics service registry slot');
assert(!diagnostics.includes('api.openDiagnostics=')&&!diagnostics.includes('api.closeDiagnostics='),
    'diagnostics module must not append open/close methods onto the public facade');

console.log('native diagnostic source smoke: PASS');
console.log('  local native crash/error reporting, sensor activity resume, centralized held-PRO release/input ownership, registry-backed parallax telemetry, and explicit diagnostics service publication verified');
