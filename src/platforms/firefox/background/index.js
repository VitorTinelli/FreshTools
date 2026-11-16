"use strict";

const pendingTabs = new Map();
const uploadJobs = new Map();
const cancelledUploads = new Set();
const { findFileUrl, downloadAndUpload } = globalThis.FreshToolsAudioPipeline;

function sendToTab(tabId, message) {
  return browser.tabs.sendMessage(tabId, message).catch(() => {});
}

async function uploadResolvedAudio(tabId, pending, requestUrl) {
  const controller = new AbortController();
  uploadJobs.set(pending.id, { tabId, controller });
  const notify = (detail) => sendToTab(tabId, {
    type: "ft-audio-vocaroo-progress", id: pending.id, ...detail
  });
  try {
    if (cancelledUploads.delete(pending.id)) throw new DOMException("Aborted", "AbortError");
    const url = await downloadAndUpload(requestUrl, {
      signal: controller.signal,
      onPhase: (phase) => notify({ phase }),
      onProgress: (uploaded, total) => notify({
        phase: "uploading", percent: Math.round(uploaded / total * 100)
      })
    });
    await sendToTab(tabId, { type: "ft-audio-vocaroo-ready", id: pending.id, url });
  } catch (error) {
    await sendToTab(tabId, {
      type: "ft-audio-vocaroo-error",
      id: pending.id,
      cancelled: error.name === "AbortError",
      error: error.name === "AbortError" ? "Envio cancelado." : error.message
    });
  } finally {
    uploadJobs.delete(pending.id);
    cancelledUploads.delete(pending.id);
  }
}

async function resolveAndSend(tabId, pending, requestUrl) {
  const downloadType = pending.media === "video" ? "ft-video-download" : "ft-audio-download";
  try {
    if (pending.action === "vocaroo") {
      await uploadResolvedAudio(tabId, pending, requestUrl);
      return;
    }
    const response = await fetch(requestUrl, { credentials: "include", redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    let url = response.url;
    if (/json/i.test(contentType)) url = findFileUrl(await response.json());
    if (!url || /\/file\/download(?:\?|$)/i.test(url)) {
      throw new Error("URL final não encontrada na resposta");
    }
    await sendToTab(tabId, { type: `${downloadType}-url`, id: pending.id, url });
  } catch (error) {
    await sendToTab(tabId, { type: `${downloadType}-error`, id: pending.id, error: error.message });
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "ft-cancel-audio-vocaroo") {
    const tabId = sender.tab?.id;
    const armed = pendingTabs.get(tabId);
    const job = uploadJobs.get(message.id);
    if (armed?.id === message.id) {
      pendingTabs.delete(tabId);
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

  if (message?.type === "ft-upload-audio-url") {
    const tabId = sender.tab?.id;
    const url = typeof message.url === "string" ? message.url : "";
    if (!tabId || !/^https?:\/\//i.test(url)) return Promise.resolve({ started: false });
    uploadResolvedAudio(tabId, { id: message.id }, url);
    return Promise.resolve({ started: true });
  }

  const isAudioRequest = message?.type === "ft-arm-audio-download";
  const isVideoRequest = message?.type === "ft-arm-video-download";
  if ((!isAudioRequest && !isVideoRequest) || !sender.tab?.id) return undefined;
  pendingTabs.set(sender.tab.id, {
    id: message.id,
    action: isAudioRequest && message.action === "vocaroo" ? "vocaroo" : "play",
    media: isVideoRequest ? "video" : "audio",
    expires: Date.now() + 10000
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
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame", "xmlhttprequest", "media", "other"] },
  ["blocking"]
);
