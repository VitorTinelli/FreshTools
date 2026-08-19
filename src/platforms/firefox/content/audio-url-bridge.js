(() => {
  "use strict";

  let requestId = null;
  const isDownloadUrl = (value) =>
    typeof value === "string" && /\/file\/download(?:[/?#]|$)/i.test(value);
  const isMediaUrl = (value) => typeof value === "string" && /^https?:\/\//i.test(value) &&
    (isDownloadUrl(value) || /amazonaws\.com|\.(?:ogg|oga|opus|mp3|wav|m4a|aac)(?:[?#]|$)/i.test(value));

  function deliver(url) {
    if (!requestId || !isMediaUrl(url)) return false;
    document.dispatchEvent(new CustomEvent("ft-audio-url", {
      detail: `${requestId}\n${url}`
    }));
    requestId = null;
    return true;
  }

  function findComponentUrl(element) {
    const seen = new WeakSet();
    let inspected = 0;
    function visit(value, depth) {
      if (isMediaUrl(value)) return value;
      if (!value || typeof value !== "object" || depth > 6 || inspected > 2000) return "";
      if (seen.has(value)) return "";
      seen.add(value);
      inspected += 1;
      let keys;
      try { keys = Object.keys(value); } catch (_error) { return ""; }
      for (const key of keys) {
        let child;
        try { child = value[key]; } catch (_error) { continue; }
        const found = visit(child, depth + 1);
        if (found) return found;
      }
      return "";
    }
    let current = element;
    for (let level = 0; current && level < 6; level += 1, current = current.parentElement) {
      const found = visit(current, 0);
      if (found) return found;
    }
    return "";
  }

  document.addEventListener("ft-request-audio-url", (event) => {
    requestId = typeof event.detail === "string" ? event.detail : null;
    const url = findComponentUrl(event.target);
    if (url && deliver(url)) event.target.setAttribute("data-ft-url-captured", "true");
  });

  window.addEventListener("message", async (event) => {
    const message = event.data;
    if (event.source !== window || message?.source !== "freshtools-extension" ||
        typeof message.url !== "string") return;
    if (message.type === "ft-trigger-audio-capture") {
      // Mesmo quando o Firefox não expõe a resposta para a página por CORS,
      // esta requisição passa pelo filterResponseData da extensão.
      fetch(message.url, { cache: "no-store" }).catch(() => {});
      return;
    }
    if (message.type !== "ft-read-page-audio") return;
    try {
      const response = await fetch(message.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      window.postMessage({
        source: "freshtools-page",
        type: "ft-page-audio-ready",
        id: message.id,
        contentType: response.headers.get("content-type") || "audio/ogg",
        buffer
      }, "*", [buffer]);
    } catch (error) {
      window.postMessage({
        source: "freshtools-page",
        type: "ft-page-audio-error",
        id: message.id,
        error: error.message || "Não foi possível ler o áudio da página.",
        urlType: message.url.split(":", 1)[0]
      }, "*");
    }
  });

  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("a[href]");
    if (link && deliver(link.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  const nativeOpen = window.open;
  window.open = function (url, ...args) {
    if (deliver(String(url))) return null;
    return nativeOpen.call(this, url, ...args);
  };
})();
