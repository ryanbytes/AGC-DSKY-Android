#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

globalThis.crypto ??= webcrypto;
const source = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
assert.match(source, /WHERE\s+last_seen\s*>=\s*strftime\('%Y-%m-%dT%H:%M:%fZ',\s*'now',\s*'-7 days'\)/,
  'seven-day activity cutoff must use the stored ISO-8601 UTC timestamp format');

const expiredIsoTimestamp = '2026-09-26T11:59:59.000Z';
const sevenDayCutoffAsSqliteDateTime = '2026-09-26 12:00:00';
assert.ok(expiredIsoTimestamp >= sevenDayCutoffAsSqliteDateTime,
  'fixture must expose the old lexical comparison error (T sorts after space)');
assert.ok(Date.parse(expiredIsoTimestamp) < Date.parse(`${sevenDayCutoffAsSqliteDateTime.replace(' ', 'T')}Z`),
  'fixture timestamp must actually be older than the seven-day cutoff');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const worker = (await import(moduleUrl)).default;

let cancelled = false;
let dbCalls = 0;
const database = {
  prepare() { return {bind() { return this; }}; },
  async batch() { dbCalls += 1; return []; }
};
const env = {
  ALLOWED_ORIGINS: 'https://ryanbytes.github.io',
  ANALYTICS_SECRET: 'test-secret-for-worker-smoke',
  DB: database
};

const stream = new ReadableStream({
  pull(controller) {
    controller.enqueue(new Uint8Array(1024));
  },
  cancel() { cancelled = true; }
});
const oversizedRequest = new Request('https://analytics.example/v1/event', {
  method: 'POST',
  headers: {Origin: 'https://ryanbytes.github.io', 'Content-Type': 'text/plain'},
  body: stream,
  duplex: 'half'
});
const oversizedResponse = await worker.fetch(oversizedRequest, env);
assert.equal(oversizedResponse.status, 413, 'oversized body should be rejected');
assert.equal(cancelled, true, 'oversized request stream should be cancelled at the cap');
assert.equal(dbCalls, 0, 'oversized request must not write analytics data');

for (const body of ['null', '[]', '"launch"']) {
  const response = await worker.fetch(new Request('https://analytics.example/v1/event', {
    method: 'POST',
    headers: {Origin: 'https://ryanbytes.github.io', 'Content-Type': 'text/plain'},
    body
  }), env);
  assert.equal(response.status, 400, `non-object payload ${body} should be rejected as a client error`);
}
assert.equal(dbCalls, 0, 'non-object payloads must not write analytics data');

for (const event of [null, [], {toString: 1, valueOf: 1}, 7]) {
  const response = await worker.fetch(new Request('https://analytics.example/v1/event', {
    method: 'POST',
    headers: {Origin: 'https://ryanbytes.github.io', 'Content-Type': 'application/json'},
    body: JSON.stringify({event, clientId: '0123456789abcdef0123456789abcdef'})
  }), env);
  assert.equal(response.status, 400, `invalid event value ${JSON.stringify(event)} should be rejected`);
}
assert.equal(dbCalls, 0, 'invalid event values must not write analytics data');

const validRequest = new Request('https://analytics.example/v1/event', {
  method: 'POST',
  headers: {Origin: 'https://ryanbytes.github.io', 'Content-Type': 'text/plain'},
  body: JSON.stringify({event: 'launch', clientId: '0123456789abcdef0123456789abcdef', standalone: false, device: 'android', build: 'smoke'})
});
const validResponse = await worker.fetch(validRequest, env);
assert.equal(validResponse.status, 202, 'valid event should still be accepted');
assert.equal(dbCalls, 1, 'valid event should write through D1 batch');

console.log('Analytics Worker bounded-body smoke: PASS');
