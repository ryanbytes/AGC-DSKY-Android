#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(
    path.resolve(__dirname, 'fire-tablet-home-setup.sh'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

for (const required of [
    'COMPONENT_NAMESPACE=org.apollo.agcdsky',
    'FIRE_ACTION_NAMESPACE=org.apollo.agcdsky',
    'dump packagename',
    'DSKY_HOME="$PACKAGE/$COMPONENT_NAMESPACE.SensorMainActivity"',
    'com.amazon.firelauncher',
    'android.intent.action.MAIN',
    'android.intent.category.LAUNCHER',
    'android.intent.category.HOME',
    'cmd package set-home-activity --user',
    'cmd package resolve-activity --brief --user',
    'pm disable-user --user',
    'pm enable --user',
    'FireRedirectAccessibilityService',
    'FIRE_ENABLE',
    'explicit launch did not foreground',
    'home_path=protected-fire-redirect',
    'fire_redirect_bound',
    'binding will be verified after reboot while Amazon Home remains enabled',
    'Fire redirect accessibility service did not bind within 45 seconds after reboot',
    'input keyevent KEYCODE_HOME',
    'sys.boot_completed',
    'wait-for-device']) {
  assert(script.includes(required), `Fire HOME setup missing: ${required}`);
}

const homeQuery = script.indexOf('home_candidates=');
const homeRegistrationPass = script.indexOf('DSKY launcher and HOME registrations: PASS');
const setHome = script.indexOf('set_home_output=');
const disableLauncher = script.indexOf('pm disable-user --user');
const resolveHome = script.indexOf('resolved="$(resolve_home)"');
assert(homeQuery >= 0 && homeQuery < homeRegistrationPass,
    'HOME candidacy must be queried before registration passes');
assert(homeRegistrationPass < setHome,
    'HOME registration must pass before assignment');
assert(setHome < disableLauncher,
    'set-home-activity must succeed before Fire Launcher is disabled');
assert(disableLauncher < resolveHome,
    'HOME must be resolved after Fire Launcher is disabled');
assert(script.includes("trap 'recover_launcher $? $LINENO' ERR"),
    'failure trap must restore Amazon Fire Launcher');
assert(script.includes('launcher_safety_required=true'),
    'safe-launcher recovery gate missing');
assert(script.includes('installed APK is not the Fire variant'),
    'setup must reject an APK without restored Fire components');
assert(script.includes('Rebooting for the real Fire OS boot-path check'),
    'setup must perform a real reboot check');

console.log('Fire HOME setup smoke: PASS');
