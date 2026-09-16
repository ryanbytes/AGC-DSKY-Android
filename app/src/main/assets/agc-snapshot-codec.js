'use strict';

// Preserve the existing schema while encoding/decoding the WebAssembly image in
// bounded chunks. This keeps snapshot transport separate from app persistence.
(() => {
  const Core = window.AgcCore;
  if (!Core || !Core.prototype || Core.prototype.__chunkedSnapshotCodec) return;
  const ENCODE_BYTES = 0x6000; // 24 KiB, divisible by 3.
  const DECODE_CHARS = 0x8000; // 32 KiB base64, divisible by 4.

  Core.prototype.exportSnapshot = function() {
    if (!this.memory) throw new Error('AGC core not loaded');
    const bytes = new Uint8Array(this.memory.buffer);
    const pieces = [];
    for (let i = 0; i < bytes.length; i += ENCODE_BYTES) {
      const part = bytes.subarray(i, Math.min(bytes.length, i + ENCODE_BYTES));
      let binary = '';
      for (let j = 0; j < part.length; j += 0x1000) {
        const block = part.subarray(j, Math.min(part.length, j + 0x1000));
        binary += String.fromCharCode.apply(null, block);
      }
      pieces.push(btoa(binary));
    }
    return {
      schema: 1,
      byteLength: bytes.length,
      fingerprint: this.snapshotFingerprint(),
      memoryB64: pieces.join('')
    };
  };

  Core.prototype.importSnapshot = function(snapshot) {
    if (!this.memory) throw new Error('AGC core not loaded');
    if (!snapshot || snapshot.schema !== 1 || typeof snapshot.memoryB64 !== 'string') {
      throw new Error('Unsupported AGC snapshot');
    }
    const bytes = new Uint8Array(this.memory.buffer);
    if (snapshot.byteLength !== bytes.length) {
      throw new Error('AGC snapshot memory size mismatch');
    }
    const encoded = snapshot.memoryB64;
    const expectedChars = 4 * Math.ceil(bytes.length / 3);
    if (encoded.length !== expectedChars
        || (encoded.length & 3) !== 0
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      throw new Error('AGC snapshot base64 size/format mismatch');
    }

    this.stop();
    let offset = 0;
    for (let i = 0; i < encoded.length; i += DECODE_CHARS) {
      const binary = atob(encoded.slice(i, Math.min(encoded.length, i + DECODE_CHARS)));
      if (offset + binary.length > bytes.length) {
        throw new Error('AGC snapshot decoded length overflow');
      }
      for (let j = 0; j < binary.length; j++) {
        bytes[offset++] = binary.charCodeAt(j) & 0xff;
      }
    }
    if (offset !== bytes.length) {
      throw new Error('AGC snapshot decoded length mismatch');
    }
    if (snapshot.fingerprint && this.snapshotFingerprint() !== snapshot.fingerprint) {
      throw new Error('AGC snapshot fingerprint mismatch');
    }
    this.channels = Object.create(null);
    this.totalSteps = 0;
    this.startTime = performance.now();
    return true;
  };

  Object.defineProperty(Core.prototype, '__chunkedSnapshotCodec', {
    value: true,
    enumerable: false
  });
})();
