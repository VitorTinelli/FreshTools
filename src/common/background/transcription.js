/* Authenticate the short-lived content-script -> extension-frame handshake. */
(() => {
  const api = globalThis.browser || globalThis.chrome;
  const tickets = new Map();
  const allowed = /^https:\/\/[^/]+\.(?:freshdesk|freshchat|freshworks|myfreshworks)\.com(?::443)?\//;
  api.runtime.onMessage.addListener((message, sender, reply) => {
    if (!message?.type?.startsWith('ft-transcription-')) return false;
    const tab = sender.tab?.id;
    if (sender.id !== api.runtime.id || !Number.isInteger(tab)) return false;
    const key = `${tab}:${message.id}`;
    if (message.type === 'ft-transcription-register' && sender.frameId === 0 && allowed.test(sender.url || '') && /^[a-f0-9-]{36}$/.test(message.id || '')) {
      const ticket = { token: crypto.randomUUID(), origin: new URL(sender.url).origin };
      tickets.set(key, ticket);
      setTimeout(() => { if (tickets.get(key) === ticket) tickets.delete(key); }, 30000);
      reply(ticket);
    } else if (message.type === 'ft-transcription-claim' && sender.frameId > 0 && sender.url === api.runtime.getURL(`transcription/frame.html#${message.id}`)) {
      const ticket = tickets.get(key);
      tickets.delete(key);
      reply(ticket || null);
    } else if (message.type === 'ft-transcription-revoke' && sender.frameId === 0 && allowed.test(sender.url || '')) {
      tickets.delete(key);
      reply({ ok: true });
    }
    return false;
  });
})();
