#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILDER = path.join(ROOT, 'pwa/tools/build-site.sh');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'agcdsky-pwa-destination-safety-'));

function run(args) {
  return spawnSync('bash', [BUILDER, ...args], {encoding: 'utf8'});
}

function mustRefuse(args, expected, message) {
  const result = run(args);
  assert.notStrictEqual(result.status, 0, message + ' was accepted');
  assert((result.stderr || '').includes(expected), message + ' failed for an unexpected reason: ' + result.stderr);
}

try {
  const populated = path.join(TEMP, 'user-output');
  fs.mkdirSync(populated);
  const marker = path.join(populated, 'keep-me.txt');
  fs.writeFileSync(marker, 'user data remains intact\n');
  mustRefuse([populated], 'destination is populated; preserving existing files', 'populated destination without --replace');
  assert.strictEqual(fs.readFileSync(marker, 'utf8'), 'user data remains intact\n', 'refused build changed user data');
  mustRefuse(['--replace', populated], '--replace requires a destination created by this builder', 'unrecognized populated destination with --replace');
  assert.strictEqual(fs.readFileSync(marker, 'utf8'), 'user data remains intact\n', '--replace removed unrecognized user data');

  mustRefuse([ROOT], 'destination is a protected source/root path', 'repository root destination');
  assert(fs.existsSync(path.join(ROOT, 'README.md')), 'repository root check damaged the checkout');

  const sourceAssets = path.join(ROOT, 'app/src/main/assets');
  mustRefuse([sourceAssets], 'destination is a protected source/root path', 'shared source assets destination');
  assert(fs.existsSync(path.join(sourceAssets, 'index.html')), 'source-assets check damaged the app');

  const symlinkTarget = path.join(TEMP, 'symlink-target');
  const symlink = path.join(TEMP, 'output-link');
  fs.mkdirSync(symlinkTarget);
  fs.symlinkSync(symlinkTarget, symlink);
  mustRefuse([symlink], 'destination is a symbolic link', 'symbolic-link destination');
  assert.deepStrictEqual(fs.readdirSync(symlinkTarget), [], 'refused symlink build wrote into its target');

  console.log('PWA build-site destination safety smoke: PASS');
  console.log('  populated user destinations and symlinks are preserved; protected roots are rejected; replacement requires a builder marker');
} finally {
  fs.rmSync(TEMP, {recursive: true, force: true});
}
