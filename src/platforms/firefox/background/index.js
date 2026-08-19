"use strict";

const pendingTabs = new Map();
const uploadJobs = new Map();
const cancelledUploads = new Set();
const mediaCaptures = new Map();
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const VIDEO_EXTENSION = /\.(?:mp4|3gp|m4v|mov|avi|mkv|mpg|mpeg|ogv)(?:[?#]|$)/i;

function findFileUrl(value) {
  if (typeof value === "string") {
    if (/^(?:https?:|blob:)/i.test(value) && !/\/file\/download(?:\?|$)/i.test(value)) {
      return value;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const key of ["url", "fileUrl", "file_url", "downloadUrl", "download_url", "signedUrl", "signed_url"]) {
    const found = findFileUrl(value[key]);
    if (found) return found;
  }
  for (const child of Object.values(value)) {
    const found = findFileUrl(child);
    if (found) return found;
  }
  return null;
}

function sendToTab(tabId, message) {
  return browser.tabs.sendMessage(tabId, message).catch(() => {});
}

function releaseCapture(tabId, capture = mediaCaptures.get(tabId)) {
  if (!capture) return;
  if (mediaCaptures.get(tabId) === capture) mediaCaptures.delete(tabId);
  clearTimeout(capture.expiryTimer);
}

async function downloadAudio(requestUrl, signal) {
  let sourceUrl = requestUrl;
  let response = await fetch(requestUrl, {
    credentials: "include", redirect: "follow", signal
  });
  if (!response.ok) throw new Error(`Falha ao baixar o áudio (HTTP ${response.status}).`);

  if (/json/i.test(response.headers.get("content-type") || "")) {
    const url = findFileUrl(await response.json());
    if (!url) throw new Error("URL final do áudio não encontrada na resposta.");
    sourceUrl = url;
    response = await fetch(url, { redirect: "follow", signal });
    if (!response.ok) throw new Error(`Falha ao baixar o áudio (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (/^video\//i.test(contentType) || VIDEO_EXTENSION.test(sourceUrl)) {
    throw new Error("Formatos de vídeo não podem ser enviados ao Vocaroo.");
  }
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > MAX_FILE_SIZE) throw new Error("O áudio ultrapassou 25 MB.");
  const blob = await response.blob();
  if (!blob.size) throw new Error("O arquivo de áudio está vazio.");
  if (/^video\//i.test(blob.type)) throw new Error("Formatos de vídeo não podem ser enviados ao Vocaroo.");
  if (blob.size > MAX_FILE_SIZE) throw new Error("O áudio ultrapassou 25 MB.");
  return blob;
}

async function uploadAudioUrl(tabId, id, requestUrl) {
  const controller = new AbortController();
  uploadJobs.set(id, { tabId, controller });
  let phase = "downloading";
  const notify = (detail) => sendToTab(tabId, {
    type: "ft-audio-vocaroo-progress", id, ...detail
  });
  try {
    await notify({ phase: "downloading" });
    const blob = await downloadAudio(requestUrl, controller.signal);
    const url = await globalThis.FreshToolsVocaroo.upload(blob, {
      signal: controller.signal,
      onPhase: (nextPhase) => {
        phase = nextPhase;
        return notify({ phase: nextPhase });
      },
      onProgress: (uploaded, total) => notify({
        phase: "uploading", percent: Math.round(uploaded / total * 100)
      })
    });
    await sendToTab(tabId, { type: "ft-audio-vocaroo-ready", id, url });
  } catch (error) {
    // Em algumas configurações do Firefox, o processo de fundo não pode ler a
    // URL assinada do Freshchat. Nesse caso, a página ainda pode carregá-la em
    // um elemento de mídia, que é capturado pelo filtro de resposta existente.
    if (phase === "downloading" && error.name !== "AbortError" &&
        /networkerror|failed to fetch|network request failed/i.test(error.message || "")) {
      await sendToTab(tabId, {
        type: "ft-audio-vocaroo-fallback-capture", id, url: requestUrl
      });
      return;
    }
    await sendToTab(tabId, {
      type: "ft-audio-vocaroo-error", id,
      cancelled: error.name === "AbortError",
      error: error.name === "AbortError" ? "Envio cancelado." : error.message
    });
  } finally {
    uploadJobs.delete(id);
  }
}

async function uploadCapturedAudio(tabId, id, blob, controller) {
  const notify = (detail) => sendToTab(tabId, {
    type: "ft-audio-vocaroo-progress", id, ...detail
  });
  try {
    if (!blob.size) throw new Error("O arquivo de áudio está vazio.");
    if (/^video\//i.test(blob.type)) throw new Error("Formatos de vídeo não podem ser enviados ao Vocaroo.");
    if (blob.size > MAX_FILE_SIZE) throw new Error("O áudio ultrapassou 25 MB.");
    const url = await globalThis.FreshToolsVocaroo.upload(blob, {
      signal: controller.signal,
      onPhase: (phase) => notify({ phase }),
      onProgress: (uploaded, total) => notify({
        phase: "uploading", percent: Math.round(uploaded / total * 100)
      })
    });
    await sendToTab(tabId, { type: "ft-audio-vocaroo-ready", id, url });
  } catch (error) {
    await sendToTab(tabId, {
      type: "ft-audio-vocaroo-error",
      id,
      cancelled: error.name === "AbortError",
      error: error.name === "AbortError" ? "Envio cancelado." : error.message
    });
  } finally {
    uploadJobs.delete(id);
  }
}

async function resolveAndSend(tabId, pending, requestUrl) {
  const downloadType = pending.media === "video" ? "ft-video-download" : "ft-audio-download";
  try {
    if (pending.action === "capture") {
      if (!/\/file\/download(?:[/?#]|$)/i.test(requestUrl)) {
        await sendToTab(tabId, { type: "ft-audio-capture-url", id: pending.id, url: requestUrl });
        return;
      }
      const response = await fetch(requestUrl, { credentials: "include", redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      let url = response.url;
      if (/json/i.test(contentType)) url = findFileUrl(await response.json());
      if (!url) throw new Error("URL do áudio não encontrada.");
      await sendToTab(tabId, { type: "ft-audio-capture-url", id: pending.id, url });
      return;
    }
    const response = await fetch(requestUrl, { credentials: "include", redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    let url = response.url;
    if (/json/i.test(contentType)) {
      url = findFileUrl(await response.json());
    }
    if (!url || /\/file\/download(?:\?|$)/i.test(url)) {
      throw new Error("URL final não encontrada na resposta");
    }
    await sendToTab(tabId, {
      type: `${downloadType}-url`,
      id: pending.id,
      url
    });
  } catch (error) {
    sendToTab(tabId, {
      type: `${downloadType}-error`,
      id: pending.id,
      error: error.message
    });
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "ft-upload-audio-url") {
    const tabId = sender.tab?.id;
    const url = typeof message.url === "string" ? message.url : "";
    if (!tabId || !/^https?:\/\//i.test(url)) return Promise.resolve({ started: false });
    uploadAudioUrl(tabId, message.id, url);
    return Promise.resolve({ started: true });
  }
  if (message?.type === "ft-resolve-audio-source") {
    const tabId = sender.tab?.id;
    const url = typeof message.url === "string" ? message.url : "";
    if (!tabId || !/^https?:\/\//i.test(url)) return Promise.resolve({ started: false });
    resolveAndSend(tabId, { id: message.id, action: "capture", media: "audio" }, url);
    return Promise.resolve({ started: true });
  }
  if (message?.type === "ft-cancel-audio-vocaroo") {
    const tabId = sender.tab?.id;
    const armed = pendingTabs.get(tabId);
    const job = uploadJobs.get(message.id);
    const capture = mediaCaptures.get(tabId);
    if (armed?.id === message.id) {
      pendingTabs.delete(tabId);
      sendToTab(tabId, {
        type: "ft-audio-vocaroo-error", id: message.id, cancelled: true, error: "Envio cancelado."
      });
    } else if (capture?.id === message.id) {
      releaseCapture(tabId, capture);
      capture.controller.abort();
      capture.filter?.disconnect();
      sendToTab(tabId, {
        type: "ft-audio-vocaroo-error", id: message.id, cancelled: true, error: "Envio cancelado."
      });
    } else if (job?.tabId === tabId) {
      job.controller.abort();
    } else {
      cancelledUploads.add(message.id);
      setTimeout(() => cancelledUploads.delete(message.id), 10000);
    }
    return Promise.resolve({ cancelled: true });
  }
  if (message?.type === "ft-capture-audio-response") {
    const tabId = sender.tab?.id;
    const url = typeof message.url === "string" ? message.url : "";
    if (!tabId || !/^https?:\/\//i.test(url)) return Promise.resolve({ started: false });
    const previous = mediaCaptures.get(tabId);
    previous?.controller.abort();
    previous?.filter?.disconnect();
    const capture = {
      id: message.id,
      url,
      controller: new AbortController(),
      expires: Date.now() + 90000,
      expiryTimer: null
    };
    capture.expiryTimer = setTimeout(() => {
      if (mediaCaptures.get(tabId) !== capture) return;
      releaseCapture(tabId, capture);
      capture.controller.abort();
      capture.filter?.disconnect();
      sendToTab(tabId, {
        type: "ft-audio-vocaroo-error", id: capture.id,
        error: "O Firefox não iniciou o download do áudio a tempo."
      });
    }, 90000);
    mediaCaptures.set(tabId, capture);
    return Promise.resolve({ started: true });
  }
  if (message?.type === "ft-resolve-captured-audio") {
    const tabId = sender.tab?.id;
    const url = typeof message.url === "string" ? message.url : "";
    const pending = pendingTabs.get(tabId);
    if (!tabId || !pending || pending.id !== message.id ||
        !/^https?:\/\//i.test(url)) return Promise.resolve({ started: false });
    pendingTabs.delete(tabId);
    if (pending.action !== "capture") {
      pending.action = message.action === "vocaroo" ? "vocaroo" : "play";
    }
    resolveAndSend(tabId, pending, url);
    return Promise.resolve({ started: true });
  }
  const isAudioRequest = message?.type === "ft-arm-audio-download";
  const isVideoRequest = message?.type === "ft-arm-video-download";
  if ((!isAudioRequest && !isVideoRequest) || !sender.tab?.id) return undefined;
  pendingTabs.set(sender.tab.id, {
    id: message.id,
    action: isAudioRequest && message.action === "capture"
      ? "capture"
      : (isAudioRequest && message.action === "vocaroo" ? "vocaroo" : "play"),
    media: isVideoRequest ? "video" : "audio",
    expires: Date.now() + 45000
  });
  return Promise.resolve({ armed: true });
});

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!/\/file\/download(?:[/?#]|$)/i.test(details.url)) return {};
    const pending = pendingTabs.get(details.tabId);
    if (!pending || pending.expires < Date.now()) {
      pendingTabs.delete(details.tabId);
      return {};
    }
    pendingTabs.delete(details.tabId);
    resolveAndSend(details.tabId, pending, details.url);
    return { cancel: true };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const capture = mediaCaptures.get(details.tabId);
    if (!capture || capture.expires < Date.now()) {
      if (capture) releaseCapture(details.tabId, capture);
      return {};
    }
    let expected;
    let requested;
    try {
      expected = new URL(capture.url);
      requested = new URL(details.url);
    } catch (_error) {
      return {};
    }
    // A captura é disparada por um fetch específico. Exigir URL e método
    // exatos impede pegar uma resposta parcial (Range) de outro player.
    if (details.method !== "GET" || expected.href !== requested.href) return {};
    if (typeof browser.webRequest.filterResponseData !== "function") {
      releaseCapture(details.tabId, capture);
      sendToTab(details.tabId, {
        type: "ft-audio-vocaroo-error", id: capture.id,
        error: "Esta versão do Firefox não permite capturar o áudio."
      });
      return {};
    }
    releaseCapture(details.tabId, capture);
    const filter = browser.webRequest.filterResponseData(details.requestId);
    capture.filter = filter;
    uploadJobs.set(capture.id, { tabId: details.tabId, controller: capture.controller });
    sendToTab(details.tabId, {
      type: "ft-audio-vocaroo-progress", id: capture.id, phase: "downloading"
    });
    const chunks = [];
    let capturedSize = 0;
    filter.ondata = (event) => {
      if (capture.finished) return;
      const chunk = new Uint8Array(event.data);
      capturedSize += chunk.byteLength;
      if (capturedSize > MAX_FILE_SIZE) {
        capture.finished = true;
        uploadJobs.delete(capture.id);
        filter.disconnect();
        sendToTab(details.tabId, {
          type: "ft-audio-vocaroo-error", id: capture.id,
          error: "O áudio ultrapassou 25 MB."
        });
        return;
      }
      chunks.push(chunk.slice());
      filter.write(event.data);
    };
    filter.onerror = () => {
      capture.finished = true;
      uploadJobs.delete(capture.id);
      sendToTab(details.tabId, {
        type: "ft-audio-vocaroo-error", id: capture.id,
        error: "O Firefox interrompeu o download do áudio."
      });
    };
    filter.onstop = () => {
      filter.close();
      if (capture.finished) return;
      capture.finished = true;
      const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      uploadCapturedAudio(
        details.tabId,
        capture.id,
        new Blob([bytes], { type: "audio/ogg" }),
        capture.controller
      );
    };
    return {};
  },
  { urls: ["<all_urls>"], types: ["xmlhttprequest"] },
  ["blocking"]
);
