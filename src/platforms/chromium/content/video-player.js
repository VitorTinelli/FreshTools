(() => {
  "use strict";

  const VIDEO_EXTENSION = /\.(?:mp4|3gp|m4v|mov|avi|mkv|mpg|mpeg|ogv|webm)(?:\s|$)/i;
  const VIDEO_MIME = /\bvideo\/[a-z0-9.+-]+/i;
  const AUDIO_MIME = /\baudio\/[a-z0-9.+-]+/i;
  const PLAYER_CLASS = "ft-inline-video-player";
  const pending = new Map();
  const runtime = globalThis.chrome?.runtime;
  let nextId = 0;

  function fileName(attachment) {
    return (attachment.querySelector(".file-name-wrapper")?.textContent || "")
      .replace(/\s+/g, " ").trim();
  }

  function isVideoAttachment(attachment, download) {
    const hints = [
      fileName(attachment),
      attachment.getAttribute("data-content-type"),
      attachment.getAttribute("data-file-type"),
      download.getAttribute("aria-label"),
      download.getAttribute("href")
    ].filter(Boolean).join(" ");
    if (AUDIO_MIME.test(hints)) return false;
    return VIDEO_MIME.test(hints) || VIDEO_EXTENSION.test(hints);
  }

  function showButtonError(button, message) {
    button.disabled = false;
    button.dataset.state = "error";
    button.textContent = "Não foi possível abrir — tentar novamente";
    button.title = message || "Não foi possível carregar o vídeo";
  }

  function takePending(id) {
    const current = pending.get(id);
    if (!current) return null;
    clearTimeout(current.timeout);
    pending.delete(id);
    return current;
  }

  function showPlayerError(video, message) {
    const error = video.ftFreshToolsError;
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function createError(video) {
    const error = document.createElement("div");
    error.className = "ft-video-player-error";
    error.hidden = true;
    error.setAttribute("role", "alert");
    video.ftFreshToolsError = error;
    return error;
  }

  function createToolbar(video) {
    const toolbar = document.createElement("div");
    toolbar.className = "ft-video-player-toolbar";
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "ft-video-player-control";
    expand.textContent = "Ampliar";
    expand.setAttribute("aria-label", "Ampliar vídeo");
    function setExpanded(expanded) {
      const shell = video.closest(".ft-video-player-shell");
      shell?.classList.toggle("ft-video-shell-expanded", expanded);
      video.classList.toggle("ft-video-expanded", expanded);
      expand.textContent = expanded ? "Reduzir" : "Ampliar";
      expand.setAttribute("aria-label", expanded ? "Reduzir vídeo" : "Ampliar vídeo");
    }
    video.ftFreshToolsSetExpanded = setExpanded;
    expand.addEventListener("click", () => {
      const shell = video.closest(".ft-video-player-shell");
      setExpanded(!(shell?.classList.contains("ft-video-shell-expanded") ||
        video.classList.contains("ft-video-expanded")));
    });
    const fullscreen = document.createElement("button");
    fullscreen.type = "button";
    fullscreen.className = "ft-video-player-control";
    fullscreen.textContent = "Tela cheia";
    fullscreen.setAttribute("aria-label", "Exibir vídeo em tela cheia");
    fullscreen.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (video.requestFullscreen) {
          await video.requestFullscreen();
        } else if (video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        } else {
          throw new Error("Tela cheia não suportada neste navegador.");
        }
      } catch (error) {
        showPlayerError(video, error.message);
      }
    });
    toolbar.append(expand, fullscreen);
    return toolbar;
  }

  function createShell(video) {
    const shell = document.createElement("div");
    shell.className = "ft-video-player-shell";
    shell.append(video, createToolbar(video), createError(video));
    return shell;
  }

  function prepareVideo(video) {
    video.classList.add(PLAYER_CLASS);
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("error", () => {
      showPlayerError(video, "Este formato ou codec de vídeo não é suportado pelo navegador.");
    });
  }

  function installResolvedPlayer(id, url) {
    const current = takePending(id);
    if (!current) return;
    const video = document.createElement("video");
    prepareVideo(video);
    video.src = url;
    video.setAttribute("aria-label", `Reproduzir ${fileName(current.attachment) || "vídeo"}`);
    current.button.replaceWith(createShell(video));
    video.play().catch(() => {});
  }

  async function requestVideo(attachment, download, button) {
    const id = `ft-video-${Date.now()}-${nextId += 1}`;
    const current = { attachment, button, timeout: null };
    pending.set(id, current);
    button.disabled = true;
    button.dataset.state = "loading";
    button.textContent = "Carregando vídeo...";
    try {
      const response = await runtime.sendMessage({ type: "ft-arm-video-download", id });
      if (!response?.armed) throw new Error("Captura indisponível");
      current.timeout = setTimeout(() => {
        if (!takePending(id)) return;
        showButtonError(button, "O Freshchat demorou para disponibilizar o vídeo.");
      }, 10000);
      download.click();
    } catch (error) {
      takePending(id);
      showButtonError(button, error.message);
    }
  }

  function enhanceAttachment(attachment) {
    if (attachment.dataset.ftVideoPlayer === "true") return;
    const download = attachment.querySelector('a[aria-label$=" download"], a[role="button"]');
    if (!download || !isVideoAttachment(attachment, download)) return;
    attachment.dataset.ftVideoPlayer = "true";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ft-video-load-button";
    button.textContent = "▶ Ver vídeo";
    button.addEventListener("click", () => requestVideo(attachment, download, button));
    attachment.appendChild(button);
  }

  function enhanceNativeVideo(video) {
    if (video.dataset.ftVideoPlayer === "true") return;
    if (video.closest(".ft-video-player-shell") || video.closest("#ft-audio-recorder-panel")) return;
    if (!video.closest("li.user-messages, .fc-ui-message-bubble, .fc-ui-unity-message, .file-attachment")) return;
    const parent = video.parentElement;
    if (!parent) return;
    const nextSibling = video.nextSibling;
    video.dataset.ftVideoPlayer = "true";
    prepareVideo(video);
    parent.insertBefore(createShell(video), nextSibling);
  }

  runtime.onMessage.addListener((message) => {
    if (message?.type === "ft-video-download-url") {
      installResolvedPlayer(message.id, message.url);
    } else if (message?.type === "ft-video-download-error") {
      const current = takePending(message.id);
      if (current) showButtonError(current.button, message.error);
    }
  });

  function installPlayers() {
    document.querySelectorAll(".file-attachment").forEach(enhanceAttachment);
    document.querySelectorAll("video").forEach(enhanceNativeVideo);
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
  function reduceExpandedVideos() {
    document.querySelectorAll("video.ft-video-expanded").forEach((video) => {
      video.ftFreshToolsSetExpanded?.(false);
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") reduceExpandedVideos();
  }, true);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) reduceExpandedVideos();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    if (!document.webkitFullscreenElement) reduceExpandedVideos();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
