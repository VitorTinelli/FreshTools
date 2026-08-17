const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const { webcrypto } = require("node:crypto");

function loadUploader(fetch) {
  const context = {
    AbortController,
    Blob,
    DOMException,
    FormData,
    Promise,
    Uint8Array,
    crypto: webcrypto,
    fetch,
    globalThis: null,
    setTimeout,
    clearTimeout
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("Chromium/vocaroo-upload.js", "utf8"), context);
  return context.FreshToolsVocaroo;
}

test("uploads in Vocaroo-sized chunks and returns the share URL", async () => {
  const requests = [];
  const progress = [];
  const phases = [];
  const fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || "GET", body: options.body });
    if (url.endsWith("/alive")) return { ok: true, status: 200 };
    if (url.endsWith("/finalize")) {
      return { ok: true, status: 200, json: async () => ({ status: 0, mediaId: "abcdefghij", ownerToken: "owner" }) };
    }
    if (url.includes("/upload/status/")) {
      return { ok: true, status: 200, json: async () => ({ status: 1 }) };
    }
    return { ok: true, status: 200 };
  };
  const uploader = loadUploader(fetch);
  const blob = new Blob([new Uint8Array(250001)], { type: "audio/ogg" });
  const url = await uploader.upload(blob, {
    onProgress: (uploaded, total) => progress.push({ uploaded, total }),
    onPhase: (phase) => phases.push(phase)
  });

  assert.equal(url, "https://voca.ro/abcdefghij");
  const chunkRequests = requests.filter(({ url: requestUrl }) => requestUrl.includes("/chunk/"));
  assert.equal(chunkRequests.length, 3);
  assert.deepEqual(chunkRequests.map(({ url: requestUrl }) => Number(requestUrl.split("/").at(-1))).sort(), [0, 1, 2]);
  assert.equal(progress.at(-1).uploaded, blob.size);
  assert.equal(progress.at(-1).total, blob.size);
  assert.deepEqual(phases, ["connecting", "uploading", "processing", "ready"]);
});

test("rejects an audio that Vocaroo cannot process", async () => {
  const fetch = async (url) => {
    if (url.endsWith("/alive")) return { ok: true, status: 200 };
    if (url.endsWith("/finalize")) {
      return { ok: true, status: 200, json: async () => ({ status: 0, mediaId: "abcdefghij", ownerToken: "owner" }) };
    }
    if (url.includes("/upload/status/")) {
      return { ok: true, status: 200, json: async () => ({ status: 2 }) };
    }
    return { ok: true, status: 200 };
  };
  await assert.rejects(
    loadUploader(fetch).upload(new Blob([new Uint8Array([1])], { type: "audio/ogg" })),
    /não conseguiu processar/
  );
});

test("returns the finalized link when the optional status endpoint fails", async () => {
  const fetch = async (url) => {
    if (url.endsWith("/alive")) return { ok: true, status: 200 };
    if (url.endsWith("/finalize")) {
      return { ok: true, status: 200, json: async () => ({ status: 0, mediaId: "statusfails", ownerToken: "owner" }) };
    }
    if (url.includes("/upload/status/")) return { ok: false, status: 500 };
    return { ok: true, status: 200 };
  };

  const url = await loadUploader(fetch).upload(
    new Blob([new Uint8Array([1])], { type: "audio/ogg" })
  );
  assert.equal(url, "https://voca.ro/statusfails");
});

test("rejects video blobs before contacting Vocaroo", async () => {
  let contacted = false;
  const uploader = loadUploader(async () => {
    contacted = true;
    throw new Error("fetch should not run");
  });

  await assert.rejects(
    uploader.upload(new Blob([new Uint8Array([1])], { type: "video/mp4" })),
    /Formatos de vídeo/
  );
  assert.equal(contacted, false);
});
