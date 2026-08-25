// GPL-2.0-or-later
// Android/WebView embedding wrapper for the pinned VirtualAGC yaAGC WebAssembly core.
(function(global){
  'use strict';

  const U_BIT = 1 << 8;
  const NORMAL_KEY_CHANNEL = 0o15;
  const PROCEED_CHANNEL = 0o32;
  const NORMAL_KEY_MASK = 0o37;
  const PROCEED_MASK = 0o20000; // Input channel 032, bit 14.
  const FIXED_ROPE_BYTES = 36 * 0o2000 * 2;
  const WASI_ESPIPE = 70;

  function makeWasi(memory){
    const decoder = new TextDecoder('utf-8');
    const dataView = () => new DataView(memory.buffer);

    function setU64AllOnes(view, offset){
      if (typeof view.setBigUint64 === 'function') {
        view.setBigUint64(offset, 0xffffffffffffffffn, true);
      } else {
        view.setUint32(offset, 0xffffffff, true);
        view.setUint32(offset + 4, 0xffffffff, true);
      }
    }

    return {
      fd_close(fd){
        return 0;
      },

      fd_fdstat_get(fd, statPtr){
        const bytes = new Uint8Array(memory.buffer);
        bytes.fill(0, statPtr, statPtr + 24);
        const view = dataView();
        // __WASI_FILETYPE_CHARACTER_DEVICE. yaAGC only needs stdio-like FDs.
        view.setUint8(statPtr, 2);
        setU64AllOnes(view, statPtr + 8);
        setU64AllOnes(view, statPtr + 16);
        return 0;
      },

      fd_seek(fd, offset, whence, newOffsetPtr){
        // stdin/stdout/stderr are not seekable.
        return WASI_ESPIPE;
      },

      fd_write(fd, iovsPtr, iovsLen, writtenPtr){
        const view = dataView();
        const bytes = new Uint8Array(memory.buffer);
        let total = 0;
        let text = '';
        for (let i = 0; i < iovsLen; i++) {
          const entry = iovsPtr + i * 8;
          const ptr = view.getUint32(entry, true);
          const len = view.getUint32(entry + 4, true);
          if (ptr + len <= bytes.length) {
            text += decoder.decode(bytes.subarray(ptr, ptr + len), {stream:true});
            total += len;
          }
        }
        text += decoder.decode();
        if (text.trim()) {
          (fd === 2 ? console.error : console.log)('[yaAGC] ' + text.trimEnd());
        }
        view.setUint32(writtenPtr, total, true);
        return 0;
      }
    };
  }

  async function requireOk(response, label){
    if (!response.ok) throw new Error(label + ' HTTP ' + response.status);
    return response;
  }

  class AgcCore {
    constructor(options={}){
      this.onChannelUpdate = options.onChannelUpdate || function(){};
      this.onError = options.onError || function(error){ console.error(error); };
      this.channels = Object.create(null);
      this.clockDivisor = 1;
      this.totalSteps = 0;
      this.running = false;
      this.timer = 0;
      this.startTime = 0;
    }

    async load(options={}){
      const wasmUrl = options.wasmUrl || 'yaAGC.wasm';
      const ropeUrl = options.ropeUrl || 'Luminary099.bin';

      this.memory = new WebAssembly.Memory({initial:5});
      const wasmResponse = await requireOk(await fetch(wasmUrl), 'yaAGC.wasm');
      const wasmBytes = await wasmResponse.arrayBuffer();
      const module = await WebAssembly.compile(wasmBytes);

      const imports = {
        env: {memory:this.memory},
        wasi_snapshot_preview1: makeWasi(this.memory)
      };
      const result = await WebAssembly.instantiate(module, imports);
      this.instance = result;
      this.exports = result.exports;

      const required = ['malloc','free','set_fixed','cpu_reset','cpu_step','packet_write','packet_read'];
      for (const name of required) {
        if (typeof this.exports[name] !== 'function') {
          throw new Error('yaAGC missing required export: ' + name);
        }
      }

      const ropeResponse = await requireOk(await fetch(ropeUrl), ropeUrl);
      await this.loadRope(await ropeResponse.arrayBuffer());
      this.reset();
      this.configureInputMasks();
      return this;
    }

    version(){
      if (!this.exports || typeof this.exports.version !== 'function') return 'unknown';
      const ptr = this.exports.version();
      const bytes = new Uint8Array(this.memory.buffer);
      let end = ptr;
      while (end < bytes.length && bytes[end] !== 0) end++;
      return new TextDecoder('utf-8').decode(bytes.subarray(ptr, end));
    }

    async loadRope(buffer){
      const rope = new Uint8Array(buffer);
      if (rope.byteLength !== FIXED_ROPE_BYTES) {
        throw new Error('Invalid AGC rope size: ' + rope.byteLength
            + ' bytes; expected ' + FIXED_ROPE_BYTES);
      }
      const ptr = this.exports.malloc(rope.byteLength);
      if (!ptr) throw new Error('yaAGC malloc failed for rope image');
      try {
        new Uint8Array(this.memory.buffer).set(rope, ptr);
        this.exports.set_fixed(ptr);
      } finally {
        this.exports.free(ptr);
      }
    }

    configureInputMasks(){
      // The U-bit message sets which bits this DSKY peripheral is allowed to
      // affect, matching the VirtualAGC socket protocol semantics.
      this.writeIo(U_BIT | NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK);
      this.writeIo(U_BIT | PROCEED_CHANNEL, PROCEED_MASK);
    }

    reset(){
      this.stop();

      // ringbuffer_api.c initializes ringbuffer_in/out lazily from the first
      // ChannelInput/ChannelOutput call. U-bit packets queued before that are
      // discarded by ChannelSetup(). Prime one engine pass solely to force I/O
      // setup and consume any pending peripheral input, discard transient output,
      // then reset again so mission execution still begins at the true reset
      // vector. On later resets this also prevents stale queued key packets from
      // leaking into the next run.
      this.exports.cpu_reset();
      this.exports.cpu_step(1);
      this.discardIo();
      this.exports.cpu_reset();

      this.channels = Object.create(null);
      this.totalSteps = 0;
      this.startTime = performance.now();
    }

    writeIo(channel, value){
      this.exports.packet_write(channel, value);
    }

    keyPress(keyCode){
      if (!keyCode) return;
      this.writeIo(NORMAL_KEY_CHANNEL, keyCode & 0o37);
    }

    proceedKey(state){
      this.writeIo(PROCEED_CHANNEL, state ? PROCEED_MASK : 0);
    }

    proceedPulse(durationMs=120){
      this.proceedKey(true);
      setTimeout(() => this.proceedKey(false), durationMs);
    }

    readIo(){
      const packed = this.exports.packet_read() >>> 0;
      return [packed >>> 16, packed & 0xffff];
    }

    discardIo(){
      for (let i = 0; i < 10000; i++) {
        const [channel, value] = this.readIo();
        if (channel === 0 && value === 0) return;
      }
      throw new Error('yaAGC I/O queue did not drain during reset');
    }

    drainIo(){
      // Cap the drain so a bad core/runtime cannot wedge the WebView UI thread.
      for (let i = 0; i < 10000; i++) {
        const [channel, value] = this.readIo();
        if (channel === 0 && value === 0) return;
        if (this.channels[channel] !== value) {
          this.channels[channel] = value;
          this.onChannelUpdate(channel, value);
        }
      }
      throw new Error('yaAGC I/O queue did not drain');
    }

    step(steps){
      if (steps > 0) this.exports.cpu_step(steps);
      this.totalSteps += Math.max(0, steps);
      this.drainIo();
    }

    start(clockDivisor=1){
      if (this.running) return;
      this.clockDivisor = Math.max(0.05, Number(clockDivisor) || 1);
      this.running = true;
      this.totalSteps = 0;
      this.startTime = performance.now();
      const cycleMs = 0.01172; // Approx. 11.72 microseconds per AGC instruction.

      this.timer = setInterval(() => {
        if (!this.running) return;
        try {
          const target = Math.floor((performance.now() - this.startTime)
              / cycleMs / this.clockDivisor);
          const diff = target - this.totalSteps;
          if (diff < 0 || diff > 100000) {
            this.startTime = performance.now();
            this.totalSteps = 0;
            return;
          }
          this.step(diff);
        } catch (error) {
          this.stop();
          this.onError(error);
        }
      }, 1000 / 60);
    }

    stop(){
      this.running = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = 0;
    }
  }

  global.AgcCore = AgcCore;
})(window);
