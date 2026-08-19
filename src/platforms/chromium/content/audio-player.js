(() => {
  "use strict";
  const AUDIO_EXTENSION = /\.(?:ogg|oga|opus|mp3|mpga|wav|m4a|aac|amr)(?:\s|$)/i;
  const AUDIO_MIME = /\baudio\/[a-z0-9.+-]+/i;
  const VIDEO_EXTENSION = /\.(?:mp4|3gp|m4v|mov|avi|mkv|mpg|mpeg|ogv)(?:\s|$)/i;
  const VIDEO_MIME = /\bvideo\/[a-z0-9.+-]+/i;
  const PLAYER_CLASS = "ft-inline-audio-player";
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const pending = new Map();
  const runtime = globalThis.chrome?.runtime;
  let nextId = 0;

  function fileName(attachment) {
    return (attachment.querySelector(".file-name-wrapper")?.textContent || "")
      .replace(/\s+/g, " ").trim();
  }
  function uploadIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M19.35 10.04A7.49 7.49 0 0 0 5.5 8a6 6 0 0 0 .5 12h13a5 5 0 0 0 .35-9.96zM13 13v4h-2v-4H8l4-4 4 4h-3z");
    svg.append(path);
    return svg;
  }
  function setVocarooState(button, state, label) {
    button.dataset.state = state;
    button.title = label;
    button.setAttribute("aria-label", label);
  }
  function createVocarooButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ft-audio-attachment-vocaroo";
    button.append(uploadIcon());
    setVocarooState(button, "idle", "Enviar este áudio ao Vocaroo e copiar o link");
    return button;
  }
  function takePending(id) {
    const current = pending.get(id);
    if (!current) return null;
    clearTimeout(current.timeout);
    pending.delete(id);
    return current;
  }
  function isAudioAttachment(attachment, download) {
    const hints = [
      fileName(attachment),
      attachment.getAttribute("data-content-type"),
      attachment.getAttribute("data-file-type"),
      download.getAttribute("aria-label"),
      download.getAttribute("href")
    ].filter(Boolean).join(" ");
    if (VIDEO_EXTENSION.test(hints) || VIDEO_MIME.test(hints)) return false;
    return AUDIO_EXTENSION.test(hints) || AUDIO_MIME.test(hints);
  }
  function showError(current, message) {
    current.button.disabled = false;
    if (current.action === "vocaroo") {
      setVocarooState(current.button, "error", message || "Falha no Vocaroo — tentar novamente");
    } else {
      current.button.textContent = "Não foi possível carregar — tente novamente";
    }
  }
  function installResolvedPlayer(id, url) {
    const current = takePending(id);
    if (!current) return;
    const player = document.createElement("audio");
    player.className = PLAYER_CLASS;
    player.controls = true;
    player.preload = "metadata";
    player.src = url;
    player.setAttribute("aria-label", `Reproduzir ${fileName(current.attachment)}`);
    player.addEventListener("error", () => {
      player.replaceWith(current.button);
      showError(current, "Não foi possível reproduzir o áudio.");
    }, { once: true });
    current.button.replaceWith(player);
    player.play().catch(() => {});
  }
  async function requestAudio(attachment, download, button, action) {
    const id = `ft-audio-${Date.now()}-${nextId += 1}`;
    const current = { id, attachment, button, action, timeout: null };
    pending.set(id, current);
    button.disabled = action !== "vocaroo";
    if (action === "vocaroo") setVocarooState(button, "loading", "Preparando envio ao Vocaroo...");
    else {
      button.dataset.state = "loading";
      button.textContent = "Carregando áudio...";
    }
    try {
      const response = await runtime.sendMessage({
        type: "ft-arm-audio-download", id, action
      });
      if (!response?.armed) throw new Error("Captura indisponível");
      current.timeout = setTimeout(() => {
        if (!takePending(id)) return;
        showError(current, "O Freshchat demorou para disponibilizar o áudio.");
      }, 10000);
      download.click();
    } catch (_error) {
      takePending(id);
      showError(current, "Não foi possível acessar o arquivo de áudio.");
      return;
    }
  }
  async function copyVocarooLink(attachment, button, url) {
    attachment.dataset.ftVocarooUrl = url;
    if (typeof globalThis.FreshToolsVocarooFeedback?.copyLink !== "function") {
      throw new Error("Recurso de cópia do link indisponível.");
    }
    await globalThis.FreshToolsVocarooFeedback.copyLink(url);
    button.disabled = false;
    setVocarooState(button, "ready", "Link copiado — clicar para copiar novamente");
  }
  function updateVocarooProgress(message) {
    const current = pending.get(message.id);
    if (!current || current.action !== "vocaroo") return;
    clearTimeout(current.timeout);
    current.timeout = null;
    const labels = {
      downloading: "Baixando áudio...",
      connecting: "Conectando ao Vocaroo...",
      uploading: Number.isFinite(message.percent)
        ? `Enviando ao Vocaroo... ${message.percent}%`
        : "Enviando ao Vocaroo...",
      processing: "Gerando link...",
      ready: "Finalizando..."
    };
    setVocarooState(
      current.button,
      "loading",
      labels[message.phase] || "Processando áudio..."
    );
  }
  async function finishVocaroo(id, url) {
    const current = takePending(id);
    if (!current) return;
    try {
      await copyVocarooLink(current.attachment, current.button, url);
    } catch (error) {
      showError(current, error.message);
    }
  }
  function failVocaroo(message) {
    const current = takePending(message.id);
    if (!current) return;
    if (message.cancelled) {
      current.button.disabled = false;
      setVocarooState(current.button, "idle", "Enviar este áudio ao Vocaroo e copiar o link");
      return;
    }
    showError(current, message.error);
  }
  async function handleVocarooClick(attachment, button, startUpload) {
    const current = Array.from(pending.values()).find((item) => item.button === button);
    if (current) {
      setVocarooState(button, "loading", "Cancelando envio...");
      if (current.uploadController) current.uploadController.abort();
      else await runtime.sendMessage({ type: "ft-cancel-audio-vocaroo", id: current.id });
      return;
    }
    const existingUrl = attachment.dataset.ftVocarooUrl;
    if (existingUrl) {
      try { await copyVocarooLink(attachment, button, existingUrl); }
      catch (error) { showError({ button, action: "vocaroo" }, error.message); }
      return;
    }
    startUpload();
  }
  function nativeAudioUrl(player) {
    const value = player.currentSrc || player.src || player.querySelector("source[src]")?.src || "";
    if (!value) return "";
    try { return new URL(value, location.href).href; }
    catch (_error) { return ""; }
  }
  function isNativeVideoFormat(player) {
    const hints = [
      player.currentSrc,
      player.src,
      player.getAttribute("type"),
      ...Array.from(player.querySelectorAll("source")).flatMap((source) => [source.src, source.type])
    ].filter(Boolean).join(" ");
    return VIDEO_EXTENSION.test(hints) || VIDEO_MIME.test(hints);
  }
  function visiblePlayerContainer(player) {
    const message = player.closest("li.user-messages");
    let current = player;
    while (current && current !== message) {
      const rect = current.getBoundingClientRect();
      if (rect.width >= 120 && rect.height >= 30) return current;
      current = current.parentElement;
    }
    return null;
  }
  async function requestNativeAudio(player, attachment, button) {
    const id = `ft-audio-${Date.now()}-${nextId += 1}`;
    const current = { id, attachment, button, action: "vocaroo", timeout: null };
    pending.set(id, current);
    setVocarooState(button, "loading", "Preparando envio ao Vocaroo...");
    try {
      const url = nativeAudioUrl(player);
      if (!url) throw new Error("O Freshchat ainda não disponibilizou o áudio.");
      if (/^https?:\/\//i.test(url)) {
        current.timeout = setTimeout(() => {
          if (!takePending(id)) return;
          showError(current, "O Freshchat demorou para disponibilizar o áudio.");
        }, 10000);
        const response = await runtime.sendMessage({ type: "ft-upload-audio-url", id, url });
        if (!response?.started) throw new Error("Não foi possível iniciar o upload.");
        return;
      }
      if (!/^(?:blob:|data:)/i.test(url)) throw new Error("Endereço do áudio não suportado.");
      current.uploadController = new AbortController();
      updateVocarooProgress({ id, phase: "downloading" });
      const response = await fetch(url, { signal: current.uploadController.signal });
      if (!response.ok) throw new Error(`Falha ao ler o áudio (HTTP ${response.status}).`);
      const blob = await response.blob();
      if (/^video\//i.test(blob.type)) throw new Error("Formatos de vídeo não podem ser enviados ao Vocaroo.");
      if (blob.size > MAX_FILE_SIZE) throw new Error("O áudio ultrapassou 25 MB.");
      const vocarooUrl = await globalThis.FreshToolsVocaroo.upload(blob, {
        signal: current.uploadController.signal,
        onPhase: (phase) => updateVocarooProgress({ id, phase }),
        onProgress: (uploaded, total) => updateVocarooProgress({
          id, phase: "uploading", percent: Math.round(uploaded / total * 100)
        })
      });
      await finishVocaroo(id, vocarooUrl);
    } catch (error) {
      failVocaroo({
        id,
        cancelled: error.name === "AbortError",
        error: error.name === "AbortError" ? "Envio cancelado." : error.message
      });
    }
  }
  function enhance(attachment) {
    if (attachment.dataset.ftAudioPlayer === "true") return;
    const download = attachment.querySelector('a[aria-label$=" download"], a[role="button"]');
    if (!download) return;
    if (!isAudioAttachment(attachment, download)) return;
    attachment.dataset.ftAudioPlayer = "true";
    attachment.classList.add("ft-audio-enhanced-attachment");
    const actions = document.createElement("div");
    actions.className = "ft-audio-attachment-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ft-audio-action-button ft-audio-load-button";
    button.textContent = "▶ Ouvir áudio";
    button.addEventListener("click", () => requestAudio(attachment, download, button, "play"));
    const vocaroo = createVocarooButton();
    vocaroo.addEventListener("click", () => handleVocarooClick(
      attachment, vocaroo, () => requestAudio(attachment, download, vocaroo, "vocaroo")
    ));
    actions.append(button);
    attachment.append(actions, vocaroo);
  }
  function enhanceNativePlayer(player) {
    if (player.dataset.ftVocarooPlayer === "true") return;
    if (player.classList.contains(PLAYER_CLASS)) return;
    if (player.closest(".file-attachment") || player.closest("#ft-audio-recorder-panel")) return;
    if (isNativeVideoFormat(player)) return;
    const visibleContainer = visiblePlayerContainer(player);
    if (!visibleContainer) return;
    const host = visibleContainer.parentElement;
    if (!host) return;
    const attachment = player;
    player.dataset.ftVocarooPlayer = "true";
    host.classList.add("ft-audio-native-vocaroo-host");
    const vocaroo = createVocarooButton();
    vocaroo.addEventListener("click", () => handleVocarooClick(
      attachment, vocaroo, () => requestNativeAudio(player, attachment, vocaroo)
    ));
    host.appendChild(vocaroo);
  }
  runtime.onMessage.addListener((message) => {
    if (message?.type === "ft-audio-download-url") {
      installResolvedPlayer(message.id, message.url);
    } else if (message?.type === "ft-audio-download-error") {
      const current = takePending(message.id);
      if (current) showError(current, message.error);
    } else if (message?.type === "ft-audio-vocaroo-progress") {
      updateVocarooProgress(message);
    } else if (message?.type === "ft-audio-vocaroo-ready") {
      finishVocaroo(message.id, message.url);
    } else if (message?.type === "ft-audio-vocaroo-error") {
      failVocaroo(message);
    }
  });
  function installPlayers() {
    document.querySelectorAll(".file-attachment").forEach(enhance);
    document.querySelectorAll("audio").forEach(enhanceNativePlayer);
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (document.documentElement.dataset.ftAudioRecording === "true") return;
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
