(() => {
  "use strict";

  const TOAST_ID = "ft-vocaroo-toast";
  const TOAST_DURATION = 5000;
  let hideTimer = null;

  function notify(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.className = "ft-vocaroo-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      toast.hidden = true;
    }, TOAST_DURATION);
  }

  async function copyWithFallback(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_error) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (!copied) throw new Error("Não foi possível copiar o link do Vocaroo.");
    }
  }

  async function copyLink(url) {
    if (!/^https:\/\/voca\.ro\/[a-z0-9]+$/i.test(url)) {
      throw new Error("O Vocaroo retornou um link inválido.");
    }
    await copyWithFallback(url);
    notify("Link do Vocaroo copiado para a área de transferência");
  }

  globalThis.FreshToolsVocarooFeedback = { copyLink, notify };
})();
