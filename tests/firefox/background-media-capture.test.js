const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadBackground({ fetch, upload }) {
  const messages = [];
  let runtimeListener, requestListener, requestFilter;
  const context = {
    AbortController, Blob, DOMException, Promise, Response, URL, fetch,
    globalThis: null, setTimeout, clearTimeout, FreshToolsVocaroo: { upload },
    browser: {
      runtime: { onMessage: { addListener(listener) { runtimeListener = listener; } } },
      tabs: { async sendMessage(_tabId, message) { messages.push(message); } },
      webRequest: { onBeforeRequest: { addListener(listener, filter) { requestListener = listener; requestFilter = filter; } } }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("src/common/background/audio-pipeline.js", "utf8"), context);
  vm.runInNewContext(fs.readFileSync("src/platforms/firefox/background/index.js", "utf8"), context);
  return { messages, requestFilter, requestListener, runtimeListener };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = predicate();
    if (result) return result;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("Mensagem de conclusão não recebida.");
}

test("Firefox captures the URL and invokes the shared flow once", async () => {
  let uploads = 0;
  const background = loadBackground({
    fetch: async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/ogg" } }),
    upload: async () => { uploads += 1; return "https://voca.ro/firefox"; }
  });
  const armed = await background.runtimeListener(
    { type: "ft-arm-audio-download", id: "firefox-audio", action: "vocaroo" }, { tab: { id: 7 } }
  );
  assert.equal(armed.armed, true);
  assert.deepEqual(Array.from(background.requestFilter.types), ["main_frame", "sub_frame", "xmlhttprequest", "media", "other"]);
  assert.equal(Object.keys(background.requestListener({ tabId: 8, url: "https://freshchat.test/file/download?id=wrong" })).length, 0);
  assert.equal(background.requestListener({ tabId: 7, url: "https://freshchat.test/file/download?id=1" }).cancel, true);
  const ready = await waitFor(() => background.messages.find((message) => message.type === "ft-audio-vocaroo-ready"));
  assert.equal(ready.url, "https://voca.ro/firefox");
  assert.equal(uploads, 1);
});

test("Firefox resolves Freshchat JSON with the shared pipeline", async () => {
  const requests = [];
  const background = loadBackground({
    fetch: async (url) => {
      requests.push(url);
      if (requests.length === 1) return new Response(JSON.stringify({ file_url: "https://bucket.test/audio.ogg" }), { headers: { "content-type": "application/json" } });
      return new Response(new Uint8Array([1]), { headers: { "content-type": "audio/ogg" } });
    },
    upload: async () => "https://voca.ro/json"
  });
  const started = await background.runtimeListener({
    type: "ft-upload-audio-url", id: "json-audio", url: "https://freshchat.test/file/download?id=2"
  }, { tab: { id: 7 } });
  assert.equal(started.started, true);
  await waitFor(() => background.messages.some((message) => message.type === "ft-audio-vocaroo-ready"));
  assert.deepEqual(requests, ["https://freshchat.test/file/download?id=2", "https://bucket.test/audio.ogg"]);
});

test("Firefox reports network failure without a browser-specific fallback", async () => {
  const background = loadBackground({
    fetch: async () => { throw new TypeError("NetworkError"); },
    upload: async () => { throw new Error("must not upload"); }
  });
  await background.runtimeListener({
    type: "ft-upload-audio-url", id: "network-error", url: "https://bucket.test/audio.ogg"
  }, { tab: { id: 7 } });
  const error = await waitFor(() => background.messages.find((message) => message.type === "ft-audio-vocaroo-error"));
  assert.match(error.error, /Falha de rede/);
  assert.equal(background.messages.some((message) => message.type === "ft-audio-vocaroo-fallback-capture"), false);
});
