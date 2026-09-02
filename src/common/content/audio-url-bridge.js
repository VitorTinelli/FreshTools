(() => {
  "use strict";

  let requestId = null;
  const isDownloadUrl = (value) =>
    typeof value === "string" && /\/file\/download(?:\?|$)/i.test(value);

  function deliver(url) {
    if (!requestId || !isDownloadUrl(url)) return false;
    document.dispatchEvent(new CustomEvent("ft-audio-url", {
      detail: `${requestId}\n${url}`
    }));
    requestId = null;
    return true;
  }

  document.addEventListener("ft-request-audio-url", (event) => {
    requestId = typeof event.detail === "string" ? event.detail : null;
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
