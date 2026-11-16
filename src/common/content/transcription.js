(() => {
  'use strict';
  const runtime = (globalThis.browser || globalThis.chrome).runtime;
  const mounted = new WeakMap();
  const views = new Set();
  const MAX_BYTES = 25 * 1024 * 1024;
  let active = null;
  const button = (label) => {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = label; return node;
  };
  function mount(host, getSource, owner = host) {
    if (mounted.has(owner)) return;
    const root = document.createElement('section');
    root.className = 'ft-transcription';
    const toggle = button('Transcrever');
    toggle.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('div');
    panel.hidden = true;
    panel.id = `ft-transcript-${crypto.randomUUID()}`;
    toggle.setAttribute('aria-controls', panel.id);
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const result = document.createElement('p');
    result.className = 'ft-transcription-text';
    const start = button('Baixar e transcrever');
    const cancel = button('Cancelar');
    const copy = button('Copiar');
    const collapse = button('Recolher');
    start.hidden = cancel.hidden = copy.hidden = true;
    panel.append(status, result, start, cancel, copy, collapse);
    root.append(toggle, panel); host.append(root);
    const view = { root, owner, job: null };
    views.add(view);
    mounted.set(owner, view);
    function release(job) {
      if (!job) return;
      job.controller.abort();
      clearTimeout(job.timeout); clearInterval(job.watch);
      job.port?.postMessage({ id: job.id, type: 'cancel' });
      job.port?.close(); job.frame?.remove();
      runtime.sendMessage({ type: 'ft-transcription-revoke', id: job.id }).catch(() => {});
      if (active === job) active = null;
      if (view.job === job) view.job = null;
      cancel.hidden = true;
    }
    function fail(job, text) {
      if (view.job !== job) return;
      status.textContent = text;
      release(job);
      start.textContent = 'Tentar novamente'; start.hidden = false;
      start.onclick = begin;
    }
    async function begin() {
      if (view.job) return;
      if (active) {
        status.textContent = 'Já existe uma transcrição nesta aba. Aguarde ou cancele a anterior.';
        start.textContent = 'Tentar novamente'; start.hidden = false; start.onclick = begin;
        return;
      }
      const job = { id: crypto.randomUUID(), controller: new AbortController() };
      active = view.job = job;
      status.textContent = 'Preparando transcrição local...';
      result.textContent = ''; copy.hidden = start.hidden = true; cancel.hidden = false;
      job.watch = setInterval(prune, 250);
      job.timeout = setTimeout(() => fail(job, 'Não foi possível iniciar a transcrição. Recarregue a página e tente novamente.'), 20000);
      try {
        const auth = await runtime.sendMessage({ type: 'ft-transcription-register', id: job.id });
        if (view.job !== job) return;
        if (!auth?.token) throw new Error('A transcrição não está disponível nesta página.');
        const frame = document.createElement('iframe');
        job.frame = frame;
        frame.hidden = true; frame.title = 'Motor de transcrição local';
        frame.src = runtime.getURL(`transcription/frame.html#${job.id}`);
        frame.onload = () => {
          if (view.job !== job) return;
          const channel = new MessageChannel();
          job.port = channel.port1;
          async function process() {
            if (view.job !== job || job.started) return;
            job.started = true; start.hidden = true;
            status.textContent = 'Acessando áudio...';
            job.timeout = setTimeout(() => fail(job, 'O processamento excedeu 15 minutos. Tente um áudio menor.'), 15 * 60 * 1000);
            try {
              const source = await getSource(job.controller.signal);
              if (view.job !== job) return;
              let buffer;
              if (source instanceof Blob) {
                if (!source.size || source.size > MAX_BYTES) throw new Error('Selecione um áudio não vazio de até 25 MB.');
                buffer = await source.arrayBuffer();
              } else if (/^(blob:|data:)/.test(source)) {
                const response = await fetch(source, { signal: job.controller.signal });
                const blob = await response.blob();
                if (!blob.size || blob.size > MAX_BYTES) throw new Error('Selecione um áudio não vazio de até 25 MB.');
                buffer = await blob.arrayBuffer();
              }
              if (view.job !== job) return;
              job.port.postMessage({ id: job.id, type: 'start', ...(buffer ? { buffer } : { url: source }) }, buffer ? [buffer] : []);
            } catch (error) { fail(job, error.message || 'Não foi possível acessar o áudio.'); }
          }
          channel.port1.onmessage = ({ data }) => {
            if (view.job !== job || data?.id !== job.id || !root.isConnected) return;
            if (data.type === 'ready') {
              clearTimeout(job.timeout);
              if (data.cached) process();
              else {
                status.textContent = 'No primeiro uso, baixe aproximadamente 41 MB de modelo, mais arquivos auxiliares. O áudio será transcrito neste computador e o modelo ficará em cache.';
                start.textContent = 'Baixar e transcrever'; start.hidden = false; start.onclick = process;
              }
            } else if (data.type === 'status') status.textContent = data.text;
            else if (data.type === 'error') fail(job, data.text);
            else if (data.type === 'result') {
              result.textContent = data.text; status.textContent = 'Transcrição concluída. Revise o texto antes de usar.';
              copy.hidden = false; release(job);
            }
          };
          frame.contentWindow.postMessage({ type: 'ft-transcription-connect', id: job.id, token: auth.token }, runtime.getURL('').replace(/\/$/, ''), [channel.port2]);
        };
        panel.append(frame);
      } catch (error) { fail(job, error.message); }
    }
    toggle.onclick = () => {
      panel.hidden = false; toggle.setAttribute('aria-expanded', 'true');
      if (!result.textContent) begin();
    };
    cancel.onclick = () => {
      release(view.job); status.textContent = 'Transcrição cancelada.';
      start.textContent = 'Tentar novamente'; start.hidden = false; start.onclick = begin;
    };
    collapse.onclick = () => { release(view.job); panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); };
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(result.textContent); status.textContent = 'Texto copiado.'; }
      catch { status.textContent = 'Não foi possível copiar. Selecione o texto e copie manualmente.'; }
    };
    view.dispose = () => { release(view.job); root.remove(); views.delete(view); mounted.delete(owner); };
  }
  function prune() {
    for (const view of views) if (!view.root.isConnected || !view.owner.isConnected) view.dispose();
  }
  globalThis.FreshToolsTranscription = { mount, prune };
})();
