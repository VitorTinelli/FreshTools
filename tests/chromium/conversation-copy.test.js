const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function loadConversation(platform, title = "") {
  const source = fs.readFileSync(`src/platforms/${platform}/content/index.js`, "utf8");
  const boundary = source.indexOf("  let scheduled = false;");
  assert.notEqual(boundary, -1, "Conversation initialization boundary was not found");
  const context = {
    document: { querySelector: () => title ? { textContent: title } : null },
    window: { location: { href: "https://account.freshchat.com/chat/123" } }
  };
  vm.runInNewContext(
    source.slice(0, boundary) +
      "globalThis.api = { formatConversation, mergeOlderMessages, getAgentName }; })();",
    context
  );
  return context.api;
}

// Both entry points ship independently; exercise the output contract of each.
for (const platform of ["chromium", "firefox"]) {
  test(`${platform}: resolves the agent from its own group header outside the message`, () => {
    const { getAgentName } = loadConversation(platform);
    // DOM API doubles based on the supplied Freshdesk HTML:
    // .chat-container-wrap > .user-name > .name is a sibling of .chat-container.
    // The li itself contains no author element.
    for (const name of ["Agente Exemplo Um", "Agente Exemplo Dois", "Atendimento - Exemplo"]) {
      const header = { textContent: "\n    " + name + "\n    " };
      const group = {
        querySelector(selector) {
          assert.equal(selector, ":scope > .user-name .name");
          return header;
        }
      };
      const message = {
        closest(selector) {
          assert.equal(selector, ".chat-container-wrap");
          return group;
        },
        querySelector: () => null
      };
      assert.equal(getAgentName(message), name);
    }
    // A nameless group must never inherit the previous agent's name.
    assert.equal(getAgentName({
      closest: () => ({ querySelector: () => null, matches: () => false }),
      querySelector: () => null
    }), "");
    assert.equal(getAgentName({ closest: () => null, querySelector: () => null }), "");
  });

  test(`${platform}: inherits the author only within an unfinished agent group`, () => {
    const { getAgentName } = loadConversation(platform);
    // Minimal DOM API fixtures reproduce the group markers in the supplied HTML.
    function row(name, { start = false, middle = false, end = false, client = false } = {}, previous = null) {
      const header = name ? { textContent: name } : null;
      const wrap = {
        matches: selector => selector === ".grp-middle" && middle,
        querySelector(selector) {
          if (selector === ":scope > .user-name .name") return header;
          if (selector === ".chat-container.grp-started") return start ? {} : null;
          if (selector === ".chat-container.grp-ended") return end ? {} : null;
          return null;
        }
      };
      const element = {
        previousElementSibling: previous,
        matches: selector => selector === ".inbox-convo-chat",
        querySelector(selector) {
          if (selector === ".chat-container-wrap") return wrap;
          if (selector === "li.fc-agent-message") return client ? null : message;
          return null;
        }
      };
      const message = {
        querySelector: () => null,
        closest: selector => selector === ".chat-container-wrap" ? wrap : selector === ".inbox-convo-chat" ? element : null
      };
      return { element, message };
    }
    const alessandro = row("Agente Exemplo Um", { start: true });
    const middle = row("", { middle: true }, alessandro.element);
    const end = row("", { end: true }, middle.element);
    assert.equal(getAgentName(middle.message), "Agente Exemplo Um");
    assert.equal(getAgentName(end.message), "Agente Exemplo Um");

    const afonso = row("Agente Exemplo Dois", { start: true }, end.element);
    assert.equal(getAgentName(row("", { end: true }, afonso.element).message), "Agente Exemplo Dois");
    // Do not cross a completed group, a new group start, a customer, or a DOM separator.
    assert.equal(getAgentName(row("", { end: true }, end.element).message), "");
    assert.equal(getAgentName(row("", { start: true, end: true }, middle.element).message), "");
    const customer = row("Cliente", { client: true }, alessandro.element);
    assert.equal(getAgentName(row("", { end: true }, customer.element).message), "");
    const separator = { matches: () => false, previousElementSibling: alessandro.element };
    assert.equal(getAgentName(row("", { end: true }, separator).message), "");
    assert.equal(getAgentName(row("", { end: true }).message), "");
  });

  test(`${platform}: formats the complete transcript with chat link and named agents`, () => {
    const api = loadConversation(platform, "Estoque");
    const messages = [
      { author: "CLIENTE", text: "Qual a origem dessas saídas?" },
      { author: "AGENTE - Exemplo Um", text: "@APOIO EXEMPLO DOIS\nDescrição: Diferença no estoque\nPode verificar?" },
      { author: "AGENTE - Exemplo Dois", text: "@RESPOSTA EXEMPLO DOIS\nResposta: Anexe as evidências." }
    ];

    assert.equal(api.formatConversation(messages), [
      "CONVERSA DO FRESHDESK",
      "Tópico: Estoque",
      "Link do chat: https://account.freshchat.com/chat/123",
      "Mensagens: 3",
      "",
      "[CLIENTE]",
      "Qual a origem dessas saídas?",
      "",
      "[AGENTE - Exemplo Um]",
      "@APOIO EXEMPLO DOIS",
      "Descrição: Diferença no estoque",
      "Pode verificar?",
      "",
      "[AGENTE - Exemplo Dois]",
      "@RESPOSTA EXEMPLO DOIS",
      "Resposta: Anexe as evidências."
    ].join("\n"));
  });

  test(`${platform}: joins history pages without dropping legitimate repeated messages`, () => {
    const { mergeOlderMessages } = loadConversation(platform);
    const message = text => ({ author: "CLIENTE", text });
    const cases = [
      { older: [], current: ["Fim"], expected: ["Fim"] },
      { older: ["Início"], current: [], expected: ["Início"] },
      { older: ["Início"], current: ["Fim"], expected: ["Início", "Fim"] },
      { older: ["Início", "Sim", "Sim"], current: ["Sim", "Sim", "Fim"], expected: ["Início", "Sim", "Sim", "Fim"] },
      { older: ["Início", "Fim"], current: ["Início", "Fim"], expected: ["Início", "Fim"] }
    ];
    for (const { older, current, expected } of cases) {
      const olderMessages = older.map(message);
      const currentMessages = current.map(message);
      const result = mergeOlderMessages(olderMessages, currentMessages);
      assert.deepEqual(Array.from(result, item => item.text), expected);
      assert.deepEqual(olderMessages.map(item => item.text), older);
      assert.deepEqual(currentMessages.map(item => item.text), current);
    }
  });
}
