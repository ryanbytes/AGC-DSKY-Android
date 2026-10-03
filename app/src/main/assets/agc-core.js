// GPL-2.0-or-later
// Android/WebView embedding wrapper for the pinned VirtualAGC yaAGC WebAssembly core.
(function(global){
  'use strict';

  const U_BIT = 1 << 8;
  const NORMAL_KEY_CHANNEL = 0o15;
  const PROCEED_CHANNEL = 0o32;
  const NORMAL_KEY_MASK = 0o37;
  const INPUT_RING_MCT_FLUSH_LIMIT = 1024;
  const PROCEED_MASK = 0o20000; // Input channel 032, bit 14. Active low for PRO.
  // Pinned yaAGC agc_t ABI: from &State.Erasable to State.InputChannel.
  // Erasable 8*0400*2 + Fixed 40*02000*2 + Parities 40*(02000/32)*4.
  const ERASABLE_TO_INPUT_CHANNELS = 91136;
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
      // A successful packet_write is asynchronous.  Remember only the make
      // that may still be queued so KEYRST can defer its clear when necessary without
      // advancing the AGC on every ordinary physical release.
      this.pendingNormalKeyCode = 0;
      this.pendingNormalKeyRelease = false;
      this.pendingNavigationKeyCode = 0;
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

      const required = ['malloc','free','set_fixed','configure_cm_mode','get_cm_mode','cpu_reset','cpu_step','packet_write','packet_read'];
      for (const name of required) {
        if (typeof this.exports[name] !== 'function') {
          throw new Error('yaAGC missing required export: ' + name);
        }
      }

      const ropeResponse = await requireOk(await fetch(ropeUrl), ropeUrl);
      await this.loadRope(await ropeResponse.arrayBuffer());
      const configuredMode = this.exports.configure_cm_mode();
      if (configuredMode !== 1 || this.exports.get_cm_mode() !== 1) {
        throw new Error('yaAGC failed to select Command Module peripheral mode');
      }
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
      // The U-bit message sets which bits this DSKY peripheral is allowed to
      // affect, matching the VirtualAGC socket protocol semantics. Spacecraft
      // status channels are deliberately not synthesized here: changing the
      // active-low ISS OPERATE discrete is a real flight-software transition,
      // not a harmless startup default.
      this.writeIo(U_BIT | NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK);
      this.writeIo(U_BIT | PROCEED_CHANNEL, PROCEED_MASK);

      // PRO/STBY is a maintained active-low input.  yaDSKY sends channel 032
      // bit 020000 set when the button is released and clears it while the
      // astronaut holds PRO.  Establish the released level explicitly after
      // installing the U-bit mask so a fresh core cannot begin with PRO active.
      this.writeIo(PROCEED_CHANNEL, PROCEED_MASK);
    }

    reset(){
      this.stop();

      // ringbuffer_api.c initializes ringbuffer_in/out lazily from the first
      // ChannelInput/ChannelOutput call. Packets queued before that setup are
      // discarded. Prime one engine pass solely to initialize the transport,
      // drain its transient output, then reset again so mission execution still
      // begins at the true reset vector with peripheral masks ready to queue.
      this.exports.cpu_reset();
      this.exports.cpu_step(1);
      this.discardIo();
      this.exports.cpu_reset();

      this.channels = Object.create(null);
      this.pendingNormalKeyCode = 0;
      this.pendingNormalKeyRelease = false;
      this.pendingNavigationKeyCode = 0;
      this.totalSteps = 0;
      this.startTime = performance.now();
    }

    writeIo(channel, value){
      // Channel 015 zero is the physical KEY RESET/release state, not a new
      // key event. ringbuffer_api would raise KEYRUPT1 for a zero packet too,
      // so intercept it and clear the input register directly instead.
      if ((channel|0) === NORMAL_KEY_CHANNEL && ((value|0) & NORMAL_KEY_MASK) === 0) {
        return this.keyRelease() ? 1 : 0;
      }
      return this.exports.packet_write(channel, value);
    }

    inputChannelWordIndex(channel){
      if (!this.memory || !this.exports || typeof this.exports.get_erasable_ptr !== 'function') return -1;
      const ch = channel|0;
      if (ch < 0 || ch >= 512) return -1;
      const erasable = this.exports.get_erasable_ptr() >>> 0;
      const byteAddress = erasable + ERASABLE_TO_INPUT_CHANNELS + ch * 2;
      if (byteAddress + 1 >= this.memory.buffer.byteLength) return -1;
      return byteAddress >>> 1;
    }

    inputChannelBits(channel, mask=0o77777){
      const index = this.inputChannelWordIndex(channel);
      if (index < 0) return null;
      return new Uint16Array(this.memory.buffer)[index] & (mask & 0o77777);
    }

    setInputChannelBits(channel, mask, value){
      const index = this.inputChannelWordIndex(channel);
      if (index < 0) return false;
      const words = new Uint16Array(this.memory.buffer);
      const m = mask & 0o77777;
      words[index] = ((words[index] & ~m) | (value & m)) & 0xffff;
      return true;
    }

    keyPress(keyCode){
      const code = keyCode & NORMAL_KEY_MASK;
      if (!code) return 0;
      let accepted = this.writeIo(NORMAL_KEY_CHANNEL, code);
      if (accepted === 0 && this.exports && typeof this.exports.cpu_step === 'function') {
        this.advanceOneMct();
        accepted = this.writeIo(NORMAL_KEY_CHANNEL, code);
      }
      if (accepted > 0) this.pendingNormalKeyCode = code;
      return accepted;
    }

    keyRelease(){
      // KEY RESET is a separate DSKY discrete.  Do NOT send channel 015=0
      // through ringbuffer_api: that transport raises KEYRUPT1 for every
      // channel-015 packet, including zero, which would create a fictitious
      // second keystroke on physical release.
      //
      // Normally the 4-ms scheduler has already consumed the make packet long
      // before a human releases the key. If it is still behind queued input,
      // defer KEYRST until a later CPU step delivers the make; clearing channel
      // 015 early would let that delayed packet reassert a stuck key.
      const pending = this.pendingNormalKeyCode & NORMAL_KEY_MASK;
      if (pending && this.inputChannelBits(NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK) !== pending
          && this.exports && typeof this.exports.cpu_step === 'function') {
        this.pendingNormalKeyRelease = true;
        this.advanceOneMct();
        if (this.pendingNormalKeyCode) return true;
      }
      this.pendingNormalKeyCode = 0;
      this.pendingNormalKeyRelease = false;
      return this.setInputChannelBits(NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK, 0);
    }

    settlePendingNormalKey(){
      const pending = this.pendingNormalKeyCode & NORMAL_KEY_MASK;
      if (!pending || this.inputChannelBits(NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK) !== pending) return;
      this.pendingNormalKeyCode = 0;
      if (this.pendingNormalKeyRelease) {
        this.setInputChannelBits(NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK, 0);
        this.pendingNormalKeyRelease = false;
      }
    }

    advanceOneMct(){
      this.exports.cpu_step(1);
      this.totalSteps += 1;
      this.drainIo();
      this.settlePendingNormalKey();
    }

    flushPendingNormalKeyForSnapshot(){
      if (!this.pendingNormalKeyCode) return true;
      if (!this.pendingNormalKeyRelease) {
        throw new Error('cannot snapshot while a DSKY key make is still electrically held');
      }
      for (let i = 0; i < INPUT_RING_MCT_FLUSH_LIMIT && this.pendingNormalKeyCode; i++) {
        this.advanceOneMct();
      }
      if (this.pendingNormalKeyCode) {
        throw new Error('queued DSKY key did not reach channel 015 before snapshot');
      }
      return true;
    }

    releaseExternalDskyInputs(){
      // Physical controls are not persistent AGC state.  A restored snapshot
      // must come back with the normal keyboard released and PRO released.
      this.pendingNormalKeyCode = 0;
      this.pendingNormalKeyRelease = false;
      this.pendingNavigationKeyCode = 0;
      const keyOk = this.setInputChannelBits(NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK, 0);
      const navKeyOk = this.setInputChannelBits(0o16, 0o177, 0);
      const proOk = this.setInputChannelBits(PROCEED_CHANNEL, PROCEED_MASK, PROCEED_MASK);
      return keyOk && navKeyOk && proOk;
    }

    proceedKey(pressed){
      // PRO is electrically active-low: 0 means held, 020000 means released.
      const value = pressed ? 0 : PROCEED_MASK;
      const accepted = this.writeIo(PROCEED_CHANNEL, value);
      if (accepted !== 0 || !this.exports || typeof this.exports.cpu_step !== 'function') {
        return accepted;
      }

      // A full yaAGC input ring rejects a packet with 0. A PRO level change
      // cannot be dropped: advance one MCT to let ChannelInput consume at
      // least one queued packet, then retry in FIFO order. This is only used
      // under backpressure, so ordinary PRO transitions do not change timing.
      this.advanceOneMct();
      return this.writeIo(PROCEED_CHANNEL, value);
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
      const code = value & 0o177;
      if (!code || this.pendingNavigationKeyCode) return false;
      let accepted = this.writeIo(0o16, code);
      if (accepted === 0) {
        this.advanceOneMct();
        accepted = this.writeIo(0o16, code);
      }
      if (!(accepted > 0)) return false;
      this.pendingNavigationKeyCode = code;

      // The channel-016 packet is asynchronous. A single MCT does not guarantee
      // delivery when earlier unprogrammed-counter packets occupy the ring, so
      // wait for NAVKEYIN itself before asserting the peripheral's KEYRUPT2.
      if (!this.waitForInputChannelBits(0o16, 0o177, code)) {
        this.navKeyRelease();
        return false;
      }

      // The pinned ring-buffer transport omits this hardware edge; provide it
      // only after the real channel-016 make has reached NAVKEYIN.

      // ABI of the pinned yaAGC agc_t following Erasable: Fixed, Parities,
      // InputChannel, OutputChannel7, OutputChannel10, IndexValue, then
      // InterruptRequests[]. KEYRUPT1 is request 5; KEYRUPT2 is request 6.
      const ERASABLE_TO_INTERRUPT_REQUESTS = 92196;
      const erasable = this.exports.get_erasable_ptr() >>> 0;
      const addr = erasable + ERASABLE_TO_INTERRUPT_REQUESTS + 6;
      const bytes = new Uint8Array(this.memory.buffer);
      if (addr >= bytes.length) {
        this.navKeyRelease();
        return false;
      }
      bytes[addr] = 1;
      return true;
    }

    navKeyRelease(){
      const pending = this.pendingNavigationKeyCode & 0o177;
      if (!pending && this.inputChannelBits(0o16, 0o177) === 0) return true;
      if (pending && !this.waitForInputChannelBits(0o16, 0o177, pending)) return false;
      let accepted = this.writeIo(0o16, 0);
      if (accepted === 0) {
        this.advanceOneMct();
        accepted = this.writeIo(0o16, 0);
      }
      if (!(accepted > 0) || !this.waitForInputChannelBits(0o16, 0o177, 0)) return false;
      this.pendingNavigationKeyCode = 0;
      return true;
    }

    waitForInputChannelBits(channel, mask, value){
      for (let i = 0; i < INPUT_RING_MCT_FLUSH_LIMIT; i++) {
        if (this.inputChannelBits(channel, mask) === value) return true;
        this.advanceOneMct();
      }
      return this.inputChannelBits(channel, mask) === value;
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
      if (snapshot.fingerprint) {
        let h = 0x811c9dc5;
        for (let i=0; i<binary.length; i++) {
          h ^= binary.charCodeAt(i) & 0xff;
          h = Math.imul(h, 0x01000193) >>> 0;
        }
        if (h.toString(16).padStart(8,'0') !== snapshot.fingerprint) {
          throw new Error('AGC snapshot fingerprint mismatch');
        }
      }
      this.stop();
      for (let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
      this.releaseExternalDskyInputs();
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
      this.settlePendingNormalKey();
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
