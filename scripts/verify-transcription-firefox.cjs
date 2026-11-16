// Tests the installed Firefox through a local geckodriver on port 4447.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const createFixture = require('./transcription-fixture.cjs');
const output = path.resolve('dist/transcription-verification');
const voice = fs.readFileSync(path.join(output, 'voice.wav')).toString('base64');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let session;
async function request(endpoint, body, method = 'POST') {
  const response = await fetch(`http://127.0.0.1:4447${endpoint}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) });
  const result = await response.json();
  if (result.value?.error) throw new Error(JSON.stringify(result.value));
  return result.value;
}
const execute = (script, args = []) => request(`/session/${session}/execute/sync`, { script, args });
(async () => {
  const info = await request('/session', { capabilities: { alwaysMatch: {
    browserName: 'firefox', pageLoadStrategy: 'eager', 'moz:firefoxOptions': { args: ['-headless', '--allow-system-access'], prefs: { 'media.autoplay.default': 0, 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } }
  } } });
  session = info.sessionId;
  console.log('FIREFOX', info.capabilities.browserVersion);
  try {
    await request(`/session/${session}/moz/addon/install`, { path: path.join(output, 'firefox.zip'), temporary: true });
    await request(`/session/${session}/url`, { url: 'https://www.freshworks.com/' });
    const report = [];
    await execute(`document.body.innerHTML = '<main style="max-width:600px;margin:40px;font:16px system-ui"><h1>FreshTools — teste local Firefox</h1><div id="fixture"></div></main>'`);
    for (const [seconds, offline] of [[30, false], [30, true], ...(process.env.LONG_AUDIO === '1' ? [[120, false], [300, false]] : [])]) {
      await request(`/session/${session}/execute/async`, { script: `const done = arguments[arguments.length - 1]; (${createFixture.toString()})(arguments[0]).then(() => done(true), e => done({error:e.message}));`, args: [{ voice, seconds, noise: seconds === 120 }] });
      if (offline) {
        await request(`/session/${session}/moz/context`, { context: 'chrome' });
        await execute('Services.io.offline = true');
        await request(`/session/${session}/moz/context`, { context: 'content' });
      }
      for (let i = 0; i < 30; i++) {
        if (await execute("return !!document.querySelector('.ft-transcription button')")) break;
        await sleep(1000);
      }
      assert.ok(await execute("return !!document.querySelector('.ft-transcription button')"), 'content script must add Transcrever');
      await execute("document.querySelector('.ft-transcription button').click()");
      const start = Date.now(); let last = '';
      for (let i = 0; i < 900; i++) {
        const state = await execute(`
          const buttons = [...document.querySelectorAll('.ft-transcription button')];
          const download = buttons.find(b => b.textContent === 'Baixar e transcrever' && !b.hidden);
          if (download) download.click();
          return { status: document.querySelector('.ft-transcription [role=status]').textContent, retry: buttons.some(b=>b.textContent==='Tentar novamente'&&!b.hidden), text: document.querySelector('.ft-transcription-text').textContent };
        `);
        if (state.status !== last) { console.log(state.status); last = state.status; }
        if (state.retry) throw new Error(state.status);
        if (state.text) { report.push({ seconds, offline, elapsedSeconds: (Date.now() - start) / 1000, text: state.text }); break; }
        await sleep(1000);
      }
      assert.ok(report.length);
      const screenshot = await request(`/session/${session}/screenshot`, null, 'GET');
      fs.writeFileSync(path.join(output, `firefox-${seconds}${offline ? '-offline' : ''}.png`), Buffer.from(screenshot, 'base64'));
      await request(`/session/${session}/moz/context`, { context: 'chrome' });
      await execute('Services.io.offline = false');
      await request(`/session/${session}/moz/context`, { context: 'content' });
    }
    fs.writeFileSync(path.join(output, 'firefox-report.json'), JSON.stringify(report, null, 2));
    console.log('RESULT', JSON.stringify(report));
  } finally { await request(`/session/${session}`, null, 'DELETE'); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
