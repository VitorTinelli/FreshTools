const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadFeedback(writeText) {
  const elements = new Map();
  const timers = [];
  const document = {
    body: {
      appendChild(element) {
        if (element.id) elements.set(element.id, element);
        element.isConnected = true;
      }
    },
    createElement() {
      return {
        hidden: false,
        style: {},
        setAttribute() {},
        remove() { this.isConnected = false; },
        select() {}
      };
    },
    execCommand: () => false,
    getElementById: (id) => elements.get(id) || null
  };
  const context = {
    clearTimeout() {},
    document,
    globalThis: null,
    navigator: { clipboard: { writeText } },
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    }
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("Chromium/vocaroo-feedback.js", "utf8"), context);
  return { feedback: context.FreshToolsVocarooFeedback, elements, timers };
}

test("copies a Vocaroo link and shows a five-second notification", async () => {
  const copied = [];
  const { feedback, elements, timers } = loadFeedback(async (value) => copied.push(value));

  await feedback.copyLink("https://voca.ro/abcdefghij");

  assert.deepEqual(copied, ["https://voca.ro/abcdefghij"]);
  const toast = elements.get("ft-vocaroo-toast");
  assert.equal(toast.textContent, "Link do Vocaroo copiado para a área de transferência");
  assert.equal(toast.hidden, false);
  assert.equal(timers[0].delay, 5000);
  timers[0].callback();
  assert.equal(toast.hidden, true);
});

test("does not copy an invalid Vocaroo link", async () => {
  const copied = [];
  const { feedback } = loadFeedback(async (value) => copied.push(value));

  await assert.rejects(feedback.copyLink("https://example.com/audio"), /link inválido/);
  assert.deepEqual(copied, []);
});
