#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const activity = fs.readFileSync(
    path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java'), 'utf8');
const gravityFilter = fs.readFileSync(
    path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/AccelerometerGravityFilter.java'), 'utf8');
const registrationPolicy = fs.readFileSync(
    path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/SensorRegistrationPolicy.java'), 'utf8');
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
assert(compact(activity).includes('latitudeDeg<-90.0||latitudeDeg>90.0||longitudeDeg<-180.0||longitudeDeg>180.0'),
    'native sky-location bridge must reject finite but geographically invalid coordinates');
assert(compact(activity).includes('catch(RuntimeExceptionignored){magneticDeclinationDeg=0f;skyLocationKnown=false;}'),
    'failed geomagnetic-field calculation must not report location as known');
assert(activity.includes('AGCDSKY.setAppVisible(false);AGCDSKY.setAppVisible(true)'),
    'SensorMainActivity resume must force a hidden transition before visible resume');
const activityCompact = compact(activity);
assert(activityCompact.includes('accelerometerGravityFilter.removeGravity(x,y,z,event.timestamp,gravitySensorRegistered)'),
    'accelerometer callback must use the independently testable gravity-removal filter');
assert(gravityFilter.includes('TIME_CONSTANT_SECONDS = 0.23f'),
    'accelerometer gravity fallback must use an explicit time-constant policy');
assert(gravityFilter.replace(/\s+/g, '').includes('floatelapsedSeconds=(timestampNs-lastTimestampNs)*1.0e-9f;floatalpha=TIME_CONSTANT_SECONDS/(TIME_CONSTANT_SECONDS+elapsedSeconds);'),
    'accelerometer gravity fallback must scale its low-pass coefficient to measured event spacing');
assert(activityCompact.includes('accelerometerGravityFilter.onGravitySample(event.values[0],event.values[1],event.values[2],event.timestamp)'),
    'gravity sensor callback must preserve its event timestamp');
assert(compact(gravityFilter).includes('if(externalGravityRegistered){if(!gravityAt(timestampNs))returnnull;}'),
    'accelerometer samples must wait for a gravity estimate aligned to their event timestamp');
assert(activityCompact.includes('SensorRegistrationPolicy.register(this::registerSensorListener'),
    'native activity must use the testable registration policy for Android listener results');
assert(activityCompact.includes('caseLINEAR_ACCELERATION:returnsensorManager.registerListener(this,linearAccelerationSensor,SensorManager.SENSOR_DELAY_GAME)')
    && activityCompact.includes('caseGRAVITY:returnsensorManager.registerListener(this,gravitySensor,SensorManager.SENSOR_DELAY_GAME)')
    && activityCompact.includes('caseACCELEROMETER:returnsensorManager.registerListener(this,accelerometerSensor,SensorManager.SENSOR_DELAY_GAME)'),
    'production registrar must map policy decisions to the corresponding Android sensors');
assert(registrationPolicy.includes('if (!linear)')
    && registrationPolicy.includes('gravity = hasGravity && registrar.register(SensorKind.GRAVITY)')
    && registrationPolicy.includes('accelerometer = hasAccelerometer && registrar.register(SensorKind.ACCELEROMETER)'),
    'failed preferred registration must attempt both available fallback sensors');
assert(registrationPolicy.includes('return gravityRegistered ? "accelerometer_minus_gravity" : "accelerometer_lowpass"'),
    'active fallback source must depend on successful gravity registration, not sensor discovery');
assert(activityCompact.includes('safeAcceleration,linearAccelerationRegistered||accelerometerRegistered'),
    'PIPA sensor availability must reflect successful registration instead of sensor discovery');
assert(activityCompact.includes('safeAttitude,attitudeRegistered'),
    'IMU sensor availability must reflect successful registration instead of sensor discovery');

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
    'const appState=window.AGCDSKY_APP_STATE;',
    'const coreSession=window.AGCDSKY_CORE_SESSION;',
    'const lifecycle=window.AGCDSKY_LIFECYCLE;',
    'const snapshot=window.AGCDSKY_SNAPSHOT;',
    'const registry=window.AGCDSKY_SERVICE_REGISTRY;',
    'const app=lifecycle.status();',
    'const ntp={...appState.ntpStatus};',
    'const core=coreSession.core;',
    "phone.implementation('phoneIcduStatus')",
    "lateService('AGCDSKY_OPTICS')",
    "snapshot.save('diagnostics')",
    'snapshot.verifyRoundTrip()',
    'snapshot.clear()',
    'ARM 5-SECOND PIPA MOTION TEST',
]) {
    assert(diagnostics.includes(token), `diagnostics surface missing: ${token}`);
}




assert(!diagnostics.includes('const api=window.AGCDSKY')&&!diagnostics.includes('api.appStatus')&&!diagnostics.includes('api.getCore')&&!diagnostics.includes('api.phoneIcduStatus')&&!diagnostics.includes('api.sextantStatus'),
    'diagnostics must not consume the root public facade for internal runtime state');
assert(!diagnostics.includes('api.saveAgcState')&&!diagnostics.includes('api.verifySnapshotRoundTrip')&&!diagnostics.includes('api.clearSavedAgcState'),
    'diagnostics snapshot actions must stay on the owning snapshot service');
for (const token of [
    "lateService('AGCDSKY_PARALLAX')",
    'PARALLAX / DISPLAY DEPTH',
    'Parallax state',
    'Parallax current → target',
    'Parallax intensity',
    'Glass view depth',
    'window.AGCDSKY_PARALLAX',
    'api.parallax3d'
]) {
    assert(!diagnostics.includes(token), 'diagnostics must not expose parallax telemetry: '+token);
}
assert(diagnostics.includes("window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_DIAGNOSTICS',Object.freeze({open,close,runFullSelfTest})"),
    'diagnostics module must publish open/close explicitly through the dedicated diagnostics service registry slot');
assert(!diagnostics.includes('api.openDiagnostics=')&&!diagnostics.includes('api.closeDiagnostics='),
    'diagnostics module must not append open/close methods onto the public facade');

console.log('native diagnostic source smoke: PASS');
console.log('  local native crash/error reporting, sensor activity resume, centralized held-PRO release/input ownership, direct diagnostics core-service ownership, parallax-free diagnostics telemetry, and explicit diagnostics service publication verified');
