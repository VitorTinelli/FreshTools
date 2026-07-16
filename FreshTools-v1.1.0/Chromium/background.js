"use strict";

const pendingTabs = new Map();
let nextRuleId = 1000;

function findFileUrl(value) {
  if (typeof value === "string") {
    return /^(?:https?:|blob:)/i.test(value) && !/\/file\/download(?:\?|$)/i.test(value)
      ? value : null;
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
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [pending.ruleId] });
    const response = await fetch(requestUrl, { credentials: "include", redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    let url = response.url;
    if (/json/i.test(contentType)) url = findFileUrl(await response.json());
    if (!url || /\/file\/download(?:\?|$)/i.test(url)) {
      throw new Error("URL final não encontrada na resposta");
    }
    await chrome.tabs.sendMessage(tabId, {
      type: "ft-audio-download-url", id: pending.id, url
    });
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      type: "ft-audio-download-error", id: pending.id, error: error.message
    }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ft-arm-audio-download" || !sender.tab?.id) return false;
  const ruleId = nextRuleId += 1;
  const pending = { id: message.id, ruleId, expires: Date.now() + 10000 };
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
