const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadPipeline(fetch, upload = async () => "https://voca.ro/result") {
  const context = { AbortController, Blob, DOMException, Promise, Response, URL, fetch,
    FreshToolsVocaroo: { upload }, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("src/common/background/audio-pipeline.js", "utf8"), context);
  return context.FreshToolsAudioPipeline;
}

test("shared pipeline downloads a direct audio URL with credentials and redirects", async () => {
  let options;
  const pipeline = loadPipeline(async (_url, value) => {
    options = value;
    return new Response(new Uint8Array([1, 2]), { status: 200, headers: { "content-type": "audio/ogg" } });
  });
  assert.equal((await pipeline.downloadAudio("https://bucket.test/audio.ogg")).size, 2);
  assert.equal(options.credentials, "include");
  assert.equal(options.redirect, "follow");
});

test("shared pipeline resolves Freshchat JSON before downloading", async () => {
  const urls = [];
  const pipeline = loadPipeline(async (url) => {
    urls.push(url);
    if (urls.length === 1) return new Response(JSON.stringify({ signed_url: "https://bucket.test/audio.ogg" }), { headers: { "content-type": "application/json" } });
    return new Response(new Uint8Array([3]), { headers: { "content-type": "audio/ogg" } });
  });
  assert.equal((await pipeline.downloadAudio("https://freshchat.test/file/download?id=1")).size, 1);
  assert.deepEqual(urls, ["https://freshchat.test/file/download?id=1", "https://bucket.test/audio.ogg"]);
});

test("shared pipeline distinguishes HTTP and network failures", async () => {
  const http = loadPipeline(async () => new Response("no", { status: 503 }));
  await assert.rejects(http.downloadAudio("https://bucket.test/a.ogg"), (error) => error.code === "http");
  const network = loadPipeline(async () => { throw new TypeError("failed to fetch"); });
  await assert.rejects(network.downloadAudio("https://bucket.test/a.ogg"), (error) => error.code === "network");
});

test("shared pipeline rejects empty, video and oversized files", async () => {
  const empty = loadPipeline(async () => new Response(new Uint8Array(), { headers: { "content-type": "audio/ogg" } }));
  await assert.rejects(empty.downloadAudio("https://bucket.test/a.ogg"), /vazio/);
  const video = loadPipeline(async () => new Response(new Uint8Array([1]), { headers: { "content-type": "video/mp4" } }));
  await assert.rejects(video.downloadAudio("https://bucket.test/a.mp4"), /vídeo/);
  const large = loadPipeline(async () => new Response(new Uint8Array([1]), { headers: { "content-type": "audio/ogg", "content-length": String(25 * 1024 * 1024 + 1) } }));
  await assert.rejects(large.downloadAudio("https://bucket.test/a.ogg"), /25 MB/);
});

test("shared pipeline supports cancellation during download", async () => {
  const controller = new AbortController();
  const pipeline = loadPipeline((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const result = pipeline.downloadAudio("https://bucket.test/a.ogg", { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, (error) => error.name === "AbortError");
});

test("shared pipeline supports cancellation during upload", async () => {
  const controller = new AbortController();
  const pipeline = loadPipeline(
    async () => new Response(new Uint8Array([1]), { headers: { "content-type": "audio/ogg" } }),
    (_blob, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))
  );
  const result = pipeline.downloadAndUpload("https://bucket.test/a.ogg", { signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(result, (error) => error.name === "AbortError");
});
