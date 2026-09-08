#!/usr/bin/env node
'use strict';

/*
 * End-to-end semantic V35 gate for the current CM-only Android WebView.
 *
 * Path proven by this smoke:
 *   pointer events -> Pinball -> real yaAGC/Comanche055 -> channel 010/011/0163
 *   -> hardware-fidelity latches + app state -> rendered DSKY/annunciators.
 *
 * Requires the DevTools socket to have already been adb-forwarded by
 * tools/device-agc-smoke.sh. No npm packages are used; Node 18+ is enough.
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
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

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
        try { resolve(JSON.parse(body)); }
        catch (error) { reject(new Error(`DevTools ${pathname} returned invalid JSON: ${error.message}`)); }
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
    const expectedAccept = crypto.createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port: wsPort });
      this.socket = socket;
      let handshake = Buffer.alloc(0);
      let settled = false;
      const fail = (error) => { if (!settled) { settled = true; reject(error); } };
      socket.setTimeout(10000, () => fail(new Error('DevTools WebSocket handshake timed out')));
      socket.once('error', fail);
      socket.on('connect', () => {
        socket.write([
          `GET ${this.url.pathname}${this.url.search} HTTP/1.1`,
          `Host: ${this.url.host}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13', '', ''
        ].join('\r\n'));
      });
      const onHandshakeData = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const end = handshake.indexOf('\r\n\r\n');
        if (end < 0) return;
        const lines = handshake.subarray(0, end).toString('utf8').split('\r\n');
        if (!/^HTTP\/1\.[01] 101\b/.test(lines[0])) return fail(new Error(`DevTools upgrade failed: ${lines[0]}`));
        const headers = new Map();
        for (const line of lines.slice(1)) {
          const colon = line.indexOf(':');
          if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
        }
        if (headers.get('sec-websocket-accept') !== expectedAccept) return fail(new Error('invalid Sec-WebSocket-Accept'));
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
      header = Buffer.alloc(2); header[1] = 0x80 | data.length;
    } else if (data.length <= 0xffff) {
      header = Buffer.alloc(4); header[1] = 0x80 | 126; header.writeUInt16BE(data.length, 2);
    } else {
      header = Buffer.alloc(10); header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(data.length), 2);
    }
    header[0] = 0x80 | (opcode & 0x0f);
    const masked = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i & 3];
    this.socket.write(Buffer.concat([header, mask, masked]));
  }
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0], second = this.buffer[1];
      const fin = !!(first & 0x80), opcode = first & 0x0f, masked = !!(second & 0x80);
      let length = second & 0x7f, offset = 2;
      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset); offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        const big = this.buffer.readBigUInt64BE(offset);
        assert(big <= BigInt(Number.MAX_SAFE_INTEGER), 'oversized DevTools frame');
        length = Number(big); offset += 8;
      }
      let mask;
      if (masked) {
        if (this.buffer.length < offset + 4) return;
        mask = this.buffer.subarray(offset, offset + 4); offset += 4;
      }
      if (this.buffer.length < offset + length) return;
      const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      this.buffer = this.buffer.subarray(offset + length);
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      if (opcode === 0x8) { this.abort(new Error('DevTools WebSocket sent close frame')); return; }
      if (opcode === 0x9) { this.sendFrame(0xA, payload); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1) {
        if (fin) this.onText(payload.toString('utf8'));
        else { this.fragmentOpcode = opcode; this.fragments = [payload]; }
      } else if (opcode === 0x0 && this.fragmentOpcode === 0x1) {
        this.fragments.push(payload);
        if (fin) {
          this.onText(Buffer.concat(this.fragments).toString('utf8'));
          this.fragmentOpcode = 0; this.fragments = [];
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
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id); reject(new Error(`CDP ${method} timed out`));
      }, 10000);
      this.pending.set(id, {
        method,
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
      try { this.sendFrame(0x1, Buffer.from(JSON.stringify({ id, method, params }), 'utf8')); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async evaluate(expression) {
    const response = await this.call('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true
    });
    if (response.exceptionDetails) {
      const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'unknown JavaScript exception';
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
  if (!app) throw new Error(`interactive AGC DSKY WebView target not found; saw ${JSON.stringify(targets)}`);
  assert(app.webSocketDebuggerUrl, 'interactive WebView target has no webSocketDebuggerUrl');
  return app;
}

function statusExpression() {
  return `(() => {
    const api=window.AGCDSKY;
    const app=api&&typeof api.appStatus==='function'?api.appStatus():null;
    const c=api&&typeof api.getCore==='function'?api.getCore():null;
    return {
      ready:!!(api&&typeof api.appStatus==='function'&&typeof api.hardware==='function'),
      mission:api&&typeof api.getMission==='function'?api.getMission():null,
      mode:app?app.mode:null,
      core:!!c,
      running:!!(c&&c.running),
      modeText:document.getElementById('mode')?document.getElementById('mode').textContent:''
    };
  })()`;
}

function dskyExpression() {
  return `(() => {
    const api=window.AGCDSKY;
    if(!api||typeof api.appStatus!=='function'||typeof api.hardware!=='function')return null;
    const app=api.appStatus(),hw=api.hardware(),d=app.display||{};
    const reg=(r)=>({sign:r?(r.plus?'+':(r.minus?'-':' ')):' ',digits:r&&Array.isArray(r.digits)?r.digits.join(''):''});
    const lamps={};
    document.querySelectorAll('[data-lamp]').forEach((el)=>{if(el.dataset.lamp)lamps[el.dataset.lamp]=el.classList.contains('on')});
    return {
      mode:app.mode,
      mission:app.mission,
      coreRunning:app.coreRunning,
      channels:app.channels||{},
      relays:hw.latches||{},
      display:{prog:(d.prog||[]).join(''),verb:(d.verb||[]).join(''),noun:(d.noun||[]).join(''),r1:reg(d.r1),r2:reg(d.r2),r3:reg(d.r3)},
      lamps,
      vnBlanked:document.body.classList.contains('vn-flash-off'),
      elOff:document.body.classList.contains('el-off'),
      lampTestActive:!!hw.lampTestActive,
      modeText:document.getElementById('mode')?document.getElementById('mode').textContent:''
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

async function enterComanche(cdp) {
  let status = await cdp.evaluate(statusExpression());
  assert(status.mission === 'comanche055', `CM-only build reported unexpected mission ${status.mission}`);
  if (status.mode !== 'agc' || !status.running) {
    await cdp.evaluate("document.getElementById('agc').click(); true");
    status = await pollStatus(cdp, 'start Comanche055', (s) =>
      s.ready && s.mission === 'comanche055' && s.mode === 'agc' && s.core && s.running && !s.modeText.includes('AGC ERROR'));
  }
  return status;
}

async function pointerKey(cdp, key, pointerId) {
  const result = await cdp.evaluate(`(() => {
    const b=document.querySelector('[data-key=${JSON.stringify(key)}]');
    if(!b||typeof PointerEvent!=='function')return false;
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:${pointerId},pointerType:'touch',isPrimary:true}));
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:${pointerId},pointerType:'touch',isPrimary:true}));
    return true;
  })()`);
  assert(result === true, `could not dispatch DSKY key ${key} through pointer handler`);
  await delay(90);
}
async function keySequence(cdp, keys, basePointerId) {
  for (let i = 0; i < keys.length; i++) await pointerKey(cdp, keys[i], basePointerId + i);
}

const PROGRAM00_LOW11 = 0o1265;
const V35_RELAY_LOW11 = Object.freeze({
  1:0o1675,2:0o3675,3:0o1675,4:0o1675,5:0o3675,6:0o1675,
  7:0o3675,8:0o1675,9:0o1675,10:0o1675,11:0o1675,12:0o0650
});

function relayWordsMatch(state) {
  if (!state || !state.relays) return false;
  return Object.entries(V35_RELAY_LOW11).every(([relay, expected]) => Number(state.relays[relay]) === expected);
}

function discreteChannelsMatchRenderedState(state) {
  if (!state || state.mode !== 'agc' || !state.channels || !state.lamps) return false;
  const v11 = Number(state.channels.ch011 || 0);
  const v163 = Number(state.channels.ch0163 || 0);
  return state.lamps.comp === !!(v11 & 0o00002)
    && state.lamps.uplink === !!(v11 & 0o00004)
    && state.lamps.temp === !!(v163 & 0o00010)
    && state.lamps.keyrel === !!(v163 & 0o00020)
    && state.vnBlanked === !!(v163 & 0o00040)
    && state.lamps.oprerr === !!(v163 & 0o00100)
    && state.lamps.restart === !!(v163 & 0o00200)
    && state.lamps.stby === !!(v163 & 0o00400)
    && state.elOff === !!(v163 & 0o01000);
}

async function waitForP00(cdp) {
  const deadline = Date.now() + 5000;
  let last;
  while (Date.now() < deadline) {
    last = await cdp.evaluate(dskyExpression());
    if (last && last.display.prog === '00' && Number(last.relays[11]) === PROGRAM00_LOW11) return last;
    if (last && last.modeText.includes('AGC ERROR')) throw new Error(`AGC stopped while entering P00: ${last.modeText}`);
    await delay(75);
  }
  throw new Error(`V37E00E did not reach P00; last state: ${JSON.stringify(last)}`);
}

function visibleV35State(state) {
  if (!state || !state.display || !state.lamps) return false;
  const d = state.display;
  return d.prog === '88' && d.verb === '88' && d.noun === '88'
    && d.r1.sign === '+' && d.r1.digits === '88888'
    && d.r2.sign === '+' && d.r2.digits === '88888'
    && d.r3.sign === '+' && d.r3.digits === '88888'
    && state.lampTestActive === false
    && relayWordsMatch(state)
    && discreteChannelsMatchRenderedState(state);
}

async function waitForVisibleV35(cdp) {
  const deadline = Date.now() + 5000;
  let last;
  while (Date.now() < deadline) {
    last = await cdp.evaluate(dskyExpression());
    if (visibleV35State(last)) return last;
    if (last && last.modeText.includes('AGC ERROR')) throw new Error(`AGC stopped during V35E: ${last.modeText}`);
    await delay(75);
  }
  throw new Error(`Comanche V35E did not reach complete relay/render/raw-channel state; last state: ${JSON.stringify(last)}`);
}

async function proveFlashPhase(cdp, initial) {
  const initialBlank = !!initial.vnBlanked;
  const deadline = Date.now() + 1800;
  let last;
  while (Date.now() < deadline) {
    last = await cdp.evaluate(dskyExpression());
    if (last && last.vnBlanked !== initialBlank && relayWordsMatch(last) && discreteChannelsMatchRenderedState(last)) return last;
    await delay(50);
  }
  throw new Error(`Comanche V35E did not expose a channel-0163-consistent V/N flash transition; last state: ${JSON.stringify(last)}`);
}

async function snapshotState(cdp) {
  return cdp.evaluate(`(() => ({runMode:localStorage.getItem('runMode')}))()`);
}
async function restoreState(cdp, snapshot) {
  try {
    const status = await cdp.evaluate(statusExpression());
    if (snapshot.runMode === 'clock' && status.mode !== 'clock') {
      await cdp.evaluate("document.getElementById('clock').click(); true");
      await pollStatus(cdp, 'restore clock mode', (s) => s.mode === 'clock' && !s.running, 5000);
    } else if (snapshot.runMode === 'agc' && (status.mode !== 'agc' || !status.running)) {
      await enterComanche(cdp);
    } else if (snapshot.runMode === null) {
      await cdp.evaluate("localStorage.removeItem('runMode'); true");
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
    const ready = await cdp.evaluate("!!(window.AGCDSKY && typeof AGCDSKY.appStatus==='function' && typeof AGCDSKY.hardware==='function' && document.getElementById('agc'))");
    assert(ready === true, 'AGC DSKY app/hardware diagnostic surface is not initialized');
    snapshot = await snapshotState(cdp);
    await enterComanche(cdp);

    await keySequence(cdp, ['V','3','7','E','0','0','E'], 1100);
    const p00 = await waitForP00(cdp);
    await keySequence(cdp, ['V','3','5','E'], 1200);
    const visible = await waitForVisibleV35(cdp);
    const flash = await proveFlashPhase(cdp, visible);

    console.log('Device Comanche055 V35 semantic smoke: PASS');
    console.log(`  P00: PROG ${p00.display.prog}; relay 11 low-11 0o${Number(p00.relays[11]).toString(8).padStart(4,'0')}`);
    console.log(`  V35: ${visible.display.prog}/${visible.display.verb}/${visible.display.noun} ${visible.display.r1.sign}${visible.display.r1.digits} ${visible.display.r2.sign}${visible.display.r2.digits} ${visible.display.r3.sign}${visible.display.r3.digits}`);
    console.log(`  relay 12 low-11: 0o${Number(visible.relays[12]).toString(8).padStart(4,'0')}`);
    console.log(`  channel 011: 0o${Number(visible.channels.ch011 || 0).toString(8).padStart(5,'0')}`);
    console.log(`  channel 0163 visible/flash: 0o${Number(visible.channels.ch0163 || 0).toString(8).padStart(5,'0')} / 0o${Number(flash.channels.ch0163 || 0).toString(8).padStart(5,'0')}`);
    console.log('  path: pointer input -> yaAGC/Comanche055 -> raw channels/hardware latches -> DSKY');
  } finally {
    if (snapshot) await restoreState(cdp, snapshot);
    cdp.close();
  }
}

main().catch((error) => {
  console.error(`DEVICE V35 SEMANTIC SMOKE FAIL: ${error.stack || error}`);
  process.exitCode = 1;
});
