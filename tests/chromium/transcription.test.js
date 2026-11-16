const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const core = import('../../src/common/transcription/core.mjs');

test('transcription rejects empty, oversized and overlong audio', async () => {
  const { validateSize, validateDuration, MAX_BYTES } = await core;
  assert.equal(MAX_BYTES, 25 * 1024 * 1024);
  assert.doesNotThrow(() => validateSize(25 * 1024 * 1024));
  assert.doesNotThrow(() => validateDuration(300));
  for (const size of [-1, 0, NaN, Infinity]) assert.throws(() => validateSize(size), /vazio/);
  assert.throws(() => validateSize(25 * 1024 * 1024 + 1), /25 MB/);
  for (const duration of [-1, 0, NaN, Infinity]) assert.throws(() => validateDuration(duration), /duração/);
  assert.throws(() => validateDuration(300.01), /5 minutos/);
});

test('audio download enforces actual stream size and cancels oversized bodies', async () => {
  const { readAudio, MAX_BYTES } = await core;
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(MAX_BYTES)); controller.enqueue(new Uint8Array(1)); },
    cancel() { cancelled = true; }
  }));
  await assert.rejects(readAudio(response), /25 MB/);
  assert.equal(cancelled, true);
  await assert.rejects(readAudio(new Response('', { status: 403 })), /403/);
  await assert.rejects(readAudio(new Response('video', { headers: { 'content-type': 'video/mp4' } })), /áudio/);
  assert.deepEqual(new Uint8Array(await readAudio(new Response(new Uint8Array([1, 2])))), new Uint8Array([1, 2]));
});

function broker() {
  let listener;
  const timers = [];
  const runtime = { id: 'extension', getURL: (path) => `chrome-extension://extension/${path}`, onMessage: { addListener(fn) { listener = fn; } } };
  vm.runInNewContext(fs.readFileSync('src/common/background/transcription.js', 'utf8'), {
    chrome: { runtime }, crypto: { randomUUID }, URL, setTimeout: (fn) => timers.push(fn)
  });
  const id = randomUUID();
  const content = { id: runtime.id, frameId: 0, tab: { id: 4 }, url: 'https://app.freshchat.com/conversation' };
  const frame = { ...content, frameId: 7, url: runtime.getURL(`transcription/frame.html#${id}`) };
  function send(type, sender = content, requestId = id) {
    let response;
    listener({ type: `ft-transcription-${type}`, id: requestId }, sender, (value) => { response = value; });
    return response;
  }
  return { send, content, frame, timers };
}

test('handshake only releases a token to the matching extension frame in the same tab', () => {
  const { send, content, frame } = broker();
  assert.equal(send('register', { ...content, url: 'https://evil.example/' }), undefined);
  assert.equal(send('register', { ...content, id: 'other-extension' }), undefined);
  assert.equal(send('register', { ...content, frameId: 7 }), undefined);
  const ticket = send('register');
  assert.ok(ticket.token);
  assert.equal(send('claim', { ...frame, tab: { id: 9 } }), null);
  assert.equal(send('claim', frame, randomUUID()), undefined);
  assert.equal(send('claim', { ...frame, id: 'other-extension' }), undefined);
  assert.equal(send('claim', { ...frame, url: content.url }), undefined);
  assert.equal(send('claim', frame).token, ticket.token);
  assert.equal(send('claim', frame), null);
});

test('revocation, expiry and retry cannot release a stale handshake', () => {
  const { send, frame, timers } = broker();
  const first = send('register');
  send('revoke');
  assert.equal(send('claim', frame), null);
  const second = send('register');
  assert.notEqual(first.token, second.token);
  timers[0]();
  assert.equal(send('claim', frame).token, second.token);
  send('register'); timers.at(-1)();
  assert.equal(send('claim', frame), null);
});
