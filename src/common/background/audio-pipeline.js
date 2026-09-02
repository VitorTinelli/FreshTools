"use strict";

(() => {
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const VIDEO_EXTENSION = /\.(?:mp4|3gp|m4v|mov|avi|mkv|mpg|mpeg|ogv)(?:[?#]|$)/i;

  class AudioPipelineError extends Error {
    constructor(message, code, cause) {
      super(message, cause ? { cause } : undefined);
      this.name = "AudioPipelineError";
      this.code = code;
    }
  }

  function findFileUrl(value) {
    if (typeof value === "string") {
      return /^(?:https?:|blob:)/i.test(value) && !/\/file\/download(?:[/?#]|$)/i.test(value)
        ? value : null;
    }
    if (!value || typeof value !== "object") return null;
    for (const key of ["url", "fileUrl", "file_url", "downloadUrl", "download_url", "signedUrl", "signed_url"]) {
      const found = findFileUrl(value[key]);
      if (found) return found;
    }
    for (const child of Object.values(value)) {
      const found = findFileUrl(child);
      if (found) return found;
    }
    return null;
  }

  async function fetchResponse(url, signal, credentials = "include") {
    try {
      const response = await fetch(url, { credentials, redirect: "follow", signal });
      if (!response.ok) throw new AudioPipelineError(`Falha ao baixar o áudio (HTTP ${response.status}).`, "http");
      return response;
    } catch (error) {
      if (error.name === "AbortError" || error instanceof AudioPipelineError) throw error;
      throw new AudioPipelineError("Falha de rede ao baixar o áudio.", "network", error);
    }
  }

  async function resolveResponse(url, { signal } = {}) {
    let sourceUrl = url;
    let response = await fetchResponse(url, signal);
    if (/json/i.test(response.headers.get("content-type") || "")) {
      const resolvedUrl = findFileUrl(await response.json());
      if (!resolvedUrl) throw new AudioPipelineError("URL final do áudio não encontrada na resposta.", "invalid-response");
      sourceUrl = resolvedUrl;
      response = await fetchResponse(resolvedUrl, signal, "omit");
    } else if (response.url) {
      sourceUrl = response.url;
    }
    return { response, sourceUrl };
  }

  function validateBlob(blob, { sourceUrl = "", contentType = blob?.type || "", declaredSize = 0 } = {}) {
    if (/^video\//i.test(contentType) || /^video\//i.test(blob?.type || "") || VIDEO_EXTENSION.test(sourceUrl)) {
      throw new AudioPipelineError("Formatos de vídeo não podem ser enviados ao Vocaroo.", "video");
    }
    if (Number(declaredSize) > MAX_FILE_SIZE || blob?.size > MAX_FILE_SIZE) {
      throw new AudioPipelineError("O áudio ultrapassou 25 MB.", "too-large");
    }
    if (!blob?.size) throw new AudioPipelineError("O arquivo de áudio está vazio.", "empty");
    return blob;
  }

  async function downloadAudio(url, { signal } = {}) {
    const { response, sourceUrl } = await resolveResponse(url, { signal });
    const contentType = response.headers.get("content-type") || "";
    const declaredSize = Number(response.headers.get("content-length")) || 0;
    if (declaredSize > MAX_FILE_SIZE || /^video\//i.test(contentType) || VIDEO_EXTENSION.test(sourceUrl)) {
      validateBlob({ size: declaredSize || 1, type: contentType }, { sourceUrl, contentType, declaredSize });
    }
    return validateBlob(await response.blob(), { sourceUrl, contentType, declaredSize });
  }

  function uploadBlob(blob, { signal, onPhase, onProgress } = {}) {
    validateBlob(blob);
    return globalThis.FreshToolsVocaroo.upload(blob, { signal, onPhase, onProgress });
  }

  async function downloadAndUpload(url, options = {}) {
    options.onPhase?.("downloading");
    const blob = await downloadAudio(url, { signal: options.signal });
    return uploadBlob(blob, options);
  }

  globalThis.FreshToolsAudioPipeline = {
    MAX_FILE_SIZE, AudioPipelineError, findFileUrl, resolveResponse,
    validateBlob, downloadAudio, uploadBlob, downloadAndUpload
  };
})();
