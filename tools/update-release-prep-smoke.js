#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const sourceScript = path.join(SOURCE_ROOT, 'tools/prepare-update-release.sh');
const expectedCert = '409ad676e8052e50416a1bf69e095137ef639ac13ce4652160a19380a117fa1f';

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function runCase({
  certificate = expectedCert,
  scheme = 'v2',
  schemeValid = true,
  apkVersion = '1.2.3',
  regularCode = '123',
  fireCode = '123',
  regularHasFire = false,
  fireHasComponents = true,
  accepted
}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agcdsky-release-prep-'));
  try {
    const repoRoot = path.join(tempRoot, 'repo');
    const toolsDir = path.join(repoRoot, 'tools');
    const sdkDir = path.join(tempRoot, 'sdk');
    const buildToolsDir = path.join(sdkDir, 'build-tools', '36.0.0');
    const distDir = path.join(repoRoot, 'dist', 'update-release');
    const inputDir = path.join(tempRoot, 'input');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(buildToolsDir, { recursive: true });
    fs.mkdirSync(inputDir, { recursive: true });
    const script = path.join(toolsDir, 'prepare-update-release.sh');
    const apksigner = path.join(buildToolsDir, 'apksigner');
    const aapt2 = path.join(buildToolsDir, 'aapt2');
    const dexdump = path.join(buildToolsDir, 'dexdump');
    const regular = path.join(inputDir, 'regular.apk');
    const fire = path.join(inputDir, 'fire.apk');
    fs.copyFileSync(sourceScript, script);
    fs.writeFileSync(path.join(repoRoot, 'VERSION'), '1.2.3\n');
    fs.writeFileSync(regular, 'regular release fixture');
    fs.writeFileSync(fire, 'Fire release fixture');
    if (!accepted) {
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(path.join(distDir, 'preserve-me.txt'), 'existing staging data');
    }
    fs.writeFileSync(apksigner, [
      '#!/bin/sh',
      'test "$1" = verify || exit 2',
      'printf "%s\\n" Verifies',
      'printf "Verified using v1 scheme (JAR signing): true\\n"',
      'printf "Verified using %s scheme (fixture): %s\\n" "$APK_SCHEME" "$SCHEME_VALID"',
      'printf "Number of signers: 1\\n"',
      'printf "Signer #1 certificate SHA-256 digest: %s\\n" "$APK_CERT"'
    ].join('\n'));
    fs.chmodSync(apksigner, 0o755);
    fs.writeFileSync(aapt2, [
      '#!/bin/sh',
      'test "$1" = dump && test "$2" = badging || exit 2',
      'case "$3" in *regular.apk) version_code="$REGULAR_CODE" ;; *fire.apk) version_code="$FIRE_CODE" ;; *) exit 2 ;; esac',
      'printf "package: name=\'org.apollo.agcdsky\' versionCode=\'%s\' versionName=\'%s\' platformBuildVersionCode=\'37\'\\n" "$version_code" "$APK_VERSION"'
    ].join('\n'));
    fs.chmodSync(aapt2, 0o755);
    fs.writeFileSync(dexdump, [
      '#!/bin/sh',
      'test "$1" = -f || exit 2',
      'case "$2" in *regular.apk) if test "$REGULAR_HAS_FIRE" = true; then echo "Class descriptor  : \'Lorg/apollo/agcdsky/FireModeActivity;\'"; fi ;;',
      '  *fire.apk) if test "$FIRE_HAS_COMPONENTS" = true; then',
      '    echo "Class descriptor  : \'Lorg/apollo/agcdsky/FireModeActivity;\'"',
      '    echo "Class descriptor  : \'Lorg/apollo/agcdsky/FireRedirectAccessibilityService;\'"',
      '    echo "Class descriptor  : \'Lorg/apollo/agcdsky/FireBootReceiver;\'"',
      '  fi ;; *) exit 2 ;; esac'
    ].join('\n'));
    fs.chmodSync(dexdump, 0o755);

    const result = spawnSync('bash', [script, regular, fire], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ANDROID_SDK_ROOT: sdkDir,
        APK_CERT: certificate,
        APK_SCHEME: scheme,
        SCHEME_VALID: String(schemeValid),
        APK_VERSION: apkVersion,
        REGULAR_CODE: regularCode,
        FIRE_CODE: fireCode,
        REGULAR_HAS_FIRE: String(regularHasFire),
        FIRE_HAS_COMPONENTS: String(fireHasComponents)
      }
    });
    assert(result.error == null, `could not execute release-prep fixture: ${result.error}`);
    assert((result.status === 0) === accepted,
      `unexpected release-prep result for certificate=${certificate} scheme=${scheme}: ${result.stdout}\n${result.stderr}`);
    if (accepted) {
      const regularOut = path.join(distDir, 'app-regular-release.apk');
      const fireOut = path.join(distDir, 'app-fire-release.apk');
      assert(fs.readFileSync(regularOut, 'utf8') === 'regular release fixture', 'regular APK was not staged intact');
      assert(fs.readFileSync(fireOut, 'utf8') === 'Fire release fixture', 'Fire APK was not staged intact');
      for (const file of [regularOut, fireOut]) {
        const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        const sidecar = fs.readFileSync(`${file}.sha256`, 'utf8');
        assert(sidecar.startsWith(actual), `wrong checksum sidecar for ${path.basename(file)}`);
      }
    } else {
      assert(fs.readFileSync(path.join(distDir, 'preserve-me.txt'), 'utf8') === 'existing staging data',
        'invalid APKs must be rejected before replacing existing release staging data');
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

runCase({ accepted: true });
runCase({ scheme: 'v3.1', accepted: true });
runCase({ certificate: '0000000000000000000000000000000000000000000000000000000000000000', accepted: false });
runCase({ scheme: 'v1', accepted: false });
runCase({ schemeValid: false, accepted: false });
runCase({ apkVersion: '1.2.2', accepted: false });
runCase({ regularHasFire: true, accepted: false });
runCase({ fireHasComponents: false, accepted: false });
runCase({ regularCode: '123', fireCode: '124', accepted: false });

console.log('update release prep smoke: PASS');
console.log('  signer/scheme, tag metadata, Regular/Fire variant identity, APK staging, and SHA-256 sidecars verified');
