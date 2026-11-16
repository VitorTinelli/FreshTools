import { pipeline, env } from '@huggingface/transformers';
import { MODEL, REVISION, CACHE, READY_KEY } from './core.mjs';

env.allowLocalModels = false;
env.useBrowserCache = false;
env.useCustomCache = true;
env.backends.onnx.wasm.wasmPaths = new URL('./', self.location.href).href;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let started = false;
self.onmessage = async ({ data }) => {
  if (started || !(data.audio instanceof Float32Array)) return;
  started = true;
  const { id, audio } = data;
  const send = (type, extra = {}) => self.postMessage({ id, type, ...extra });
  let engine;
  try {
    const cache = await caches.open(CACHE);
    let cacheFailure;
    const cachedFiles = new Set();
    env.customCache = {
      match: async (key) => {
        const response = await cache.match(key);
        if (response) cachedFiles.add(String(key).split('/').pop());
        return response;
      },
      put: async (key, value) => {
        try { await cache.put(key, value); }
        catch (error) { cacheFailure = error; throw error; }
      }
    };
    engine = await pipeline('automatic-speech-recognition', MODEL, {
      revision: REVISION, device: 'wasm', dtype: 'q8',
      progress_callback: (progress) => {
        if (progress.status === 'progress') send('status', { text: cachedFiles.has(progress.file?.split('/').pop()) ? 'Carregando modelo do cache...' : `Baixando modelo${Number.isFinite(progress.progress) ? `: ${Math.round(progress.progress)}% do arquivo atual` : '...'}` });
        else if (progress.status === 'initiate') send('status', { text: 'Preparando modelo local...' });
      }
    });
    if (cacheFailure) throw new Error('Falha no cache local.');
    await cache.put(READY_KEY, new Response('1'));
    send('status', { text: 'Transcrevendo no computador...' });
    const result = await engine(audio, {
      language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5,
      return_timestamps: true, max_new_tokens: 256, repetition_penalty: 1.1, no_repeat_ngram_size: 6
    });
    send('result', { text: result.text.trim() || 'Nenhuma fala identificada.' });
  } catch (error) {
    const cacheError = /quota|cache|storage/i.test(error.message || '');
    send('error', { text: cacheError ? 'Não foi possível armazenar o modelo. Verifique o espaço disponível e tente novamente.' : 'Não foi possível carregar o modelo ou transcrever. Verifique a conexão no primeiro uso e tente novamente.' });
  } finally { await engine?.dispose(); self.close(); }
};
