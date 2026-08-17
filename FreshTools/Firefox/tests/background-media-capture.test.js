const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

test("captures a Firefox media response and uploads it to Vocaroo", async () => {
  const requestListeners = [];
  const messages = [];
  let runtimeListener;
  let filter;
  const context = {
    AbortController,
    Blob,
    DOMException,
    Promise,
    Response,
    URL,
    XMLHttpRequest: class {},
    globalThis: null,
    setTimeout,
    clearTimeout,
    FreshToolsVocaroo: {
      async upload(blob, { onPhase, onProgress }) {
        assert.deepEqual(Array.from(new Uint8Array(await blob.arrayBuffer())), [1, 2, 3]);
        onPhase("connecting");
        onProgress(blob.size, blob.size);
        return "https://voca.ro/firefox";
      }
    },
    browser: {
      runtime: { onMessage: { addListener(listener) { runtimeListener = listener; } } },
      tabs: { async sendMessage(_tabId, message) { messages.push(message); } },
      webRequest: {
        filterResponseData() {
          filter = { write() {}, close() {}, disconnect() {} };
          return filter;
        },
        onBeforeRequest: { addListener(listener) { requestListeners.push(listener); } },
        onHeadersReceived: { addListener() {} }
      }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("Firefox/background.js", "utf8"), context);

  const url = "https://fc-use1-00-files-bkt-00.s3.amazonaws.com/audio.ogg?signature=1";
  const armed = await runtimeListener(
    { type: "ft-capture-audio-response", id: "firefox-audio", url },
    { tab: { id: 7 } }
  );
  assert.equal(armed.started, true);

  // Uma URL assinada diferente pode apontar a outro objeto; ela não deve ser
  // confundida com a requisição preparada para este upload.
  for (const listener of requestListeners) {
    listener({ tabId: 7, requestId: "wrong-request", method: "GET", url: `${url}&other=1` });
  }
  assert.equal(filter, undefined);

  for (const listener of requestListeners) {
    listener({ tabId: 7, requestId: "request-1", method: "GET", url });
  }
  assert(filter);
  filter.ondata({ data: new Uint8Array([1, 2, 3]).buffer });
  filter.onstop();

  for (let attempt = 0; attempt < 50 && !messages.some((message) =>
    message.type === "ft-audio-vocaroo-ready"); attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert(messages.some((message) =>
    message.type === "ft-audio-vocaroo-progress" && message.phase === "downloading"));
  assert.equal(
    messages.find((message) => message.type === "ft-audio-vocaroo-ready")?.url,
    "https://voca.ro/firefox"
  );
});

test("downloads a customer audio directly instead of waiting for the media player", async () => {
  const messages = [];
  let runtimeListener;
  const requests = [];
  const context = {
    AbortController, Blob, DOMException, Promise, Response, URL,
    fetch: async (url) => {
      requests.push(url);
      if (url.includes("/file/download")) {
        return new Response(JSON.stringify({ file_url: "https://bucket.amazonaws.com/customer.ogg" }), {
          status: 200, headers: { "content-type": "application/json" }
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200, headers: { "content-type": "audio/ogg" }
      });
    },
    globalThis: null,
    setTimeout, clearTimeout,
    FreshToolsVocaroo: { async upload() { return "https://voca.ro/customer"; } },
    browser: {
      runtime: { onMessage: { addListener(listener) { runtimeListener = listener; } } },
      tabs: { async sendMessage(_tabId, message) { messages.push(message); } },
      webRequest: {
        onBeforeRequest: { addListener() {} },
        onHeadersReceived: { addListener() {} }
      }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("Firefox/background.js", "utf8"), context);

  const started = await runtimeListener({
    type: "ft-upload-audio-url", id: "direct-audio",
    url: "https://account.freshchat.com/crm/messaging/app/public/file/download?id=1"
  }, { tab: { id: 7 } });
  assert.equal(started.started, true);
  for (let attempt = 0; attempt < 50 && !messages.some((message) =>
    message.type === "ft-audio-vocaroo-ready"); attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(messages.find((message) => message.type === "ft-audio-vocaroo-ready")?.url,
    "https://voca.ro/customer");
  assert.deepEqual(requests, [
    "https://account.freshchat.com/crm/messaging/app/public/file/download?id=1",
    "https://bucket.amazonaws.com/customer.ogg"
  ]);
});

test("falls back to the page media capture when Firefox blocks the direct download", async () => {
  const messages = [];
  let runtimeListener;
  const context = {
    AbortController, Blob, DOMException, Promise, Response, URL,
    fetch: async () => { throw new TypeError("NetworkError when attempting to fetch resource."); },
    globalThis: null,
    setTimeout, clearTimeout,
    FreshToolsVocaroo: { async upload() { throw new Error("must not upload"); } },
    browser: {
      runtime: { onMessage: { addListener(listener) { runtimeListener = listener; } } },
      tabs: { async sendMessage(_tabId, message) { messages.push(message); } },
      webRequest: {
        onBeforeRequest: { addListener() {} },
        onHeadersReceived: { addListener() {} }
      }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("Firefox/background.js", "utf8"), context);
  await runtimeListener({
    type: "ft-upload-audio-url", id: "network-fallback", url: "https://bucket.amazonaws.com/audio.ogg"
  }, { tab: { id: 7 } });
  for (let attempt = 0; attempt < 50 && !messages.some((message) =>
    message.type === "ft-audio-vocaroo-fallback-capture"); attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(messages.some((message) => message.type === "ft-audio-vocaroo-fallback-capture"), JSON.stringify(messages));
  const fallback = messages.find((message) => message.type === "ft-audio-vocaroo-fallback-capture");
  assert.equal(fallback.id, "network-fallback");
  assert.equal(fallback.url, "https://bucket.amazonaws.com/audio.ogg");
});
