"use strict";

(() => {
  const isFirefox = typeof globalThis.browser !== "undefined";
  const api = globalThis.browser || globalThis.chrome;
  const pagePath = "permissions/index.html";
  let pageOpening;

  function report(error) {
    console.error("FreshTools: falha ao abrir boas-vindas", error);
  }

  function openPage() {
    return api.tabs.create({ url: api.runtime.getURL(pagePath) });
  }

  function openPageOnce() {
    if (!pageOpening) {
      pageOpening = (async () => {
        const pageUrl = api.runtime.getURL(pagePath);
        const tabs = await api.tabs.query({});
        if (!tabs.some((tab) => tab.url === pageUrl)) await openPage();
      })().finally(() => { pageOpening = null; });
    }
    return pageOpening;
  }

  async function openForMissingFirefoxPermissions() {
    if (!isFirefox || !api.permissions?.contains || !api.tabs?.query) return;
    const origins = api.runtime.getManifest().host_permissions || [];
    if (!await api.permissions.contains({ origins })) await openPageOnce();
  }

  // Firefox pode omitir o fluxo visual ao carregar uma extensão temporária.
  // Esta verificação é exclusiva dele; no Chromium a página abre somente pelos
  // eventos de instalação/atualização ou por uma ação explícita do usuário.
  openForMissingFirefoxPermissions().catch(report);

  if (api.runtime.onInstalled) {
    api.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install" || details.reason === "update") {
        openPageOnce().catch(report);
      }
    });
  }

  if (api.action?.onClicked) api.action.onClicked.addListener(openPage);
})();
