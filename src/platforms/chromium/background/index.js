"use strict";

importScripts("../content/vocaroo-upload.js", "audio-pipeline.js", "welcome.js");

const pendingTabs = new Map();
const uploadJobs = new Map();
const cancelledUploads = new Set();
let nextRuleId = 1000;
const { findFileUrl, downloadAndUpload } = globalThis.FreshToolsAudioPipeline;

function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message).catch(() => {});
}

async function uploadResolvedAudio(tabId, pending, requestUrl) {
  const controller = new AbortController();
  uploadJobs.set(pending.id, { tabId, controller });
  const notify = (detail) => sendToTab(tabId, {
    type: "ft-audio-vocaroo-progress", id: pending.id, ...detail
  });
  try {
    if (cancelledUploads.delete(pending.id)) {
      throw new DOMException("Aborted", "AbortError");
    }
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
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [pending.ruleId] });
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
    await sendToTab(tabId, {
      type: `${downloadType}-url`, id: pending.id, url
    });
  } catch (error) {
    sendToTab(tabId, {
      type: `${downloadType}-error`, id: pending.id, error: error.message
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ft-cancel-audio-vocaroo") {
    const tabId = sender.tab?.id;
    const armed = pendingTabs.get(tabId);
    const job = uploadJobs.get(message.id);
    if (armed?.id === message.id) {
      pendingTabs.delete(tabId);
      chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [armed.ruleId] });
      sendToTab(tabId, {
        type: "ft-audio-vocaroo-error", id: message.id, cancelled: true, error: "Envio cancelado."
      });
    } else if (job?.tabId === tabId) {
      job.controller.abort();
    } else {
      cancelledUploads.add(message.id);
      setTimeout(() => cancelledUploads.delete(message.id), 10000);
    }
    sendResponse({ cancelled: true });
    return false;
  }
  if (message?.type === "ft-upload-audio-url") {
    const tabId = sender.tab?.id;
    const url = typeof message.url === "string" ? message.url : "";
    if (!tabId || !/^https?:\/\//i.test(url)) {
      sendResponse({ started: false });
      return false;
    }
    uploadResolvedAudio(tabId, { id: message.id }, url);
    sendResponse({ started: true });
    return false;
  }
  const isAudioRequest = message?.type === "ft-arm-audio-download";
  const isVideoRequest = message?.type === "ft-arm-video-download";
  if ((!isAudioRequest && !isVideoRequest) || !sender.tab?.id) return false;
  const ruleId = nextRuleId += 1;
  const pending = {
    id: message.id,
    action: isAudioRequest && message.action === "vocaroo" ? "vocaroo" : "play",
    media: isVideoRequest ? "video" : "audio",
    ruleId,
    expires: Date.now() + 10000
  };
  pendingTabs.set(sender.tab.id, pending);
  chrome.declarativeNetRequest.updateSessionRules({
    addRules: [{
      id: ruleId,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: "^https://.*/crm/messaging/app/public/file/download\\?.*",
        tabIds: [sender.tab.id],
        resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "media", "other"]
      }
    }]
  }).then(() => {
    sendResponse({ armed: true });
    setTimeout(() => {
      if (pendingTabs.get(sender.tab.id) !== pending) return;
      pendingTabs.delete(sender.tab.id);
      chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
    }, 10000);
  }, () => sendResponse({ armed: false }));
  return true;
});

function captureRequest(details) {
  const pending = pendingTabs.get(details.tabId);
  if (!pending || pending.expires < Date.now()) {
    pendingTabs.delete(details.tabId);
    return;
  }
  pendingTabs.delete(details.tabId);
  resolveAndSend(details.tabId, pending, details.url);
}

chrome.webRequest.onBeforeRequest.addListener(
  captureRequest,
  { urls: ["*://*/crm/messaging/app/public/file/download?*"] }
);

chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener(({ request }) => {
  captureRequest(request);
});
