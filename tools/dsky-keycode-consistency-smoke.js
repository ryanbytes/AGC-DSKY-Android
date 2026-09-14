#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sources = [
  ['app.js', 'AGC_KEY'],
  ['clock-behavior.js', 'AGC_KEY'],
  ['keyboard-electrical-interlock.js', 'DSKY_KEY_CODE']
].map(([file, symbol]) => ({
  file,
  symbol,
  source: fs.readFileSync(path.join(ROOT, 'app/src/main/assets', file), 'utf8')
}));

const canonical = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});

function fail(message) {
  console.error('DSKY KEYCODE CONSISTENCY FAIL: ' + message);
  process.exit(1);
}

function extractObject({file, symbol, source}) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(
    `const\\s+${escaped}\\s*=\\s*(?:Object\\.freeze\\s*\\()?\\s*(\\{[^}]+\\})`, 's'));
  if (!match) fail(`${file} no longer exposes parseable ${symbol}`);
  try {
    return vm.runInNewContext(`(${match[1]})`, Object.create(null), {filename:file});
  } catch (error) {
    fail(`${file} ${symbol} could not be evaluated: ${error.message}`);
  }
}

const expectedKeys = Object.keys(canonical).sort();
for (const source of sources) {
  const actual = extractObject(source);
  const actualKeys = Object.keys(actual).sort();
  if (actualKeys.join(',') !== expectedKeys.join(',')) {
    fail(`${source.file} key set differs from the 18-key Pinball matrix: ${actualKeys.join(',')}`);
  }
  for (const key of expectedKeys) {
    if (actual[key] !== canonical[key]) {
      fail(`${source.file} maps ${key} to ${String(actual[key])}, expected octal ${canonical[key].toString(8)}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(actual, 'P')) {
    fail(`${source.file} incorrectly includes PRO in the normal channel-015 keycode matrix`);
  }
}

console.log('DSKY keycode consistency smoke: PASS');
console.log('  app, clock fallback, and electrical interlock share the same 18 Pinball keycodes; PRO remains separate');
