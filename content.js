(() => {
  "use strict";

  const BUTTON_ID = "fd-copy-ai-conversation";
  const MENU_SELECTOR = '[data-test-id="hamburger-menu"]';
  const MESSAGE_SELECTOR = "li.user-messages";
  const TEXT_SELECTORS = [
    ".fc-ui-emoji-text",
    ".fc-ui-unity-message .text",
    ".fc-ui-message-bubble .text"
  ];

  function cleanText(value) {
    return value
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function findMessageText(message) {
    for (const selector of TEXT_SELECTORS) {
      const element = message.querySelector(selector);
      const text = element ? cleanText(element.innerText || element.textContent || "") : "";
      if (text) return text;
    }
    return "";
  }

  function getConversationTitle() {
    const topic = document.querySelector('[data-test-id="topic-name"], .topic-name');
    return topic ? cleanText(topic.innerText || topic.textContent || "") : "";
  }

  function collectMessages() {
    return Array.from(document.querySelectorAll(MESSAGE_SELECTOR))
      .map((message) => {
        const text = findMessageText(message);
        if (!text) return null;

        const isAgent = message.classList.contains("fc-agent-message");
        const isClient = Boolean(message.querySelector(".user-message"));
        return {
          author: isAgent ? "AGENTE" : isClient ? "CLIENTE" : "CLIENTE",
          text
        };
      })
      .filter(Boolean);
  }

  function messageSignature(message) {
    return `${message.author}\u0000${message.text}`;
  }

  function mergeOlderMessages(older, current) {
    if (!current.length) return older;
    if (!older.length) return current;

    const olderKeys = older.map(messageSignature);
    const currentKeys = current.map(messageSignature);
    const maximumOverlap = Math.min(olderKeys.length, currentKeys.length);

    for (let size = maximumOverlap; size > 0; size -= 1) {
      const olderStart = olderKeys.length - size;
      let matches = true;
      for (let index = 0; index < size; index += 1) {
        if (olderKeys[olderStart + index] !== currentKeys[index]) {
          matches = false;
          break;
        }
      }
      if (matches) return [...older, ...current.slice(size)];
    }

    return [...older, ...current];
  }

  function findScrollContainer() {
    const firstMessage = document.querySelector(MESSAGE_SELECTOR);
    let element = firstMessage?.parentElement || null;

    while (element && element !== document.body) {
      const style = getComputedStyle(element);
      const scrollable = /(auto|scroll)/.test(style.overflowY);
      if (scrollable && element.scrollHeight > element.clientHeight + 20) return element;
      element = element.parentElement;
    }

    return document.scrollingElement;
  }

  function waitForLoading(delay = 50) {
    return new Promise((resolve) => window.setTimeout(resolve, delay));
  }

  async function loadEntireConversation(button) {
    const scroller = findScrollContainer();
    let messages = collectMessages();
    if (!scroller || !messages.length) return messages;

    const distanceFromBottom = Math.max(
      0,
      scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop
    );
    let stableAtTop = 0;
    let previousHeight = scroller.scrollHeight;
    let previousCount = messages.length;

    try {
      for (let attempt = 0; attempt < 400; attempt += 1) {
        button.title = `Carregando: ${messages.length} mensagens...`;
        button.setAttribute("aria-label", button.title);

        scroller.scrollTop = 0;
        await waitForLoading();

        const visibleMessages = collectMessages();
        messages = mergeOlderMessages(visibleMessages, messages);

        const atTop = scroller.scrollTop <= 2;
        const unchanged =
          scroller.scrollHeight === previousHeight && messages.length === previousCount;
        stableAtTop = atTop && unchanged ? stableAtTop + 1 : 0;

        previousHeight = scroller.scrollHeight;
        previousCount = messages.length;
        if (stableAtTop >= 20) break;
      }
    } finally {
      scroller.scrollTop = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight - distanceFromBottom
      );
    }

    return messages;
  }

  function formatConversation(messages) {
    const title = getConversationTitle();
    const header = [
      "CONVERSA DO FRESHDESK",
      title ? `Tópico: ${title}` : "",
      `Mensagens: ${messages.length}`,
      ""
    ].filter((line, index) => line || index === 3);

    const body = messages.map(({ author, text }) => `[${author}]\n${text}`).join("\n\n");
    return `${header.join("\n")}\n${body}`.trim();
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (!copied) throw new Error("Não foi possível acessar a área de transferência.");
    }
  }

  function showStatus(button, label, state = "success") {
    const originalLabel = "Copiar conversa";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.dataset.state = state;
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.setAttribute("aria-label", originalLabel);
      button.title = originalLabel;
      delete button.dataset.state;
    }, 2200);
  }

  async function handleCopy(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    button.dataset.state = "loading";

    try {
      const messages = await loadEntireConversation(button);
      if (!messages.length) {
        showStatus(button, "Nenhuma mensagem", "error");
        return;
      }
      await writeClipboard(formatConversation(messages));
      showStatus(button, `${messages.length} copiadas`);
    } catch (error) {
      console.error("Freshdesk Copiar conversa:", error);
      showStatus(button, "Erro ao copiar", "error");
    } finally {
      button.disabled = false;
    }
  }

  function createButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "fd-copy-ai-button";
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1 1 0 0 0 0-1.42l-2.5-2.5a1 1 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-1.79z"/>
      </svg>`;
    button.title = "Copiar conversa";
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", handleCopy);
    return button;
  }

  function installButton() {
    const menu = document.querySelector(MENU_SELECTOR);
    if (!menu) return;
    const menuContainer = menu.parentElement;
    if (!menuContainer) return;

    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      if (existing.nextElementSibling !== menuContainer) menuContainer.before(existing);
      return;
    }

    menuContainer.before(createButton());
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      installButton();
    });
  });

  installButton();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
