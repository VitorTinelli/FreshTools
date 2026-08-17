(() => {
  "use strict";

  const CHUNK_SIZE = 100000;
  const UPLOAD_URLS = [
    "https://upload1.vocaroo.com/apps/main-api/upload",
    "https://upload2.vocaroo.com/apps/main-api/upload"
  ];
  const STATUS_URL = "https://vocaroo.com/apps/main-api/upload/status/";
  const SHARE_URL = "https://voca.ro/";

  function uploadId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function jsonResponse(response, label) {
    if (!response.ok) throw new Error(`${label} (HTTP ${response.status}).`);
    return response.json();
  }

  async function findUploadUrl(signal) {
    const checks = UPLOAD_URLS.map(async (url) => {
      const response = await fetch(`${url}/alive`, { method: "HEAD", signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return url;
    });
    try {
      return await Promise.any(checks);
    } catch (_error) {
      throw new Error("O serviço de upload do Vocaroo não respondeu.");
    }
  }

  async function sendChunk(baseUrl, blob, index, signal) {
    const body = new FormData();
    body.append("chunk", blob, "chunk");
    const response = await fetch(`${baseUrl}/chunk/${index}`, {
      method: "POST", body, signal
    });
    if (!response.ok) throw new Error(`Falha no envio ao Vocaroo (HTTP ${response.status}).`);
  }

  async function uploadChunks(baseUrl, blob, signal, onProgress) {
    const chunks = [];
    for (let offset = 0; offset < blob.size; offset += CHUNK_SIZE) {
      chunks.push(blob.slice(offset, Math.min(offset + CHUNK_SIZE, blob.size)));
    }
    let nextIndex = 0;
    let uploaded = 0;
    async function worker() {
      while (nextIndex < chunks.length) {
        const index = nextIndex;
        nextIndex += 1;
        await sendChunk(baseUrl, chunks[index], index, signal);
        uploaded += chunks[index].size;
        onProgress?.(uploaded, blob.size);
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, () => worker()));
  }

  async function confirmAccepted(mediaId, signal) {
    let response;
    try {
      response = await fetch(`${STATUS_URL}${mediaId}`, { signal });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      return;
    }
    // O mediaId definitivo já foi criado pelo /finalize. A consulta de status é
    // apenas uma verificação adicional e o Vocaroo ocasionalmente responde 5xx.
    if (!response.ok) return;
    let result;
    try {
      result = await response.json();
    } catch (_error) {
      return;
    }
    if (result.status === 2) throw new Error("O Vocaroo não conseguiu processar o áudio.");
  }

  async function upload(blob, { signal, onProgress, onPhase } = {}) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("Não há áudio para enviar.");
    if (/^video\//i.test(blob.type)) {
      throw new Error("Formatos de vídeo não podem ser enviados ao Vocaroo.");
    }
    onPhase?.("connecting");
    const server = await findUploadUrl(signal);
    const baseUrl = `${server}/${uploadId()}`;
    onPhase?.("uploading");
    await uploadChunks(baseUrl, blob, signal, onProgress);
    onPhase?.("processing");
    const response = await fetch(`${baseUrl}/finalize`, { method: "POST", signal });
    const result = await jsonResponse(response, "Falha ao finalizar o upload no Vocaroo");
    if (result.status !== 0 || !result.mediaId) {
      throw new Error("O Vocaroo rejeitou o áudio enviado.");
    }
    await confirmAccepted(result.mediaId, signal);
    onPhase?.("ready");
    return `${SHARE_URL}${result.mediaId}`;
  }

  globalThis.FreshToolsVocaroo = { upload };
})();
