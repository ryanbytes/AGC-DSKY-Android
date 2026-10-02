#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const java=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/AppUpdater.java'),'utf8');
const provider=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/UpdateInitProvider.java'),'utf8');
const checkReceiver=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/UpdateCheckReceiver.java'),'utf8');
const apkProvider=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/UpdateApkProvider.java'),'utf8');
const activity=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'app/src/main/assets/index.html'),'utf8');
const shell=fs.readFileSync(path.join(ROOT,'app/src/main/assets/app-shell-runtime.js'),'utf8');
const manifest=fs.readFileSync(path.join(ROOT,'app/src/main/AndroidManifest.xml'),'utf8');
const prep=fs.readFileSync(path.join(ROOT,'tools/prepare-update-release.sh'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
for(const marker of [
  'releases/latest',
  'FALLBACK_VERSION_URL',
  'raw.githubusercontent.com/ryanbytes/AGC-DSKY-Android/main/VERSION',
  'RELEASE_DOWNLOAD_BASE',
  'fetchLatestReleaseResilient()',
  'fetchFallbackRelease()',
  '12L * 60L * 60L * 1000L',
  'FOREGROUND_CHECK_INTERVAL_MS',
  '60L * 1000L',
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
  'Settings.ACTION_SECURITY_SETTINGS',
  'foregroundActivity',
  'offerPendingToForeground()',
  'hasValidPending(context)',
  'Intent.ACTION_INSTALL_PACKAGE',
  'Intent.FLAG_GRANT_READ_URI_PERMISSION',
  'UpdateApkProvider.uriFor(activity, apk)'
])assert(java.includes(marker)||apkProvider.includes(marker),`missing updater safety marker: ${marker}`);
const fetchIndex=java.indexOf('Release release = fetchLatestReleaseResilient();');
const successIndex=java.indexOf('putLong(PREF_LAST_CHECK, System.currentTimeMillis())');
assert(fetchIndex>=0&&successIndex>fetchIndex,'successful-check timestamp must be written only after the release request succeeds');
assert(!java.includes('putLong(PREF_LAST_CHECK, now).apply()'),'updater must not consume the 12-hour check window before network success');
assert(java.includes('if (isTransientNetworkFailure(error)) {')&&java.includes('scheduleRetry(context);')&&java.includes('notifyStatus(listener, "NETWORK ERROR")'),'transient updater network failures must schedule retry and report manual-check status');
for(const marker of ['AppUpdater.checkNow(context)','AlarmManager.ELAPSED_REALTIME','setInexactRepeating','CHECK_INTERVAL_MS'])assert(provider.includes(marker),`startup provider missing periodic updater marker: ${marker}`);
assert(checkReceiver.includes('AppUpdater.check(context)'),'periodic receiver does not invoke updater');
assert(activity.includes('AppUpdater.onForeground(this)'),'launcher activity must resume pending update UI from the foreground');
assert(java.includes('void onForeground(Activity activity)')&&java.includes('checkForeground(activity);'),
  'foreground resume must use the short freshness window');
const foregroundStart=java.indexOf('void onForeground(Activity activity)');
const foregroundEnd=java.indexOf('void onBackground(Activity activity)',foregroundStart);
assert(foregroundStart>=0&&foregroundEnd>foregroundStart&&!java.slice(foregroundStart,foregroundEnd).includes('resumePendingInstall'),
  'foreground resume must not relaunch a declined installer or source-settings screen');
assert(java.includes('check(source, false, FOREGROUND_CHECK_INTERVAL_MS, null, false)'),
  'foreground updater must not inherit the 12-hour background interval');
assert((java.match(/if \(userInitiated\) offerPendingToForeground\(\);/g)||[]).length===2,
  'only an explicit manual check may open permission or package-installer UI for a pending update');
assert(java.includes('now - prefs.getLong(PREF_LAST_CHECK, 0L) < minimumIntervalMs'),'updater check interval must be selected by caller');
assert(java.includes('connection.setUseCaches(false)')&&java.includes('Cache-Control')&&java.includes('no-cache'),'release discovery must bypass stale HTTP response caches');
assert(activity.includes('AppUpdater.onBackground(this)'),'launcher activity must clear updater foreground ownership on pause');
assert(activity.includes('new UpdateBridge(),"UpdateBridge"'),'launcher must expose the manual updater bridge to packaged UI');
assert(activity.includes('AppUpdater.checkNow(SensorMainActivity.this, SensorMainActivity.this::pushUpdateStatus)'),
  'manual updater bridge must request a forced check with status callback');
assert(activity.includes('AGCDSKY_SHELL.nativeUpdateStatus'),'native updater status must be forwarded to the application shell');
assert(html.includes('id="update-talkback"')&&html.includes('data-panel-legend="SW LOAD"')&&
       html.includes('<button id="update" class="software-check">CHECK</button>'),
  'software talkback and manual CHECK control must be present on the main options panel');
assert(shell.includes("UpdateBridge.checkNow()")&&shell.includes("nativeUpdateStatus('CHECKING')"),
  'manual update control must invoke the native bridge and enter a visible checking state');
for(const marker of [
  "talkback.dataset.state=state",
  "text.startsWith('UP TO DATE')",
  "text.startsWith('READY TO INSTALL')",
  "updateButtonHeld?'barber'",
  "b.textContent='CHECK'",
  "updateButton.addEventListener('pointerdown'",
  "updateButton.addEventListener('pointerup',releaseUpdateCheck)",
  "updateButton.addEventListener('pointercancel',releaseUpdateCheck)",
  "updateButton.addEventListener('lostpointercapture',releaseUpdateCheck)",
  "updateButton.setPointerCapture(event.pointerId)"
])assert(shell.includes(marker),'software talkback updater mapping/press behavior missing: '+marker);
for(const status of ['UP TO DATE · ','UPDATE ASSET MISSING','UPDATE DIGEST MISSING','DOWNLOADING · ','UPDATE CHECKSUM FAILED','UPDATE REJECTED','READY TO INSTALL · ','NETWORK ERROR','UPDATE ERROR'])
  assert(java.includes(status),'manual updater status missing: '+status);
assert(!java.includes('pollInstallPermission('),'background permission polling must stay removed');
const pendingWrite=java.indexOf('putString(PREF_PENDING, candidate.getAbsolutePath())');
const directInstall=java.indexOf('requestInstallPermissionOrInstall(context, candidate)', pendingWrite);
assert(pendingWrite>=0&&directInstall<0,'background release check must not directly launch install/permission UI');
assert(java.includes('new WeakReference<>(activity)')&&java.includes('new Handler(Looper.getMainLooper()).post(() -> resumePendingInstall(activity))'),
  'verified pending update must be handed to the foreground activity');
assert(java.includes('MAX_APK_BYTES = 128L * 1024L * 1024L')&&java.includes('if (total > MAX_APK_BYTES) throw new IOException("APK response too large")'),
  'APK download must be bounded while streaming, even when Content-Length is absent or inaccurate');
assert(java.includes('if (temporary.exists()) temporary.delete();'),
  'failed or oversized APK downloads must remove their partial file');
assert(java.includes('new Asset("app-fire-release.apk.sha256"')&&java.includes('new Asset("app-regular-release.apk.sha256"'),
  'fallback release discovery must retain sidecar integrity verification');

for(const marker of ['android.permission.REQUEST_INSTALL_PACKAGES','android:name=".UpdateInitProvider"','${applicationId}.update-init','android:name=".UpdateCheckReceiver"','android:name=".UpdateApkProvider"','${applicationId}.update-file','android:grantUriPermissions="true"'])assert(manifest.includes(marker),`manifest missing updater declaration: ${marker}`);
assert((manifest.match(/android:exported="false"/g)||[]).length>=4,'updater components are not consistently private');
assert(java.includes('new Intent(Intent.ACTION_INSTALL_PACKAGE)'),'updater must hand verified APK to the system installer directly');
assert(java.includes('activity.startActivity(install)'),'system installer must be launched from the foreground activity');
assert(java.includes('Intent.ACTION_VIEW'),'direct installer must retain ACTION_VIEW APK fallback for vendor compatibility');
assert(!java.includes('PackageInstaller.SessionParams'),'PackageInstaller session callback path must stay removed');
assert(!java.includes('UpdateInstallActivity'),'obsolete installer callback activity must stay removed');
assert(!manifest.includes('android:name=".UpdateInstallActivity"'),'obsolete installer callback activity must stay removed from manifest');
for(const marker of ['application/vnd.android.package-archive','ParcelFileDescriptor.MODE_READ_ONLY','OpenableColumns.DISPLAY_NAME','app-fire-release.apk','app-regular-release.apk'])assert(apkProvider.includes(marker),`update APK provider missing ${marker}`);
for(const marker of ['app-regular-release.apk','app-fire-release.apk','app-regular-release.apk.sha256','app-fire-release.apk.sha256','apksigner','sha256'])assert(prep.includes(marker),`release-prep script missing ${marker}`);
assert(java.includes('PackageManager.GET_SIGNING_CERTIFICATES | PackageManager.GET_SIGNATURES'),
  'Android 9/10 archive verification must request legacy signatures alongside SigningInfo');
assert(java.includes('Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null') &&
       java.includes('signatures = info.signatures;'),
  'signer extraction must fall back to PackageInfo.signatures when archive SigningInfo is null');
assert(!java.includes('http://'),'updater must not use cleartext endpoints');
console.log('self update smoke: PASS');
console.log('  forced startup discovery + periodic checks, manual CHECK FOR UPDATE status, API fallback, foreground direct APK installer handoff, phone/Fire selection, release integrity, signer/version checks, and Android 9 compatibility verified');
