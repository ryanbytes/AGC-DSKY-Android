#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const forbidden = ['open', 'ai'].join('');
const roots = [
  'README.md',
  'THIRD_PARTY.md',
  'app',
  'docs',
  'tools',
  '.github'
];
const textExtensions = new Set([
  '.css', '.gradle', '.html', '.java', '.js', '.json', '.md', '.properties',
  '.sh', '.txt', '.xml', '.yaml', '.yml'
]);

function walk(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return [];
  const st = fs.statSync(full);
  if (st.isFile()) return [rel];
  const out = [];
  for (const name of fs.readdirSync(full)) {
    if (name === 'build' || name === '.gradle') continue;
    out.push(...walk(path.join(rel, name)));
  }
  return out;
}

const hits = [];
for (const rel of roots.flatMap(walk)) {
  const ext = path.extname(rel).toLowerCase();
  if (!textExtensions.has(ext) && !['README.md', 'THIRD_PARTY.md'].includes(rel)) continue;
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  if (text.toLowerCase().includes(forbidden)) hits.push(rel);
}

if (hits.length) {
  throw new Error(`forbidden vendor branding found in: ${hits.join(', ')}`);
}
console.log('branding smoke: PASS');
