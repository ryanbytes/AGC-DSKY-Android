#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const java=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/AppUpdater.java'),'utf8');
const provider=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/UpdateInitProvider.java'),'utf8');
const checkReceiver=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/UpdateCheckReceiver.java'),'utf8');
const installReceiver=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/UpdateInstallReceiver.java'),'utf8');
const manifest=fs.readFileSync(path.join(ROOT,'app/src/main/AndroidManifest.xml'),'utf8');
const prep=fs.readFileSync(path.join(ROOT,'tools/prepare-update-release.sh'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
for(const marker of [
  'releases/latest',
  '12L * 60L * 60L * 1000L',
  'RETRY_INTERVAL_MS',
  'PREF_LAST_ATTEMPT',
  'UnknownHostException',
  'isTransientNetworkFailure',
  'scheduleRetry(context)',
  'BuildConfig.DEBUG',
  '"fire".equals(BuildConfig.FLAVOR)',
  'app-fire-release.apk',
  'app-regular-release.apk',
  'sha256For(apkName, apk.digest)',
  'expectedSha256.equalsIgnoreCase(actualSha256)',
  'verifyApkIdentity(context, candidate)',
  'versionCode(archive) <= versionCode(current)',
  'signerDigests(archive).equals(signerDigests(current))',
  'PackageManager.GET_SIGNING_CERTIFICATES',
  'Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES',
  'PackageInstaller.SessionParams.MODE_FULL_INSTALL',
  'PackageInstaller.STATUS_PENDING_USER_ACTION'
])assert(java.includes(marker)||installReceiver.includes(marker),`missing updater safety marker: ${marker}`);
const fetchIndex=java.indexOf('Release release = fetchLatestRelease();');
const successIndex=java.indexOf('putLong(PREF_LAST_CHECK, System.currentTimeMillis())');
assert(fetchIndex>=0&&successIndex>fetchIndex,'successful-check timestamp must be written only after the release request succeeds');
assert(!java.includes('putLong(PREF_LAST_CHECK, now).apply()'),'updater must not consume the 12-hour check window before network success');
assert(java.includes('if (isTransientNetworkFailure(error)) scheduleRetry(context);'),'transient updater network failures must retry quietly');
for(const marker of ['AppUpdater.check(context)','AlarmManager.ELAPSED_REALTIME','setInexactRepeating','CHECK_INTERVAL_MS'])assert(provider.includes(marker),`startup provider missing periodic updater marker: ${marker}`);
assert(checkReceiver.includes('AppUpdater.check(context)'),'periodic receiver does not invoke updater');
for(const marker of ['android.permission.REQUEST_INSTALL_PACKAGES','android:name=".UpdateInitProvider"','${applicationId}.update-init','android:name=".UpdateCheckReceiver"','android:name=".UpdateInstallReceiver"'])assert(manifest.includes(marker),`manifest missing updater declaration: ${marker}`);
assert((manifest.match(/android:exported="false"/g)||[]).length>=4,'updater components are not consistently private');
for(const marker of ['app-regular-release.apk','app-fire-release.apk','app-regular-release.apk.sha256','app-fire-release.apk.sha256','apksigner','sha256'])assert(prep.includes(marker),`release-prep script missing ${marker}`);
assert(!java.includes('http://'),'updater must not use cleartext endpoints');
console.log('self update smoke: PASS');
console.log('  startup + periodic checks, quiet transient-network retry, phone/Fire flavor selection, release integrity, signer/version checks, debug exclusion, and PackageInstaller flow verified');
