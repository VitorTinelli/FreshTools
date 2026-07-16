"use strict";

const pendingTabs = new Map();

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

async function resolveAndSend(tabId, pending, requestUrl) {
  try {
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
    await browser.tabs.sendMessage(tabId, {
      type: "ft-audio-download-url",
      id: pending.id,
      url
    });
  } catch (error) {
    browser.tabs.sendMessage(tabId, {
      type: "ft-audio-download-error",
      id: pending.id,
      error: error.message
    }).catch(() => {});
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "ft-arm-audio-download" || !sender.tab?.id) return undefined;
  pendingTabs.set(sender.tab.id, { id: message.id, expires: Date.now() + 10000 });
  return Promise.resolve({ armed: true });
});

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const pending = pendingTabs.get(details.tabId);
    if (!pending || pending.expires < Date.now()) {
      pendingTabs.delete(details.tabId);
      return {};
    }
    pendingTabs.delete(details.tabId);
    resolveAndSend(details.tabId, pending, details.url);
    return { cancel: true };
  },
  { urls: ["*://*/crm/messaging/app/public/file/download?*"] },
  ["blocking"]
);
