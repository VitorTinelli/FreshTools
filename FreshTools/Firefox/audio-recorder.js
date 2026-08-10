(() => {
  "use strict";

  const BUTTON_ID = "ft-audio-recorder-button";
  const PANEL_ID = "ft-audio-recorder-panel";
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  let session = null;

  function icon(pathData) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", pathData);
    svg.append(path);
    return svg;
  }

  function element(tag, className, attributes = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
  }

  function findSendButton() {
    const testedButton = document.querySelector('[data-test-fc-send-button="root"]');
    if (testedButton) return testedButton;
    return Array.from(document.querySelectorAll('button, [role="button"]')).find((element) =>
      element.id !== BUTTON_ID && /^send dm$/i.test((element.innerText || element.textContent || "").trim())
    ) || null;
  }

  function formatTime(seconds) {
    return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60)
      .toString().padStart(2, "0")}`;
  }

  function positionPanel(button, panel) {
    const rect = button.getBoundingClientRect();
    panel.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    panel.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 8)}px`;
  }

  function stopTracks(current) {
    current?.stream?.getTracks().forEach((track) => track.stop());
  }

  function discard() {
    const current = session;
    session = null;
    if (!current) return;
    clearInterval(current.timer);
    if (current.recorder && current.recorder.state !== "inactive") {
      current.recorder.ondataavailable = null;
      current.recorder.onstop = null;
      current.recorder.stop();
    }
    stopTracks(current);
    current.uploadController?.abort();
    if (current.url) URL.revokeObjectURL(current.url);
    current.panel.remove();
    delete current.button.dataset.state;
  }

  function preferredMimeType() {
    const type = "audio/ogg;codecs=opus";
    return MediaRecorder.isTypeSupported(type) ? type : "";
  }

  function fileName(type) {
    const extension = type.includes("ogg") ? "ogg" : "webm";
    return `gravacao-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  }

  function findFileInput() {
    const send = findSendButton();
    let container = send?.parentElement || null;
    for (let depth = 0; container && depth < 8; depth += 1) {
      const input = container.querySelector('input[type="file"]');
      if (input) return input;
      container = container.parentElement;
    }
    return Array.from(document.querySelectorAll('input[type="file"]')).at(-1) || null;
  }

  async function attach(current) {
    const input = findFileInput();
    if (!input) throw new Error("Campo de anexo do Freshchat não encontrado.");
    if (current.blob.size > MAX_FILE_SIZE) throw new Error("O áudio ultrapassou 25 MB.");

    const file = new File([current.blob], fileName(current.blob.type), {
      type: current.blob.type,
      lastModified: Date.now()
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  function findMessageEditor() {
    const selector = 'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"]';
    const send = findSendButton();
    let container = send?.parentElement || null;
    for (let depth = 0; container && depth < 8; depth += 1) {
      const editors = Array.from(container.querySelectorAll(selector)).filter((editor) => {
        const rect = editor.getBoundingClientRect();
        return !editor.closest(`#${PANEL_ID}`) && rect.width > 0 && rect.height > 0;
      });
      if (editors.length) return editors.at(-1);
      container = container.parentElement;
    }
    return Array.from(document.querySelectorAll(selector)).filter((editor) => {
      const rect = editor.getBoundingClientRect();
      return !editor.closest(`#${PANEL_ID}`) && rect.width > 0 && rect.height > 0;
    }).at(-1) || null;
  }

  function insertMessageText(text) {
    const editor = findMessageEditor();
    if (!editor) throw new Error("Campo de mensagem do Freshchat não encontrado.");
    const existing = editor instanceof HTMLTextAreaElement ? editor.value : (editor.innerText || "");
    const value = `${existing && !/\s$/.test(existing) ? " " : ""}${text}`;
    editor.focus();
    if (editor instanceof HTMLTextAreaElement) {
      const start = editor.selectionStart ?? editor.value.length;
      const end = editor.selectionEnd ?? start;
      editor.setRangeText(value, start, end, "end");
      editor.dispatchEvent(new InputEvent("input", {
        bubbles: true, composed: true, inputType: "insertText", data: value
      }));
      return;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    if (!document.execCommand("insertText", false, value)) {
      range.insertNode(document.createTextNode(value));
      range.collapse(false);
      editor.dispatchEvent(new InputEvent("input", {
        bubbles: true, composed: true, inputType: "insertText", data: value
      }));
    }
  }

  async function uploadToVocaroo(current) {
    if (current.blob.size > MAX_FILE_SIZE) throw new Error("O áudio ultrapassou 25 MB.");
    current.uploadController = new AbortController();
    const url = await globalThis.FreshToolsVocaroo.upload(current.blob, {
      signal: current.uploadController.signal,
      onPhase: (phase) => {
        if (phase === "connecting") setUploadUi(current, "Conectando ao Vocaroo...");
        if (phase === "uploading") setUploadUi(current, "Enviando áudio ao Vocaroo...", 0);
        if (phase === "processing") setUploadUi(current, "Upload concluído. Gerando link...");
      },
      onProgress: (uploaded, total) => {
        const percent = Math.round(uploaded / total * 100);
        setUploadUi(current, `Enviando áudio ao Vocaroo... ${percent}%`, percent);
      }
    });
    insertMessageText(url);
  }

  function showError(current, message) {
    const error = current.panel.querySelector(".ft-audio-error");
    error.textContent = message;
    error.hidden = false;
  }

  function setUploadUi(current, label, percent = null) {
    const state = current.panel.querySelector(".ft-audio-upload-state");
    const progress = state.querySelector("progress");
    current.panel.dataset.mode = "uploading";
    state.hidden = false;
    state.querySelector(".ft-audio-upload-label").textContent = label;
    current.panel.querySelector(".ft-audio-status").textContent = label;
    if (Number.isFinite(percent)) progress.value = percent;
    else progress.removeAttribute("value");
  }

  function resetUploadUi(current) {
    delete current.panel.dataset.mode;
    current.panel.querySelector(".ft-audio-upload-state").hidden = true;
  }

  function showPreview(current) {
    current.url = URL.createObjectURL(current.blob);
    current.panel.querySelector("audio").src = current.url;
    current.panel.querySelector(".ft-audio-recording-controls").hidden = true;
    current.panel.querySelector(".ft-audio-preview").hidden = false;
    current.panel.querySelector(".ft-audio-status").textContent = "Gravação pronta";
    current.button.dataset.state = "ready";
  }

  function createPanel(button) {
    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "ft-audio-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Gravador de áudio");
    const header = element("div", "ft-audio-header");
    const status = element("span", "ft-audio-status");
    status.textContent = "Solicitando microfone...";
    const close = element("button", "ft-audio-close",
      { type: "button", title: "Cancelar", "aria-label": "Cancelar" });
    close.textContent = "×";
    header.append(status, close);

    const time = element("div", "ft-audio-time");
    time.textContent = "00:00";
    const recordingControls = element("div", "ft-audio-recording-controls");
    const pause = element("button", "ft-audio-control ft-audio-pause",
      { type: "button", title: "Pausar", "aria-label": "Pausar" });
    pause.append(icon("M6 19h4V5H6v14zm8-14v14h4V5h-4z"));
    const stop = element("button", "ft-audio-control ft-audio-stop",
      { type: "button", title: "Parar", "aria-label": "Parar" });
    stop.append(icon("M6 6h12v12H6z"));
    recordingControls.append(pause, stop);

    const preview = element("div", "ft-audio-preview", { hidden: "" });
    const audio = element("audio", "", { controls: "", preload: "metadata" });
    const previewActions = element("div", "ft-audio-preview-actions");
    const attach = element("button", "ft-audio-control ft-audio-attach",
      { type: "button", title: "Adicionar como anexo", "aria-label": "Adicionar como anexo" });
    attach.append(icon("M16.5 6.5v10.75a4.25 4.25 0 0 1-8.5 0V5.5a3 3 0 0 1 6 0v10.75a1.75 1.75 0 0 1-3.5 0V6.5H12v9.75a.25.25 0 0 0 .5 0V5.5a1.5 1.5 0 0 0-3 0v11.75a2.75 2.75 0 0 0 5.5 0V6.5h1.5z"));
    const vocaroo = element("button", "ft-audio-control ft-audio-vocaroo",
      { type: "button", title: "Enviar ao Vocaroo e inserir link", "aria-label": "Enviar ao Vocaroo e inserir link" });
    vocaroo.append(icon("M19.35 10.04A7.49 7.49 0 0 0 5.5 8a6 6 0 0 0 .5 12h13a5 5 0 0 0 .35-9.96zM13 13v4h-2v-4H8l4-4 4 4h-3z"));
    const remove = element("button", "ft-audio-control ft-audio-delete",
      { type: "button", title: "Excluir", "aria-label": "Excluir" });
    remove.append(icon("M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5-1-1h-5l-1 1H5v2h14V4z"));
    previewActions.append(attach, vocaroo, remove);
    const uploadState = element("div", "ft-audio-upload-state", { hidden: "", role: "status", "aria-live": "polite" });
    const uploadHeading = element("div", "ft-audio-upload-heading");
    const spinner = element("span", "ft-audio-spinner", { "aria-hidden": "true" });
    const uploadLabel = element("span", "ft-audio-upload-label");
    const uploadProgress = element("progress", "ft-audio-upload-progress", { max: "100", value: "0" });
    const cancelUpload = element("button", "ft-audio-upload-cancel", { type: "button" });
    cancelUpload.textContent = "Cancelar envio";
    uploadHeading.append(spinner, uploadLabel);
    uploadState.append(uploadHeading, uploadProgress, cancelUpload);
    preview.append(audio, previewActions, uploadState);
    const error = element("div", "ft-audio-error", { role: "alert", hidden: "" });
    panel.append(header, time, recordingControls, preview, error);
    document.body.appendChild(panel);
    positionPanel(button, panel);
    return panel;
  }

  async function start(button) {
    if (session) {
      positionPanel(button, session.panel);
      return;
    }
    const panel = createPanel(button);
    const current = { button, panel, stream: null, recorder: null, chunks: [], blob: null,
      url: null, elapsed: 0, timer: null };
    session = current;
    panel.querySelector(".ft-audio-close").addEventListener("click", discard);
    panel.querySelector(".ft-audio-delete").addEventListener("click", discard);
    panel.querySelector(".ft-audio-upload-cancel").addEventListener("click", () => {
      panel.querySelector(".ft-audio-status").textContent = "Cancelando envio...";
      current.uploadController?.abort();
    });

    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("Este navegador não oferece gravação de áudio compatível.");
      }
      current.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { exact: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const channelCount = current.stream.getAudioTracks()[0]?.getSettings().channelCount;
      if (channelCount && channelCount !== 1) {
        stopTracks(current);
        throw new Error("O microfone não forneceu áudio mono compatível com o WhatsApp.");
      }
      const type = preferredMimeType();
      if (!type) {
        throw new Error("Este Firefox não oferece gravação OGG/Opus nativa.");
      }
      current.recorder = new MediaRecorder(current.stream,
        { mimeType: type, audioBitsPerSecond: 64000 });
      current.recorder.ondataavailable = (event) => {
        if (event.data.size) current.chunks.push(event.data);
      };
      current.recorder.onerror = (event) => showError(current,
        event.error?.message || "Falha durante a gravação.");
      current.recorder.onstop = () => {
        clearInterval(current.timer);
        stopTracks(current);
        current.blob = new Blob(current.chunks, { type: current.recorder.mimeType || type });
        showPreview(current);
      };
      current.recorder.start(1000);
      button.dataset.state = "recording";
      panel.querySelector(".ft-audio-status").textContent = "Gravando";
      current.timer = setInterval(() => {
        if (current.recorder.state === "recording") {
          current.elapsed += 1;
          panel.querySelector(".ft-audio-time").textContent = formatTime(current.elapsed);
        }
      }, 1000);

      panel.querySelector(".ft-audio-pause").addEventListener("click", (event) => {
        const control = event.currentTarget;
        if (current.recorder.state === "recording") {
          current.recorder.pause();
          panel.querySelector(".ft-audio-status").textContent = "Pausado";
          control.title = control.ariaLabel = "Continuar";
          control.replaceChildren(icon("M8 5v14l11-7z"));
        } else if (current.recorder.state === "paused") {
          current.recorder.resume();
          panel.querySelector(".ft-audio-status").textContent = "Gravando";
          control.title = control.ariaLabel = "Pausar";
          control.replaceChildren(icon("M6 19h4V5H6v14zm8-14v14h4V5h-4z"));
        }
      });
      panel.querySelector(".ft-audio-stop").addEventListener("click", () => {
        if (current.recorder.state !== "inactive") {
          panel.querySelector(".ft-audio-status").textContent = "Processando áudio...";
          current.recorder.stop();
        }
      });
      panel.querySelector(".ft-audio-attach").addEventListener("click", async (event) => {
        const control = event.currentTarget;
        control.disabled = true;
        panel.querySelector(".ft-audio-error").hidden = true;
        panel.querySelector(".ft-audio-status").textContent = "Adicionando anexo...";
        try {
          await attach(current);
          discard();
        } catch (error) {
          showError(current, error.message);
          panel.querySelector(".ft-audio-status").textContent = "Não foi possível anexar";
          control.disabled = false;
        }
      });
      panel.querySelector(".ft-audio-vocaroo").addEventListener("click", async () => {
        if (!current.blob || current.uploading) return;
        const controls = panel.querySelectorAll(".ft-audio-preview-actions button");
        controls.forEach((control) => { control.disabled = true; });
        current.uploading = true;
        panel.querySelector(".ft-audio-error").hidden = true;
        setUploadUi(current, "Preparando envio ao Vocaroo...", 0);
        try {
          await uploadToVocaroo(current);
          discard();
        } catch (error) {
          current.uploading = false;
          current.uploadController = null;
          resetUploadUi(current);
          if (error.name === "AbortError") {
            panel.querySelector(".ft-audio-status").textContent = "Envio cancelado — gravação pronta";
            controls.forEach((control) => { control.disabled = false; });
            return;
          }
          showError(current, error.message);
          panel.querySelector(".ft-audio-status").textContent = "Não foi possível gerar o link";
          controls.forEach((control) => { control.disabled = false; });
        }
      });
    } catch (error) {
      stopTracks(current);
      panel.querySelector(".ft-audio-status").textContent = "Microfone indisponível";
      panel.querySelector(".ft-audio-recording-controls").hidden = true;
      showError(current, error.name === "NotAllowedError"
        ? "Permita o uso do microfone para gravar áudio."
        : error.name === "OverconstrainedError"
          ? "Este microfone não conseguiu fornecer áudio mono compatível com o WhatsApp."
          : error.message);
    }
  }

  function createButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "ft-audio-recorder-button";
    button.title = "Gravar áudio";
    button.setAttribute("aria-label", button.title);
    button.append(icon("M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"));
    button.addEventListener("click", () => start(button));
    return button;
  }

  function install() {
    const send = findSendButton();
    if (!send) return;
    const container = send.closest(".send-message") || send.parentElement;
    if (!container) return;
    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      if (existing.parentElement !== container || send.previousElementSibling !== existing) {
        send.before(existing);
      }
      return;
    }
    send.before(createButton());
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      install();
    });
  });
  install();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
