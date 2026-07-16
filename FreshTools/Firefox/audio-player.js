(() => {
  "use strict";

  const AUDIO_EXTENSION = /\.(?:ogg|oga|opus|mp3|wav|m4a|aac|webm)\s*$/i;
  const PLAYER_CLASS = "ft-inline-audio-player";
  const pending = new Map();
  const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;
  let nextId = 0;

  function fileName(attachment) {
    return (attachment.querySelector(".file-name-wrapper")?.textContent || "")
      .replace(/\s+/g, " ").trim();
  }

  function showError(button) {
    button.disabled = false;
    button.textContent = "Não foi possível carregar — tente novamente";
  }

  function installResolvedPlayer(id, url) {
    const current = pending.get(id);
    if (!current) return;
    pending.delete(id);
    const player = document.createElement("audio");
    player.className = PLAYER_CLASS;
    player.controls = true;
    player.preload = "metadata";
    player.src = url;
    player.setAttribute("aria-label", `Reproduzir ${fileName(current.attachment)}`);
    player.addEventListener("error", () => {
      player.replaceWith(current.button);
      showError(current.button);
    }, { once: true });
    current.button.replaceWith(player);
    player.play().catch(() => {});
  }

  async function requestPlayer(attachment, download, button) {
    const id = `ft-audio-${Date.now()}-${nextId += 1}`;
    pending.set(id, { attachment, button });
    button.disabled = true;
    button.textContent = "Carregando áudio...";
    try {
      const response = await runtime.sendMessage({ type: "ft-arm-audio-download", id });
      if (!response?.armed) throw new Error("Captura indisponível");
      download.click();
    } catch (_error) {
      pending.delete(id);
      showError(button);
      return;
    }
    setTimeout(() => {
      if (!pending.delete(id)) return;
      showError(button);
    }, 10000);
  }

  function enhance(attachment) {
    if (attachment.dataset.ftAudioPlayer === "true") return;
    if (!AUDIO_EXTENSION.test(fileName(attachment))) return;
    const download = attachment.querySelector('a[aria-label$=" download"], a[role="button"]');
    if (!download) return;
    attachment.dataset.ftAudioPlayer = "true";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ft-audio-load-button";
    button.textContent = "▶ Ouvir áudio";
    button.addEventListener("click", () => requestPlayer(attachment, download, button));
    attachment.appendChild(button);
  }

  runtime.onMessage.addListener((message) => {
    if (message?.type === "ft-audio-download-url") {
      installResolvedPlayer(message.id, message.url);
    } else if (message?.type === "ft-audio-download-error") {
      const current = pending.get(message.id);
      if (current) {
        pending.delete(message.id);
        showError(current.button);
      }
    }
  });

  function installPlayers() {
    document.querySelectorAll(".file-attachment").forEach(enhance);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      installPlayers();
    });
  });
  installPlayers();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
