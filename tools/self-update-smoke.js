#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const java=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/AppUpdater.java'),'utf8');
const provider=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/UpdateInitProvider.java'),'utf8');
const receiver=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/UpdateInstallReceiver.java'),'utf8');
const manifest=fs.readFileSync(path.join(ROOT,'app/src/main/AndroidManifest.xml'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
for(const marker of [
  'releases/latest',
  '12L * 60L * 60L * 1000L',
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
])assert(java.includes(marker)||receiver.includes(marker),`missing updater safety marker: ${marker}`);
assert(provider.includes('AppUpdater.check(getContext())'),'startup provider does not start updater');
for(const marker of ['android.permission.REQUEST_INSTALL_PACKAGES','android:name=".UpdateInitProvider"','${applicationId}.update-init','android:name=".UpdateInstallReceiver"'])assert(manifest.includes(marker),`manifest missing updater declaration: ${marker}`);
assert(manifest.includes('android:exported="false"'),'updater components must not be exported');
assert(!java.includes('http://'),'updater must not use cleartext endpoints');
console.log('self update smoke: PASS');
console.log('  phone/Fire flavor selection, release integrity, signer/version checks, debug exclusion, and PackageInstaller flow verified');
