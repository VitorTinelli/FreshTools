const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadBackground({ fetch, upload }) {
  const messages = [];
  let runtimeListener;
  let requestListener;
  const context = {
    AbortController,
    Blob,
    DOMException,
    Promise,
    URL,
    fetch,
    globalThis: null,
    importScripts() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    FreshToolsVocaroo: { upload },
    chrome: {
      declarativeNetRequest: {
        updateSessionRules: async () => {},
        onRuleMatchedDebug: { addListener() {} }
      },
      runtime: {
        onMessage: { addListener(listener) { runtimeListener = listener; } }
      },
      tabs: {
        async sendMessage(_tabId, message) { messages.push(message); }
      },
      webRequest: {
        onBeforeRequest: { addListener(listener) { requestListener = listener; } }
      }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("Chromium/background.js", "utf8"), context);
  return { messages, requestListener, runtimeListener };
}

function arm(runtimeListener, message) {
  return new Promise((resolve) => {
    runtimeListener(message, { tab: { id: 7 } }, resolve);
  });
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = predicate();
    if (result) return result;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("Mensagem de conclusão não recebida.");
}

test("downloads an existing conversation audio and uploads it to Vocaroo", async () => {
  const downloaded = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/ogg" });
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    if (url.includes("/file/download?")) {
      return new Response(JSON.stringify({ file_url: "https://bucket.amazonaws.com/audio.ogg" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(downloaded, {
      status: 200,
      headers: { "content-type": "audio/ogg", "content-length": String(downloaded.size) }
    });
  };
  const background = loadBackground({
    fetch,
    upload: async (blob, { onPhase, onProgress }) => {
      assert.equal(blob.size, downloaded.size);
      onPhase("connecting");
      onProgress(blob.size, blob.size);
      onPhase("processing");
      return "https://voca.ro/testaudio";
    }
  });

  const armed = await arm(background.runtimeListener, {
    type: "ft-arm-audio-download", id: "audio-1", action: "vocaroo"
  });
  assert.equal(armed.armed, true);
  background.requestListener({
    tabId: 7,
    url: "https://account.freshchat.com/crm/messaging/app/public/file/download?id=1"
  });

  const ready = await waitFor(() => background.messages.find(
    (message) => message.type === "ft-audio-vocaroo-ready"
  ));
  assert.equal(ready.url, "https://voca.ro/testaudio");
  assert.deepEqual(requests, [
    "https://account.freshchat.com/crm/messaging/app/public/file/download?id=1",
    "https://bucket.amazonaws.com/audio.ogg"
  ]);
  assert(background.messages.some((message) =>
    message.type === "ft-audio-vocaroo-progress" && message.phase === "downloading"));
  assert(background.messages.some((message) =>
    message.type === "ft-audio-vocaroo-progress" && message.percent === 100));
});

test("cancels an upload of an existing conversation audio", async () => {
  const background = loadBackground({
    fetch: async () => new Response(new Uint8Array([1]), {
      status: 200,
      headers: { "content-type": "audio/ogg" }
    }),
    upload: (_blob, { signal, onPhase }) => new Promise((_resolve, reject) => {
      onPhase("connecting");
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })
  });

  await arm(background.runtimeListener, {
    type: "ft-arm-audio-download", id: "audio-2", action: "vocaroo"
  });
  background.requestListener({
    tabId: 7,
    url: "https://account.freshchat.com/crm/messaging/app/public/file/download?id=2"
  });
  await waitFor(() => background.messages.find(
    (message) => message.type === "ft-audio-vocaroo-progress" && message.phase === "connecting"
  ));

  let cancellation;
  background.runtimeListener(
    { type: "ft-cancel-audio-vocaroo", id: "audio-2" },
    { tab: { id: 7 } },
    (response) => { cancellation = response; }
  );
  assert.equal(cancellation.cancelled, true);
  const error = await waitFor(() => background.messages.find(
    (message) => message.type === "ft-audio-vocaroo-error"
  ));
  assert.equal(error.cancelled, true);
});

test("uploads the direct URL used by a native customer audio player", async () => {
  const requestedUrls = [];
  const background = loadBackground({
    fetch: async (url) => {
      requestedUrls.push(url);
      return new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: { "content-type": "audio/ogg" }
      });
    },
    upload: async () => "https://voca.ro/customer"
  });

  let response;
  background.runtimeListener(
    {
      type: "ft-upload-audio-url",
      id: "customer-audio",
      url: "https://fc-use1-00-files-bkt-00.s3.amazonaws.com/customer.ogg"
    },
    { tab: { id: 7 } },
    (result) => { response = result; }
  );
  assert.equal(response.started, true);

  const ready = await waitFor(() => background.messages.find(
    (message) => message.type === "ft-audio-vocaroo-ready"
  ));
  assert.equal(ready.url, "https://voca.ro/customer");
  assert.deepEqual(requestedUrls, [
    "https://fc-use1-00-files-bkt-00.s3.amazonaws.com/customer.ogg"
  ]);
});

test("rejects a video URL without sending it to Vocaroo", async () => {
  let uploaded = false;
  const background = loadBackground({
    fetch: async () => new Response(new Uint8Array([1, 2]), {
      status: 200,
      headers: { "content-type": "video/mp4" }
    }),
    upload: async () => {
      uploaded = true;
      return "https://voca.ro/shouldnotexist";
    }
  });

  background.runtimeListener(
    {
      type: "ft-upload-audio-url",
      id: "customer-video",
      url: "https://fc-use1-00-files-bkt-00.s3.amazonaws.com/customer.mp4"
    },
    { tab: { id: 7 } },
    () => {}
  );

  const error = await waitFor(() => background.messages.find(
    (message) => message.type === "ft-audio-vocaroo-error"
  ));
  assert.match(error.error, /Formatos de vídeo/);
  assert.equal(uploaded, false);
});

test("resolves a video attachment URL for the inline player", async () => {
  const background = loadBackground({
    fetch: async () => new Response(JSON.stringify({
      file_url: "https://fc-use1-00-files-bkt-00.s3.amazonaws.com/customer.mp4"
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }),
    upload: async () => {
      throw new Error("Vocaroo must not be used for video playback");
    }
  });

  const armed = await arm(background.runtimeListener, {
    type: "ft-arm-video-download", id: "video-1"
  });
  assert.equal(armed.armed, true);
  background.requestListener({
    tabId: 7,
    url: "https://account.freshchat.com/crm/messaging/app/public/file/download?id=video-1"
  });

  const ready = await waitFor(() => background.messages.find(
    (message) => message.type === "ft-video-download-url"
  ));
  assert.equal(
    ready.url,
    "https://fc-use1-00-files-bkt-00.s3.amazonaws.com/customer.mp4"
  );
});
