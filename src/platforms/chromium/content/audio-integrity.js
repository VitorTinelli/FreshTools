(() => {
  "use strict";

  function u16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function u32(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function u64(bytes, offset) {
    let value = 0n;
    for (let index = 7; index >= 0; index -= 1) {
      value = (value << 8n) | BigInt(bytes[offset + index]);
    }
    return value;
  }

  async function inspectOgg(blob, expectedFrames, inputSampleRate) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let offset = 0;
    let serial = null;
    let previousSequence = null;
    let lastGranule = null;
    let preSkip = 0;
    let firstPacket = new Uint8Array(0);
    let sawEndOfStream = false;

    while (offset < bytes.length) {
      if (offset + 27 > bytes.length || String.fromCharCode(...bytes.subarray(offset, offset + 4)) !== "OggS") {
        throw new Error("O áudio OGG possui uma página inválida.");
      }
      const headerType = bytes[offset + 5];
      const granule = u64(bytes, offset + 6);
      const pageSerial = u32(bytes, offset + 14);
      const pageSequence = u32(bytes, offset + 18);
      const segmentCount = bytes[offset + 26];
      const headerLength = 27 + segmentCount;
      if (offset + headerLength > bytes.length) throw new Error("Cabeçalho OGG incompleto.");
      const bodyLength = bytes.subarray(offset + 27, offset + headerLength)
        .reduce((sum, value) => sum + value, 0);
      if (offset + headerLength + bodyLength > bytes.length) throw new Error("Página OGG incompleta.");
      if (serial === null) serial = pageSerial;
      if (pageSerial !== serial) throw new Error("O áudio OGG contém mais de uma trilha.");
      if (previousSequence !== null && pageSequence !== previousSequence + 1) {
        throw new Error("O áudio OGG contém uma página fora de ordem.");
      }
      previousSequence = pageSequence;
      lastGranule = granule;

      let bodyOffset = offset + headerLength;
      for (let index = 0; index < segmentCount; index += 1) {
        const segmentLength = bytes[offset + 27 + index];
        const segment = bytes.subarray(bodyOffset, bodyOffset + segmentLength);
        if (firstPacket.length < 19) {
          const merged = new Uint8Array(Math.min(19, firstPacket.length + segment.length));
          merged.set(firstPacket);
          merged.set(segment.subarray(0, merged.length - firstPacket.length), firstPacket.length);
          firstPacket = merged;
          if (firstPacket.length === 19 && String.fromCharCode(...firstPacket.subarray(0, 8)) === "OpusHead") {
            preSkip = u16(firstPacket, 10);
          }
        }
        bodyOffset += segmentLength;
      }
      offset += headerLength + bodyLength;
      if (headerType & 4) sawEndOfStream = true;
    }

    if (!sawEndOfStream || !lastGranule || firstPacket.length < 19 ||
        String.fromCharCode(...firstPacket.subarray(0, 8)) !== "OpusHead") {
      throw new Error("O áudio OGG não foi finalizado corretamente.");
    }
    const playableFrames = lastGranule - BigInt(preSkip);
    if (playableFrames <= 0n) throw new Error("O áudio OGG não contém duração válida.");
    const encodedSeconds = Number(playableFrames) / 48000;
    const expectedSeconds = expectedFrames / inputSampleRate;
    const tolerance = Math.max(0.2, expectedSeconds * 0.03 + 0.1);
    if (Math.abs(encodedSeconds - expectedSeconds) > tolerance) {
      throw new Error("A duração codificada divergiu da captura; o áudio não foi anexado.");
    }
    return { encodedSeconds, expectedSeconds, bytes: bytes.length, preSkip };
  }

  globalThis.FreshToolsAudioIntegrity = { inspectOgg };
})();
