#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'app/src/main/assets/index.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const html = fs.readFileSync(INDEX, 'utf8');
const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*>/i);
assert(match, 'index.html is missing a Content-Security-Policy meta tag');

const policy = match[1];
function requireDirective(text) {
  assert(policy.includes(text), `CSP missing required directive: ${text}`);
}

requireDirective("default-src 'none'");
requireDirective("script-src 'self' 'wasm-unsafe-eval'");
requireDirective("style-src 'self'");
requireDirective("connect-src 'self'");
requireDirective("object-src 'none'");
requireDirective("frame-src 'none'");
requireDirective("base-uri 'none'");
requireDirective("form-action 'none'");

assert(!policy.includes("'unsafe-eval'"),
  "CSP must not grant ordinary 'unsafe-eval'; yaAGC only needs 'wasm-unsafe-eval'");
assert(!policy.includes("'unsafe-inline'"),
  "CSP must not grant 'unsafe-inline'");
assert(!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html),
  'frontend must not contain inline script blocks under the strict CSP');
assert(!/\son[a-z]+\s*=/i.test(html),
  'frontend must not contain inline event-handler attributes under the strict CSP');

for (const script of ['runtime-debug.js', 'agc-core.js', 'app.js']) {
  assert(html.includes(`<script src="${script}"></script>`),
    `expected external script missing: ${script}`);
}

console.log('frontend CSP smoke: PASS');
