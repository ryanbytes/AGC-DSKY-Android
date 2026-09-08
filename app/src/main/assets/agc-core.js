// GPL-2.0-or-later
// Android/WebView embedding wrapper for the pinned VirtualAGC yaAGC WebAssembly core.
(function(global){
  'use strict';

  const U_BIT = 1 << 8;
  const NORMAL_KEY_CHANNEL = 0o15;
  const PROCEED_CHANNEL = 0o32;
  const NORMAL_KEY_MASK = 0o37;
  const PROCEED_MASK = 0o20000; // Input channel 032, bit 14.
  const ISS_STATUS_CHANNEL = 0o30;
  const ISS_OPERATE_MASK = 0o00400; // Channel 030 bit 9; active-low ISS OPERATE discrete.
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
      const ropeUrl = options.ropeUrl || 'Comanche055.bin';

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
      // ringbuffer_api.c performs its one-time ChannelSetup on the first CPU
      // step and clears the input ring buffer.  Initialize it before queuing
      // masks/discretes, otherwise startup hardware packets are discarded.
      if (this.totalSteps === 0) {
        this.exports.cpu_step(1);
        this.totalSteps = 1;
        this.drainIo();
      }

      // The U-bit message sets which bits each simulated peripheral is allowed
      // to affect, matching the VirtualAGC socket protocol semantics.
      this.writeIo(U_BIT | NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK);
      this.writeIo(U_BIT | PROCEED_CHANNEL, PROCEED_MASK);

      // The phone-backed IMU represents a CSM whose ISS is already switched to
      // OPERATE when the CMC comes up.  Apollo channel 030 bit 9 is active-low.
      // Own only that one bit; Comanche's IMUMON/TNONTEST code then performs
      // the real operate-only ICDU initialization and updates IMODES30 itself.
      this.writeIo(U_BIT | ISS_STATUS_CHANNEL, ISS_OPERATE_MASK);
      this.writeIo(ISS_STATUS_CHANNEL, 0);
    }

    reset(){
      this.channels = Object.create(null);
      this.exports.cpu_reset();
      this.totalSteps = 0;
      this.startTime = performance.now();
    }

    writeIo(channel, value){
      return this.exports.packet_write(channel, value);
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

    // Navigation keyboard (MARK / MARK REJECT) is physically separate from
    // the DSKY. The pinned VirtualAGC ring-buffer WebAssembly transport writes
    // channel 016 correctly but, unlike the socket build, does not raise the
    // corresponding KEYRUPT2 request. Reproduce that missing peripheral edge
    // here without modifying erasable AGC memory or flight software.
    navKeyPress(value){
      if (!this.exports || typeof this.exports.get_erasable_ptr !== 'function') return false;
      const accepted = this.writeIo(0o16, value & 0o177);
      if (!(accepted > 0)) return false;

      // Process the channel-016 packet before asserting KEYRUPT2 so MARKRUPT
      // samples the new NAVKEYIN value, just as the hardware interrupt follows
      // switch closure. Account for the single MCT in scheduler bookkeeping.
      this.exports.cpu_step(1);
      this.totalSteps += 1;
      this.drainIo();

      // ABI of the pinned yaAGC agc_t following Erasable: Fixed, Parities,
      // InputChannel, OutputChannel7, OutputChannel10, IndexValue, then
      // InterruptRequests[]. KEYRUPT1 is request 5; KEYRUPT2 is request 6.
      const ERASABLE_TO_INTERRUPT_REQUESTS = 92196;
      const erasable = this.exports.get_erasable_ptr() >>> 0;
      const addr = erasable + ERASABLE_TO_INTERRUPT_REQUESTS + 6;
      const bytes = new Uint8Array(this.memory.buffer);
      if (addr >= bytes.length) return false;
      bytes[addr] = 1;
      return true;
    }

    navKeyRelease(){
      return this.writeIo(0o16, 0);
    }

    navKeyPulse(value, durationMs=90){
      if (!this.navKeyPress(value)) return false;
      setTimeout(() => this.navKeyRelease(), Math.max(20, durationMs|0));
      return true;
    }

    snapshotFingerprint(){
      if (!this.memory) return null;
      const bytes = new Uint8Array(this.memory.buffer);
      let h = 0x811c9dc5;
      for (let i=0; i<bytes.length; i++) {
        h ^= bytes[i];
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h.toString(16).padStart(8,'0');
    }

    exportSnapshot(){
      if (!this.memory) throw new Error('AGC core not loaded');
      const bytes = new Uint8Array(this.memory.buffer);
      // Avoid apply/spread limits on the ~320 KiB WebAssembly image.
      let binary = '';
      const chunk = 0x6000;
      for (let i=0; i<bytes.length; i+=chunk) {
        const part = bytes.subarray(i, Math.min(bytes.length, i+chunk));
        let text = '';
        for (let j=0; j<part.length; j++) text += String.fromCharCode(part[j]);
        binary += text;
      }
      return {schema:1, byteLength:bytes.length, fingerprint:this.snapshotFingerprint(), memoryB64:btoa(binary)};
    }

    importSnapshot(snapshot){
      if (!this.memory) throw new Error('AGC core not loaded');
      if (!snapshot || snapshot.schema !== 1 || typeof snapshot.memoryB64 !== 'string') {
        throw new Error('Unsupported AGC snapshot');
      }
      const binary = atob(snapshot.memoryB64);
      const bytes = new Uint8Array(this.memory.buffer);
      if (binary.length !== bytes.length || snapshot.byteLength !== bytes.length) {
        throw new Error('AGC snapshot memory size mismatch');
      }
      this.stop();
      for (let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
      if (snapshot.fingerprint && this.snapshotFingerprint() !== snapshot.fingerprint) {
        throw new Error('AGC snapshot fingerprint mismatch');
      }
      this.channels = Object.create(null);
      this.totalSteps = 0;
      this.startTime = performance.now();
      return true;
    }

    readErasable(bank, address){
      if (!this.exports || typeof this.exports.get_erasable_ptr !== 'function') return null;
      const b = bank|0, a = address|0;
      if (b < 0 || b >= 8 || a < 0 || a >= 0o400) return null;
      const base = this.exports.get_erasable_ptr() >>> 0;
      const words = new Uint16Array(this.memory.buffer);
      return words[(base >>> 1) + b*0o400 + a] & 0xffff;
    }

    readIo(){
      const packed = this.exports.packet_read() >>> 0;
      return [packed >>> 16, packed & 0xffff];
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
      const cycleMs = 1000 / 85333; // AGC master clock: ~85,333 machine cycles/second.

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
      }, 4); // 250 Hz peripheral drain minimizes 20-ms DSKY event quantization.
    }

    stop(){
      this.running = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = 0;
    }
  }

  global.AgcCore = AgcCore;
})(window);
