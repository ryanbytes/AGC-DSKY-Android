#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'tools',name),'utf8');
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const full=read('device-full-smoke.sh');
const immediate=read('device-smoke.sh');
const agc=read('device-agc-smoke.sh');
const recreation=read('device-process-recreation-smoke.sh');
const agcDriver=read('device-agc-smoke.js');
const pageDriver=read('device-recreation-smoke.js');
const processDriver=read('device-process-state-smoke.js');
const docs=fs.readFileSync(path.join(root,'docs','DEVICE_RUNTIME_SMOKE.md'),'utf8');
assert(full.includes('aapt2" dump packagename "$APK")'),'full device smoke must derive target package from the tested APK');
assert(full.includes("[[ \"$PACKAGE\" == 'org.apollo.agcdsky.eltest' ]]"),'full device smoke must reject production/non-isolated APKs');
assert(full.includes('device-agc-smoke.sh" "$PACKAGE"')&&full.includes('device-process-recreation-smoke.sh" "$PACKAGE"'),'full device smoke must pass the APK package to each live stage');
assert(immediate.includes("[[ \"$PACKAGE\" == 'org.apollo.agcdsky.eltest' ]]"),'immediate install smoke must reject production package before installation');
assert(immediate.indexOf('unexpected APK package')<immediate.indexOf('INSTALL_OUTPUT='),'immediate install smoke must validate target before adb install');
for(const [name,source] of [['AGC',agc],['process recreation',recreation]]){
  assert(source.includes('PACKAGE="${1:-org.apollo.agcdsky.eltest}"'),`${name} smoke must default to the isolated debug package`);
  assert(source.includes("[[ \"$PACKAGE\" == 'org.apollo.agcdsky.eltest' ]]"),`${name} smoke must reject production package targets`);
  assert(!source.includes('PACKAGE=org.apollo.agcdsky\n'),`${name} smoke regressed to a hard-coded production package`);
  assert(source.includes('ACTIVITY="$PACKAGE/org.apollo.agcdsky.SensorMainActivity"'),`${name} smoke must use the fully qualified Java activity with the .eltest application ID`);
}
assert(docs.includes('adb shell am force-stop "$PACKAGE"'),'device smoke docs must describe force-stopping the selected package');
assert(!docs.includes('adb shell am force-stop org.apollo.agcdsky`'),'device smoke docs must not imply that process recreation targets production');
for(const [name,source] of [['AGC startup',agcDriver],['page recreation',pageDriver],['process recreation',processDriver]]){
  assert(source.includes("typeof c.exports.get_cm_mode === 'function' ? c.exports.get_cm_mode() : null"),`${name} device smoke must read back the live WASM CM peripheral mode`);
  assert(source.includes('s.cmPeripheralMode === 1'),`${name} device smoke must require CM peripheral mode`);
}
console.log('device package policy smoke: PASS');
console.log('  full device smoke follows APK package, rejects production targets, and checks live CM mode at startup and after recreation');
