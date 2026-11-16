export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_SECONDS = 300;
export const MODEL = 'onnx-community/whisper-tiny';
export const REVISION = 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7';
export const CACHE = `ft-whisper-${REVISION}`;
export const READY_KEY = `https://huggingface.co/${MODEL}/resolve/${REVISION}/.freshtools-ready`;
export function validateSize(size) {
  if (!Number.isFinite(size) || size <= 0) throw new Error('O arquivo de áudio está vazio.');
  if (size > MAX_BYTES) throw new Error('O áudio ultrapassou 25 MB.');
}
export function validateDuration(duration) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Não foi possível identificar a duração do áudio.');
  if (duration > MAX_SECONDS) throw new Error('A transcrição aceita áudios de até 5 minutos.');
}
export async function readAudio(response) {
  if (!response.ok) throw new Error(`Não foi possível baixar o áudio (HTTP ${response.status}).`);
  if (/^video\//i.test(response.headers.get('content-type') || '')) throw new Error('Selecione um arquivo de áudio.');
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('O áudio ultrapassou 25 MB.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      validateSize(size);
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  validateSize(size);
  return new Blob(chunks).arrayBuffer();
}
