const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

const context = {
  Blob,
  BigInt,
  Uint8Array,
  String,
  Math,
  Date,
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("Chromium/audio-integrity.js", "utf8"), context);

function page(type, granule, sequence, body) {
  const header = new Uint8Array(28);
  header.set([79, 103, 103, 83, 0, type]);
  let value = BigInt(granule);
  for (let index = 0; index < 8; index += 1) {
    header[6 + index] = Number(value & 255n);
    value >>= 8n;
  }
  header[14] = 1;
  header[18] = sequence;
  header[26] = 1;
  header[27] = body.length;
  return new Uint8Array([...header, ...body]);
}

function fixture(finalGranule = 48312, secondSequence = 1) {
  const head = new Uint8Array(19);
  head.set([...Buffer.from("OpusHead"), 1, 1, 56, 1, 128, 187, 0, 0, 0, 0, 0]);
  return new Blob([
    page(0, 0, 0, head),
    page(4, finalGranule, secondSequence, new Uint8Array([0]))
  ], { type: "audio/ogg" });
}

test("accepts a structurally valid OGG with matching duration", async () => {
  const result = await context.FreshToolsAudioIntegrity.inspectOgg(fixture(), 48000, 48000);
  assert.equal(result.encodedSeconds, 1);
  assert.equal(result.preSkip, 312);
});

test("rejects a page sequence gap", async () => {
  await assert.rejects(
    context.FreshToolsAudioIntegrity.inspectOgg(fixture(48312, 3), 48000, 48000),
    /fora de ordem/
  );
});

test("rejects a duration mismatch", async () => {
  await assert.rejects(
    context.FreshToolsAudioIntegrity.inspectOgg(fixture(96312), 48000, 48000),
    /duração codificada/
  );
});
