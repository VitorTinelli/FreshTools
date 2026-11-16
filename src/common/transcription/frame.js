import { CACHE, READY_KEY, validateSize, validateDuration, readAudio } from './core.mjs';
const runtime = (globalThis.browser || globalThis.chrome).runtime;
const id = location.hash.slice(1);
const ticket = runtime.sendMessage({ type: 'ft-transcription-claim', id });
let port, worker, controller, context, running = false;
function send(type, extra = {}) { port?.postMessage({ id, type, ...extra }); }
function stop() { controller?.abort(); worker?.terminate(); worker = null; context?.close().catch(() => {}); }
addEventListener('pagehide', stop);
addEventListener('message', async (event) => {
  if (event.source !== parent || event.data?.type !== 'ft-transcription-connect' || event.data.id !== id || !event.ports[0]) return;
  const auth = await ticket;
  if (port || !auth || event.origin !== auth.origin || event.data.token !== auth.token) return;
  port = event.ports[0];
  port.onmessage = async ({ data }) => {
    if (data?.id !== id) return;
    if (data.type === 'cancel') { stop(); return; }
    if (data.type !== 'start' || running) return;
    running = true;
    controller = new AbortController();
    const timeout = setTimeout(() => { stop(); send('error', { text: 'O processamento excedeu 15 minutos. Tente um áudio menor.' }); }, 15 * 60 * 1000);
    try {
      send('status', { text: 'Preparando áudio...' });
      let buffer = data.buffer;
      if (!buffer) {
        const url = new URL(data.url);
        if (url.protocol !== 'https:' || !/\.(?:freshdesk|freshchat|freshworks|myfreshworks)\.com$|\.amazonaws\.com$|\.cloudfront\.net$/.test(url.hostname)) throw new Error('Endereço do áudio não suportado.');
        const downloadTimer = setTimeout(() => controller.abort(), 60000);
        try { buffer = await readAudio(await fetch(url.href, { credentials: 'include', signal: controller.signal })); }
        finally { clearTimeout(downloadTimer); }
      }
      if (!(buffer instanceof ArrayBuffer)) throw new Error('Arquivo de áudio inválido.');
      validateSize(buffer.byteLength);
      context = new AudioContext({ sampleRate: 16000 });
      let decoded;
      try { decoded = await context.decodeAudioData(buffer); }
      catch { throw new Error('Formato de áudio incompatível ou arquivo corrompido.'); }
      validateDuration(decoded.duration);
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
      const source = offline.createBufferSource();
      source.buffer = decoded; source.connect(offline.destination); source.start();
      const pcm = (await offline.startRendering()).getChannelData(0);
      await context.close(); context = null;
      if (controller.signal.aborted) return;
      if (!pcm.some((value) => Math.abs(value) > 0.0001)) { send('result', { text: 'Nenhuma fala identificada.' }); clearTimeout(timeout); return; }
      worker = new Worker('worker.js', { type: 'module' });
      worker.onmessage = ({ data: message }) => {
        if (message.id !== id) return;
        send(message.type, { text: message.text });
        if (message.type === 'result' || message.type === 'error') { clearTimeout(timeout); stop(); }
      };
      worker.onerror = () => { clearTimeout(timeout); stop(); send('error', { text: 'O motor local não iniciou. Recarregue a extensão e tente novamente.' }); };
      worker.postMessage({ id, audio: pcm }, [pcm.buffer]);
    } catch (error) { clearTimeout(timeout); stop(); send('error', { text: error.name === 'AbortError' ? 'O download demorou demais. Tente novamente.' : error.message }); }
  };
  try {
    const cache = await caches.open(CACHE);
    const ready = Boolean(await cache.match(READY_KEY));
    send('ready', { cached: ready });
  } catch { send('error', { text: 'O cache local está indisponível. Permita armazenamento neste navegador e tente novamente.' }); }
});
