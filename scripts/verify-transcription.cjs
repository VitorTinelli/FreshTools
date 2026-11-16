// Isolated Chromium integration check. Set PLAYWRIGHT_PATH to an installed playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const output = path.resolve('dist/transcription-verification');
fs.mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const extension = path.resolve('dist/chromium');
  const remote = process.env.CDP_URL ? await chromium.connectOverCDP(process.env.CDP_URL) : null;
  const context = remote ? remote.contexts()[0] : await chromium.launchPersistentContext(path.join(output, 'chromium-profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--remote-debugging-port=9337'],
  });
  const page = await context.newPage();
  const errors = [], requests = [], report = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
  context.on('request', (request) => { requests.push({ url: request.url().split('?')[0], method: request.method() }); });
  page.on('console', (message) => { if (message.type() === 'error') console.log('CONSOLE', message.text()); });
  await context.route('https://transcription-test.freshchat.com/**', (route) => route.fulfill({
    contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="pt-BR"><title>FreshTools — teste de transcrição</title><body><main style="max-width:600px;margin:40px;font:16px system-ui"><h1>Transcrição local</h1><div id="fixture"></div></main></body></html>'
  }));
  await page.goto('https://transcription-test.freshchat.com/');
  const voice = fs.readFileSync(path.join(output, 'voice.wav')).toString('base64');
  async function fixture(seconds, noise = false) {
    await page.evaluate(require("./transcription-fixture.cjs"), { voice, seconds, noise });
    await page.getByRole('button', { name: 'Transcrever', exact: true }).waitFor();
  }
  async function transcribe(seconds, noise = false, offline = false) {
    await fixture(seconds, noise);
    const start = Date.now(), requestStart = requests.length;
    let peakWorkingSetsBytes = 0;
    if (offline) await context.setOffline(true);
    await page.getByRole('button', { name: 'Transcrever', exact: true }).click();
    let last = '';
    for (let i = 0; i < 900; i++) {
      const download = page.getByRole('button', { name: 'Baixar e transcrever', exact: true });
      if (await download.isVisible()) await download.click();
      const status = await page.locator('.ft-transcription [role=status]').textContent();
      if (status !== last) { console.log(seconds, status); last = status; }
      if (i % 5 === 0 && remote) {
        const browserSession = await remote.newBrowserCDPSession();
        const processes = await browserSession.send('SystemInfo.getProcessInfo');
        await browserSession.detach();
        const ids = processes.processInfo.map(p => Number(p.id)).filter(Number.isInteger);
        try {
          const bytes = Number(execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum`], { windowsHide: true }).toString().trim());
          peakWorkingSetsBytes = Math.max(peakWorkingSetsBytes, bytes);
        } catch { /* Timing evidence remains useful when process counters are unavailable. */ }
      }
      if (await page.getByRole('button', { name: 'Tentar novamente', exact: true }).isVisible()) throw new Error(status);
      if (status.startsWith('Transcrição concluída')) break;
      await sleep(1000);
    }
    const result = await page.locator('.ft-transcription-text').textContent();
    assert.ok(result.length, 'transcript must not be empty');
    const cdp = await context.newCDPSession(page);
    const heap = await cdp.send('Runtime.getHeapUsage');
    await cdp.detach();
    const entry = { seconds, noise, offline, elapsedSeconds: (Date.now() - start) / 1000, text: result, pageHeapBytes: heap.usedSize, peakWorkingSetsBytes, requests: requests.slice(requestStart) };
    report.push(entry); console.log('RESULT', JSON.stringify({ ...entry, requests: entry.requests.length }));
    await page.screenshot({ path: path.join(output, `chromium-${seconds}${offline ? '-offline' : ''}.png`) });
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.ft-transcription [role=status]').textContent === 'Texto copiado.');
    await page.getByRole('button', { name: 'Recolher', exact: true }).click();
    assert.equal(await page.locator('.ft-transcription > div').isVisible(), false);
  }
  try {
    await transcribe(1);
    await transcribe(30);
    await transcribe(30, false, true);
    if (process.env.LONG_AUDIO === '1') { await transcribe(120, true); await transcribe(300); }
    assert.ok(!requests.some((r) => /huggingface|hf\.co/.test(r.url) && r.method !== 'GET'), 'model host must only receive GET');
    fs.writeFileSync(path.join(output, 'chromium-report.json'), JSON.stringify({ report, errors }, null, 2));
  } finally { await context.close(); await remote?.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
