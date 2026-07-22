(() => {
  "use strict";

  const BUTTON_ID = "ft-audio-recorder-button";
  const PANEL_ID = "ft-audio-recorder-panel";
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const runtime = globalThis.chrome?.runtime;
  let session = null;

  function icon(pathData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
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
    const tested = document.querySelector('[data-test-fc-send-button="root"]');
    if (tested) return tested;
    return Array.from(document.querySelectorAll("button, [role=button]")).find((node) =>
      node.id !== BUTTON_ID && /^send dm$/i.test((node.innerText || node.textContent || "").trim())) || null;
  }

  function positionPanel(button, panel) {
    const rect = button.getBoundingClientRect();
    panel.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    panel.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 8)}px`;
  }

  function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60)
      .toString().padStart(2, "0")}`;
  }

  function stopTracks(current) {
    current?.stream?.getTracks().forEach((track) => track.stop());
  }

  function releaseCapture(current) {
    current.finishing = true;
    clearInterval(current.timer);
    stopTracks(current);
    current.node?.disconnect();
    current.source?.disconnect();
    current.sink?.disconnect();
    current.context?.close().catch(() => {});
    current.worker?.terminate();
    if (current.worker?.ftScriptUrl) URL.revokeObjectURL(current.worker.ftScriptUrl);
    delete document.documentElement.dataset.ftAudioRecording;
  }

  function cleanup(current) {
    releaseCapture(current);
    if (current.url) URL.revokeObjectURL(current.url);
  }

  function setFatal(current, message) {
    if (!current.fatalError) current.fatalError = new Error(message);
    current.stopReject?.(current.fatalError);
  }

  function discard() {
    const current = session;
    session = null;
    if (!current) return;
    cleanup(current);
    current.panel.remove();
    delete current.button.dataset.state;
  }

  function showError(current, message) {
    const error = current.panel.querySelector(".ft-audio-error");
    error.textContent = message;
    error.hidden = false;
  }

  function updateClock(current) {
    let elapsed = current.activeElapsed;
    if (current.phase === "recording") elapsed += performance.now() - current.activeStartedAt;
    current.panel.querySelector(".ft-audio-time").textContent = formatTime(elapsed);
  }

  function beginActiveClock(current) {
    current.activeStartedAt = performance.now();
    current.phase = "recording";
  }

  function pauseActiveClock(current) {
    if (current.phase === "recording") {
      current.activeElapsed += performance.now() - current.activeStartedAt;
    }
    current.phase = "paused";
    updateClock(current);
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
    const file = new File([current.blob], `gravacao-${new Date().toISOString().replace(/[:.]/g, "-")}.ogg`, {
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

  function createPanel(button) {
    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "ft-audio-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Gravador de áudio");
    const header = element("div", "ft-audio-header");
    const status = element("span", "ft-audio-status");
    status.textContent = "Solicitando microfone...";
    const close = element("button", "ft-audio-close", { type: "button", title: "Cancelar", "aria-label": "Cancelar" });
    close.textContent = "×";
    header.append(status, close);
    const time = element("div", "ft-audio-time");
    time.textContent = "00:00";
    const controls = element("div", "ft-audio-recording-controls");
    const pause = element("button", "ft-audio-control ft-audio-pause", { type: "button", title: "Pausar", "aria-label": "Pausar" });
    pause.append(icon("M6 19h4V5H6v14zm8-14v14h4V5h-4z"));
    const stop = element("button", "ft-audio-control ft-audio-stop", { type: "button", title: "Parar", "aria-label": "Parar" });
    stop.append(icon("M6 6h12v12H6z"));
    controls.append(pause, stop);
    const preview = element("div", "ft-audio-preview", { hidden: "" });
    const audio = element("audio", "", { controls: "", preload: "metadata" });
    const actions = element("div", "ft-audio-preview-actions");
    const attachButton = element("button", "ft-audio-control ft-audio-attach", { type: "button", title: "Adicionar como anexo", "aria-label": "Adicionar como anexo" });
    attachButton.append(icon("M16.5 6.5v10.75a4.25 4.25 0 0 1-8.5 0V5.5a3 3 0 0 1 6 0v10.75a1.75 1.75 0 0 1-3.5 0V6.5H12v9.75a.25.25 0 0 0 .5 0V5.5a1.5 1.5 0 0 0-3 0v11.75a2.75 2.75 0 0 0 5.5 0V6.5h1.5z"));
    const remove = element("button", "ft-audio-control ft-audio-delete", { type: "button", title: "Excluir", "aria-label": "Excluir" });
    remove.append(icon("M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5-1-1h-5l-1 1H5v2h14V4z"));
    actions.append(attachButton, remove);
    preview.append(audio, actions);
    const error = element("div", "ft-audio-error", { role: "alert", hidden: "" });
    panel.append(header, time, controls, preview, error);
    document.body.appendChild(panel);
    positionPanel(button, panel);
    return panel;
  }

  function waitForWorker(worker) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("O codificador OGG não respondeu.")), 10000);
      const onMessage = ({ data }) => {
        if (data?.command !== "readyToInit") return;
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve();
      };
      const onError = () => {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        reject(new Error("O codificador OGG não pôde ser iniciado."));
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError, { once: true });
    });
  }

  function waitForFinalBlob(current) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("O codificador OGG não finalizou.")), 15000);
      const onMessage = ({ data }) => {
        if (data?.command === "lastEncodedData") {
          clearTimeout(timeout);
          current.worker.removeEventListener("message", onMessage);
          resolve(new Blob(data.buffers, { type: "audio/ogg" }));
        }
      };
      const onError = () => {
        clearTimeout(timeout);
        current.worker.removeEventListener("message", onMessage);
        reject(new Error("O codificador OGG falhou ao finalizar."));
      };
      current.worker.addEventListener("message", onMessage);
      current.worker.addEventListener("error", onError, { once: true });
    });
  }

  function createEncoderWorker() {
    const factory = globalThis.encoderWorker;
    if (typeof factory !== "function") throw new Error("Worker do codificador OGG não foi carregado.");
    const scriptUrl = URL.createObjectURL(new Blob([`(${factory})()`], { type: "application/javascript" }));
    const worker = new Worker(scriptUrl);
    worker.ftScriptUrl = scriptUrl;
    return worker;
  }

  async function finalize(current) {
    const stopped = new Promise((resolve, reject) => {
      current.stopResolve = resolve;
      current.stopReject = reject;
    });
    if (current.fatalError) throw current.fatalError;
    current.node.port.postMessage({ command: "stop" });
    await stopped;
    current.worker.postMessage({ command: "done" });
    current.blob = await waitForFinalBlob(current);
    const result = await globalThis.FreshToolsAudioIntegrity.inspectOgg(
      current.blob, current.totalFrames, current.sampleRate);
    current.integrity = result;
    return result;
  }

  async function start(button) {
    if (session) {
      positionPanel(button, session.panel);
      return;
    }
    const panel = createPanel(button);
    const current = {
      button, panel, stream: null, context: null, source: null, node: null, sink: null, worker: null,
      phase: "starting", activeElapsed: 0, activeStartedAt: 0, timer: null, nextSequence: 0,
      totalFrames: 0, sampleRate: 48000, chunks: [], finishing: false
    };
    session = current;
    panel.querySelector(".ft-audio-close").addEventListener("click", discard);
    panel.querySelector(".ft-audio-delete").addEventListener("click", discard);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.AudioWorkletNode) {
        throw new Error("Este navegador não oferece captura de áudio segura.");
      }
      current.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: { exact: 1 }, echoCancellation: true, noiseSuppression: true, autoGainControl: true
      } });
      const track = current.stream.getAudioTracks()[0];
      const channelCount = track?.getSettings().channelCount;
      if (!track || (channelCount && channelCount !== 1)) throw new Error("O microfone não forneceu áudio mono compatível.");
      track.onended = () => {
        if (!current.finishing && current.phase !== "ready") setFatal(current, "O microfone foi interrompido.");
      };
      current.context = new AudioContext({ latencyHint: "interactive" });
      await current.context.resume();
      current.sampleRate = current.context.sampleRate;
      await current.context.audioWorklet.addModule(runtime.getURL("audio-worklet.js"));
      current.worker = createEncoderWorker();
      current.worker.onerror = () => {
        if (!current.finishing) setFatal(current, "Falha no codificador OGG; a gravação foi descartada.");
      };
      current.worker.postMessage({ command: "loadEncoder", mimeType: "audio/ogg", wasmPath: runtime.getURL("vendor/OggOpusEncoder.wasm") });
      await waitForWorker(current.worker);
      current.worker.postMessage({ command: "init", sampleRate: current.sampleRate, channelCount: 1, bitsPerSecond: 64000 });
      current.node = new AudioWorkletNode(current.context, "freshtools-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      current.sink = current.context.createGain();
      current.sink.gain.value = 0;
      current.source = current.context.createMediaStreamSource(current.stream);
      current.source.connect(current.node).connect(current.sink).connect(current.context.destination);
      current.node.port.onmessage = ({ data }) => {
        if (data?.type === "audio") {
          if (data.sequence !== current.nextSequence || data.firstFrame !== current.totalFrames) {
            setFatal(current, "Foi detectada uma lacuna na captura de áudio.");
            return;
          }
          current.nextSequence += 1;
          current.totalFrames += data.frameCount;
          current.worker.postMessage({ command: "pushInputData", channelBuffers: [data.samples], length: data.frameCount, duration: data.frameCount / data.sampleRate }, [data.samples.buffer]);
        } else if (data?.type === "discontinuity") {
          setFatal(current, "O microfone não forneceu um bloco contínuo de áudio.");
        } else if (data?.type === "stopped") {
          if (data.totalFrames !== current.totalFrames) {
            setFatal(current, "A quantidade de áudio capturado não pôde ser confirmada.");
          } else {
            current.stopResolve?.();
          }
        }
      };
      current.node.port.postMessage({ command: "resume" });
      beginActiveClock(current);
      document.documentElement.dataset.ftAudioRecording = "true";
      button.dataset.state = "recording";
      panel.querySelector(".ft-audio-status").textContent = "Gravando";
      current.timer = setInterval(() => updateClock(current), 250);
      panel.querySelector(".ft-audio-pause").addEventListener("click", () => {
        if (current.phase === "recording") {
          pauseActiveClock(current);
          current.node.port.postMessage({ command: "pause" });
          panel.querySelector(".ft-audio-status").textContent = "Pausado";
        } else if (current.phase === "paused") {
          beginActiveClock(current);
          current.node.port.postMessage({ command: "resume" });
          panel.querySelector(".ft-audio-status").textContent = "Gravando";
        }
      });
      panel.querySelector(".ft-audio-stop").addEventListener("click", async () => {
        if (!["recording", "paused"].includes(current.phase)) return;
        if (current.phase === "recording") pauseActiveClock(current);
        current.phase = "finalizing";
        panel.querySelector(".ft-audio-status").textContent = "Validando áudio...";
        try {
          await finalize(current);
          releaseCapture(current);
          current.phase = "ready";
          current.url = URL.createObjectURL(current.blob);
          panel.querySelector("audio").src = current.url;
          panel.querySelector(".ft-audio-recording-controls").hidden = true;
          panel.querySelector(".ft-audio-preview").hidden = false;
          panel.querySelector(".ft-audio-status").textContent = "Gravação pronta";
          button.dataset.state = "ready";
        } catch (error) {
          current.phase = "invalid";
          showError(current, error.message);
          panel.querySelector(".ft-audio-status").textContent = "Gravação descartada";
          panel.querySelector(".ft-audio-recording-controls").hidden = true;
          cleanup(current);
        }
      });
      panel.querySelector(".ft-audio-attach").addEventListener("click", async (event) => {
        const control = event.currentTarget;
        if (current.phase !== "ready") return;
        control.disabled = true;
        panel.querySelector(".ft-audio-status").textContent = "Adicionando anexo...";
        try { await attach(current); discard(); } catch (error) { showError(current, error.message); control.disabled = false; }
      });
    } catch (error) {
      cleanup(current);
      panel.querySelector(".ft-audio-status").textContent = "Microfone indisponível";
      panel.querySelector(".ft-audio-recording-controls").hidden = true;
      showError(current, error.message);
    }
  }

  function createButton() {
    const button = element("button", "ft-audio-recorder-button", { type: "button", id: BUTTON_ID, title: "Gravar áudio", "aria-label": "Gravar áudio" });
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
    if (existing) { if (existing.parentElement !== container || send.previousElementSibling !== existing) send.before(existing); return; }
    send.before(createButton());
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled || session?.phase === "recording" || session?.phase === "paused") return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; install(); });
  });
  install();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
