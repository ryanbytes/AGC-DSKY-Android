#!/usr/bin/env node
'use strict';

/*
 * Semantic device/runtime smoke for AGC-DSKY Android.
 *
 * Connects to the already-forwarded debuggable WebView DevTools socket, enters
 * Luminary099 AGC mode, drives V37E00E and V35E through the actual DSKY pointer
 * handlers, and requires the rendered SVG to show the real Pinball V35 all-8
 * numerical light-test pattern.
 *
 * No npm packages are used. Node 18+ is sufficient.
 */

const crypto = require('crypto');
const http = require('http');
const net = require('net');
const { URL } = require('url');

const port = Number(process.argv[2] || process.env.AGC_DEVTOOLS_PORT || 0);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('usage: node tools/device-v35-smoke.js <forwarded-devtools-port>');
  process.exit(2);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: pathname }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`DevTools ${pathname} returned HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`DevTools ${pathname} returned invalid JSON: ${error.message}`));
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('DevTools HTTP request timed out')));
  });
}

class CdpSocket {
  constructor(webSocketUrl) {
    this.url = new URL(webSocketUrl);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.fragmentOpcode = 0;
    this.fragments = [];
    this.closed = false;
  }

  async connect() {
    assert(this.url.protocol === 'ws:', `unsupported DevTools WebSocket URL: ${this.url}`);
    const host = this.url.hostname === 'localhost' ? '127.0.0.1' : this.url.hostname;
    const wsPort = Number(this.url.port || port);
    const key = crypto.randomBytes(16).toString('base64');
    const expectedAccept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port: wsPort });
      this.socket = socket;
      let handshake = Buffer.alloc(0);
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      socket.setTimeout(10000, () => fail(new Error('DevTools WebSocket handshake timed out')));
      socket.once('error', fail);
      socket.on('connect', () => {
        const path = `${this.url.pathname}${this.url.search}`;
        const request = [
          `GET ${path} HTTP/1.1`,
          `Host: ${this.url.host}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '',
          ''
        ].join('\r\n');
        socket.write(request);
      });

      const onHandshakeData = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const end = handshake.indexOf('\r\n\r\n');
        if (end < 0) return;

        const headerText = handshake.subarray(0, end).toString('utf8');
        const lines = headerText.split('\r\n');
        if (!/^HTTP\/1\.[01] 101\b/.test(lines[0])) {
          fail(new Error(`DevTools WebSocket upgrade failed: ${lines[0]}`));
          return;
        }
        const headers = new Map();
        for (const line of lines.slice(1)) {
          const colon = line.indexOf(':');
          if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
        }
        if (headers.get('sec-websocket-accept') !== expectedAccept) {
          fail(new Error('DevTools WebSocket returned an invalid Sec-WebSocket-Accept value'));
          return;
        }

        settled = true;
        socket.setTimeout(0);
        socket.off('data', onHandshakeData);
        socket.removeListener('error', fail);
        socket.on('error', (error) => this.abort(error));
        socket.on('close', () => this.abort(new Error('DevTools WebSocket closed')));
        socket.on('data', (data) => this.onData(data));

        const remainder = handshake.subarray(end + 4);
        if (remainder.length) this.onData(remainder);
        resolve();
      };
      socket.on('data', onHandshakeData);
    });
  }

  abort(error) {
    if (this.closed) return;
    this.closed = true;
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try { this.sendFrame(0x8, Buffer.alloc(0)); } catch (_) {}
    if (this.socket) this.socket.end();
  }

  sendFrame(opcode, payload) {
    assert(this.socket && !this.socket.destroyed, 'DevTools WebSocket is not connected');
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const mask = crypto.randomBytes(4);
    let header;
    if (data.length < 126) {
      header = Buffer.alloc(2);
      header[1] = 0x80 | data.length;
    } else if (data.length <= 0xffff) {
      header = Buffer.alloc(4);
      header[1] = 0x80 | 126;
      header.writeUInt16BE(data.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(data.length), 2);
    }
    header[0] = 0x80 | (opcode & 0x0f);
    const masked = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i & 3];
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const fin = !!(first & 0x80);
      const opcode = first & 0x0f;
      const masked = !!(second & 0x80);
      let length = second & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        const bigLength = this.buffer.readBigUInt64BE(offset);
        assert(bigLength <= BigInt(Number.MAX_SAFE_INTEGER), 'oversized DevTools WebSocket frame');
        length = Number(bigLength);
        offset += 8;
      }

      let mask;
      if (masked) {
        if (this.buffer.length < offset + 4) return;
        mask = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }
      if (this.buffer.length < offset + length) return;

      let payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      this.buffer = this.buffer.subarray(offset + length);
      if (masked) {
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }

      if (opcode === 0x8) {
        this.abort(new Error('DevTools WebSocket sent close frame'));
        return;
      }
      if (opcode === 0x9) {
        this.sendFrame(0xA, payload);
        continue;
      }
      if (opcode === 0xA) continue;

      if (opcode === 0x1) {
        if (fin) this.onText(payload.toString('utf8'));
        else {
          this.fragmentOpcode = opcode;
          this.fragments = [payload];
        }
        continue;
      }
      if (opcode === 0x0 && this.fragmentOpcode === 0x1) {
        this.fragments.push(payload);
        if (fin) {
          const text = Buffer.concat(this.fragments).toString('utf8');
          this.fragmentOpcode = 0;
          this.fragments = [];
          this.onText(text);
        }
      }
    }
  }

  onText(text) {
    let message;
    try { message = JSON.parse(text); } catch (_) { return; }
    if (!message || !message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(`CDP ${pending.method}: ${message.error.message}`));
    else pending.resolve(message.result || {});
  }

  call(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, 10000);
      this.pending.set(id, {
        method,
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
      try {
        this.sendFrame(0x1, Buffer.from(payload, 'utf8'));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async evaluate(expression) {
    const response = await this.call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (response.exceptionDetails) {
      const detail = response.exceptionDetails.exception?.description
        || response.exceptionDetails.text
        || 'unknown JavaScript exception';
      throw new Error(`WebView evaluation failed: ${detail}`);
    }
    return response.result ? response.result.value : undefined;
  }
}

async function findAppTarget() {
  const targets = await getJson('/json/list');
  assert(Array.isArray(targets), 'DevTools /json/list did not return a target array');
  const app = targets.find((target) =>
    target.type === 'page'
    && typeof target.url === 'string'
    && target.url.startsWith('https://appassets.androidplatform.net/assets/index.html')
    && !target.url.includes('dream=1'));
  if (!app) {
    const seen = targets.map((target) => `${target.type || '?'} ${target.url || '?'}`).join('\n  ');
    throw new Error(`interactive AGC DSKY WebView target not found; saw:\n  ${seen || '(no targets)'}`);
  }
  assert(app.webSocketDebuggerUrl, 'interactive WebView target has no webSocketDebuggerUrl');
  return app;
}

function statusExpression() {
  return `(() => {
    const c = window.AGCDSKY && AGCDSKY.getCore ? AGCDSKY.getCore() : null;
    return {
      ready: !!window.AGCDSKY,
      mission: window.AGCDSKY && AGCDSKY.getMission ? AGCDSKY.getMission() : null,
      core: !!c,
      running: !!(c && c.running),
      modeText: document.getElementById('mode') ? document.getElementById('mode').textContent : '',
      agcButton: document.getElementById('agc') ? document.getElementById('agc').textContent.trim() : ''
    };
  })()`;
}

function displayExpression() {
  return `(() => {
    const map = {
      abcdef:'0', bc:'1', abdeg:'2', abcdg:'3', bcfg:'4', acdfg:'5',
      acdefg:'6', abc:'7', abcdefg:'8', abcdfg:'9'
    };
    const readGlyph = (g) => {
      const key = Array.from(g.querySelectorAll('.el-seg.on[data-seg]'))
        .map((s) => s.dataset.seg).sort().join('');
      return map[key] || ' ';
    };
    const readDigits = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      return Array.from(el.querySelectorAll('.el-glyph')).map(readGlyph).join('');
    };
    return {
      prog: readDigits('prog'),
      verb: readDigits('verb'),
      noun: readDigits('noun'),
      r1: readDigits('r1'),
      r2: readDigits('r2'),
      r3: readDigits('r3'),
      modeText: document.getElementById('mode') ? document.getElementById('mode').textContent : ''
    };
  })()`;
}

async function pollStatus(cdp, label, predicate, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await cdp.evaluate(statusExpression());
    if (predicate(last)) return last;
    await delay(150);
  }
  throw new Error(`${label} timed out; last state: ${JSON.stringify(last)}`);
}

async function ensureClock(cdp) {
  const status = await cdp.evaluate(statusExpression());
  if (status.agcButton === 'CLOCK') {
    await cdp.evaluate("document.getElementById('agc').click(); true");
    await pollStatus(cdp, 'return to phone clock', (s) => s.agcButton === 'AGC' && !s.running, 5000);
  }
}

async function ensureLuminary(cdp) {
  let status = await cdp.evaluate(statusExpression());
  if (status.mission === 'luminary099') return;
  await ensureClock(cdp);
  await cdp.evaluate("document.getElementById('mission').click(); true");
  status = await pollStatus(cdp, 'select Luminary099', (s) => s.mission === 'luminary099', 5000);
  assert(status.mission === 'luminary099', 'failed to select Luminary099');
}

async function enterLuminary(cdp) {
  await ensureClock(cdp);
  await ensureLuminary(cdp);
  await cdp.evaluate("document.getElementById('agc').click(); true");
  return pollStatus(cdp, 'start Luminary099', (s) =>
    s.mission === 'luminary099'
    && s.core
    && s.running
    && !s.modeText.includes('AGC ERROR'), 20000);
}

async function pointerKey(cdp, key, pointerId) {
  const result = await cdp.evaluate(`(() => {
    const b = document.querySelector('[data-key=${JSON.stringify(key)}]');
    if (!b || typeof PointerEvent !== 'function') return false;
    b.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: ${pointerId}, pointerType: 'touch', isPrimary: true
    }));
    document.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: ${pointerId}, pointerType: 'touch', isPrimary: true
    }));
    return true;
  })()`);
  assert(result === true, `could not dispatch DSKY key ${key} through pointer handler`);
  await delay(90);
}

async function keySequence(cdp, keys, basePointerId) {
  for (let i = 0; i < keys.length; i++) {
    await pointerKey(cdp, keys[i], basePointerId + i);
  }
}

async function waitForV35Display(cdp) {
  const deadline = Date.now() + 4000;
  let last;
  while (Date.now() < deadline) {
    last = await cdp.evaluate(displayExpression());
    const allEight = last
      && last.prog === '88'
      && last.verb === '88'
      && last.noun === '88'
      && last.r1 === '88888'
      && last.r2 === '88888'
      && last.r3 === '88888';
    if (allEight) return last;
    if (last && last.modeText.includes('AGC ERROR')) {
      throw new Error(`AGC stopped during V35E: ${last.modeText}`);
    }
    await delay(100);
  }
  throw new Error(`V35E did not render the complete all-8 DSKY pattern; last display: ${JSON.stringify(last)}`);
}

async function snapshotState(cdp) {
  return cdp.evaluate(`(() => ({
    mission: localStorage.getItem('agcMission'),
    runMode: localStorage.getItem('runMode')
  }))()`);
}

async function restoreState(cdp, snapshot) {
  try {
    await ensureClock(cdp);
    const wantedMission = snapshot.mission === 'comanche055' ? 'comanche055' : 'luminary099';
    let status = await cdp.evaluate(statusExpression());
    if (status.mission !== wantedMission) {
      await cdp.evaluate("document.getElementById('mission').click(); true");
      await pollStatus(cdp, `restore ${wantedMission}`, (s) => s.mission === wantedMission, 5000);
    }
    if (snapshot.mission === null) {
      await cdp.evaluate("localStorage.removeItem('agcMission'); true");
    }
    if (snapshot.runMode === 'agc') {
      await cdp.evaluate("document.getElementById('agc').click(); true");
      await pollStatus(cdp, 'restore prior AGC run mode', (s) => s.core && s.running, 20000);
    } else if (snapshot.runMode === null) {
      await cdp.evaluate("localStorage.removeItem('runMode'); true");
    } else {
      await cdp.evaluate(`localStorage.setItem('runMode', ${JSON.stringify(snapshot.runMode)}); true`);
    }
  } catch (error) {
    console.error(`warning: could not fully restore pre-smoke frontend state: ${error.message}`);
  }
}

async function main() {
  const target = await findAppTarget();
  const cdp = new CdpSocket(target.webSocketDebuggerUrl);
  await cdp.connect();
  let snapshot;
  try {
    await cdp.call('Runtime.enable');
    const ready = await cdp.evaluate("!!(window.AGCDSKY && document.getElementById('agc'))");
    assert(ready === true, 'AGC DSKY frontend is not initialized in the interactive WebView');
    snapshot = await snapshotState(cdp);

    await enterLuminary(cdp);

    // V37E00E puts the flight program in P00, the documented prerequisite for
    // the full DSKY light test. Then V35E must be interpreted by the actual
    // Luminary rope and drive the rendered DSKY through output channel 010.
    await keySequence(cdp, ['V', '3', '7', 'E', '0', '0', 'E'], 1100);
    await delay(500);
    await keySequence(cdp, ['V', '3', '5', 'E'], 1200);
    const display = await waitForV35Display(cdp);

    console.log('Device V35 semantic smoke: PASS');
    console.log(`  rendered DSKY: PROG ${display.prog} VERB ${display.verb} NOUN ${display.noun}`);
    console.log(`  registers: ${display.r1} ${display.r2} ${display.r3}`);
    console.log('  path: pointer input -> yaAGC/Luminary099 -> channel 010 -> SVG display');
  } finally {
    if (snapshot) await restoreState(cdp, snapshot);
    cdp.close();
  }
}

main().catch((error) => {
  console.error(`DEVICE V35 SEMANTIC SMOKE FAIL: ${error.stack || error}`);
  process.exitCode = 1;
});
