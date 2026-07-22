"use strict";

const BATCH_FRAMES = 4096;

class FreshToolsCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.closed = false;
    this.sequence = 0;
    this.totalFrames = 0;
    this.buffer = new Float32Array(BATCH_FRAMES);
    this.offset = 0;
    this.port.onmessage = ({ data }) => {
      if (data?.command === "resume") {
        this.active = true;
      } else if (data?.command === "pause") {
        this.active = false;
        this.flush();
        this.port.postMessage({ type: "paused", totalFrames: this.totalFrames });
      } else if (data?.command === "stop") {
        this.active = false;
        this.closed = true;
        this.flush();
        this.port.postMessage({ type: "stopped", totalFrames: this.totalFrames });
      }
    };
  }

  flush() {
    if (!this.offset) return;
    const samples = this.buffer.slice(0, this.offset);
    const frameCount = samples.length;
    this.port.postMessage({
      type: "audio",
      sequence: this.sequence,
      firstFrame: this.totalFrames - frameCount,
      frameCount,
      sampleRate,
      samples
    }, [samples.buffer]);
    this.sequence += 1;
    this.offset = 0;
  }

  process(inputs) {
    if (this.closed) return false;
    if (!this.active) return true;
    const input = inputs[0]?.[0];
    if (!input?.length) {
      this.port.postMessage({ type: "discontinuity", reason: "missing-input" });
      return true;
    }

    let sourceOffset = 0;
    while (sourceOffset < input.length) {
      const count = Math.min(input.length - sourceOffset, this.buffer.length - this.offset);
      this.buffer.set(input.subarray(sourceOffset, sourceOffset + count), this.offset);
      this.offset += count;
      sourceOffset += count;
      this.totalFrames += count;
      if (this.offset === this.buffer.length) this.flush();
    }
    return true;
  }
}

registerProcessor("freshtools-capture", FreshToolsCaptureProcessor);
