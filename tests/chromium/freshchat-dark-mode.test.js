const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync("src/common/content/freshchat-dark-mode.js", "utf8");

function classList() {
  const values = new Set();
  return { add: (value) => values.add(value), contains: (value) => values.has(value) };
}

function createHarness(hostname = "widget.freshchat.com", referrer = "") {
  const elements = new Map();
  const headChildren = [];
  const documentElement = { classList: classList() };
  const document = {
    readyState: "complete",
    referrer,
    documentElement,
    defaultView: { location: { hostname } },
    head: { appendChild(element) { headChildren.push(element); elements.set(element.id, element); } },
    createElement(tagName) { return { tagName, id: "", textContent: "" }; },
    getElementById(id) { return elements.get(id) || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  class MutationObserver { observe() {} }
  const context = { document, globalThis: null, MutationObserver, URL };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return { api: context.FreshToolsFreshchatDarkMode, document, headChildren };
}

function declarationsFor(css, needle) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`[^{}]*${escaped}[^{}]*\\{([^{}]+)\\}`));
  assert.ok(match, `regra ausente para ${needle}`);
  return Object.fromEntries(
    match[1].split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const separator = part.indexOf(":");
      return [part.slice(0, separator).trim(), part.slice(separator + 1).replace(/!important/g, "").trim()];
    })
  );
}

test("injects once, only in a verified Freshchat document", () => {
  const freshchat = createHarness();
  assert.equal(freshchat.headChildren.length, 1);
  assert.equal(freshchat.document.documentElement.classList.contains("ft-freshchat-dark"), true);
  assert.equal(freshchat.api.inject(freshchat.document), true);
  assert.equal(freshchat.headChildren.length, 1);

  const unrelated = createHarness("example.com");
  assert.equal(unrelated.headChildren.length, 0);
  assert.equal(unrelated.document.documentElement.classList.contains("ft-freshchat-dark"), false);
});

test("accepts the scoped WhatsApp integration iframe only with a Freshworks referrer", () => {
  const trusted = createHarness(
    "d3h0owdjgzys62.cloudfront.net",
    "https://tenant.myfreshworks.com/crm/messaging/inbox"
  );
  assert.equal(trusted.headChildren.length, 1);
  assert.equal(trusted.document.documentElement.classList.contains("ft-freshchat-dark"), true);

  const unrelated = createHarness(
    "d3h0owdjgzys62.cloudfront.net",
    "https://example.com/embedded"
  );
  assert.equal(unrelated.headChildren.length, 0);
});

test("visual contract covers launcher, header, history, send, receive, composer, FAQ and scrollbar", () => {
  const { CSS } = createHarness().api;
  const expected = [
    [".fc-launcher", "#7c3aed", "#f8fafc"],
    [".chat-header", "#111827", "#f8fafc"],
    [".messages-container", "#0f172a", "#f8fafc"],
    [".agent-message", "#1e293b", "#f8fafc"],
    [".outgoing-message", "#6d28d9", "#f8fafc"],
    [".composer", "#111827", "#f8fafc"],
    [".faq-container", "#0f172a", "#f8fafc"],
    [".faq-item", "#111827", "#f8fafc"],
    ["::-webkit-scrollbar-track", "#111827", undefined],
    ["::-webkit-scrollbar-thumb", "#475569", undefined]
  ];
  for (const [selector, background, color] of expected) {
    const rule = declarationsFor(CSS, selector);
    assert.equal(rule["background-color"], background, `${selector} background-color`);
    if (color) assert.equal(rule.color, color, `${selector} color`);
  }
});

test("visual contract covers the complete Agent Dashboard", () => {
  const { CSS, SHADOW_CSS } = createHarness().api;
  const structuralReset = declarationsFor(CSS, ":is(div, section");
  assert.equal(structuralReset["background-color"], "transparent");
  assert.equal(structuralReset.color, "#e2e8f0");
  const dashboardText = declarationsFor(CSS, ":is(h1, h2");
  assert.equal(dashboardText.color, "#e2e8f0");
  assert.match(CSS, /--lt-color-background-default:\s*#111827/);
  assert.match(CSS, /--lt-color-text-default:\s*#e2e8f0/);
  const privateNote = declarationsFor(CSS, ".note-bubble .fc-ui-message-bubble.comment");
  assert.equal(privateNote.background, "#3b2a12");
  assert.equal(privateNote.color, "#fef3c7");
  assert.match(source, /function normalizePrivateNotes/);
  assert.match(source, /note\.style\.setProperty\("background", "#3b2a12", "important"\)/);
  const privateNoteReply = declarationsFor(CSS, ".note-bubble .fc-ui-message-bubble.comment button");
  assert.equal(privateNoteReply.background, "transparent");
  const ticketBody = declarationsFor(CSS, ".note-bubble .body.inside-thread-view");
  assert.equal(ticketBody.background, "transparent");
  const agentChat = declarationsFor(CSS, ".chat-container-wrap:not(.note-bubble) li.user-messages.fc-agent-message");
  assert.equal(agentChat.background, "#1e293b");
  assert.equal(agentChat.color, "#f8fafc");
  const customerChat = declarationsFor(CSS, "li.user-messages:not(.fc-agent-message) .fc-ui-message-bubble.comment.user-message");
  assert.equal(customerChat.background, "#334155");
  assert.equal(customerChat.color, "#f8fafc");
  const viewItem = declarationsFor(CSS, "ul.nav-list > li.filter");
  assert.equal(viewItem.background, "#111827");
  assert.equal(viewItem.color, "#e2e8f0");
  const conversationRow = declarationsFor(CSS, ".conversations :is(.card-container, .nav-container-wrapper)");
  assert.equal(conversationRow["background-color"], "#0f172a");
  const conversationDetails = declarationsFor(CSS, ".conversations .left-pane-convo-details");
  assert.equal(conversationDetails.background, "transparent");
  assert.equal(conversationDetails["box-shadow"], "none");
  const activeConversation = declarationsFor(CSS, ".conversations li.active:has(.card-container)");
  assert.equal(activeConversation.background, "#1e293b");
  assert.equal(activeConversation["border-color"], "#3b82f6");
  const boldText = declarationsFor(CSS, ":is(strong, b, .font-bold, .tw-font-bold)");
  assert.equal(boldText["font-weight"], "700");
  const editorPlaceholder = declarationsFor(CSS, ".msg-reply-box.medium-editor-placeholder::after");
  assert.equal(editorPlaceholder.color, "#94a3b8");
  const bottomGradient = declarationsFor(CSS, ".bottom-gradient");
  assert.equal(bottomGradient.background, "none");
  assert.equal(bottomGradient["box-shadow"], "none");
  const activeNavigation = declarationsFor(CSS, ".unified360-list-item.active");
  assert.equal(activeNavigation.background, "#1e293b");
  assert.equal(activeNavigation["border-color"], "#3b82f6");
  const flatHeaderControls = declarationsFor(CSS, ".navbar-secondary :is(");
  assert.equal(flatHeaderControls.background, "transparent");
  assert.equal(flatHeaderControls["border-color"], "transparent");
  assert.equal(flatHeaderControls["box-shadow"], "none");
  const flatConversationToolbar = declarationsFor(CSS, ".conversations .convo-action > :is(");
  assert.equal(flatConversationToolbar.background, "transparent");
  const flatLogo = declarationsFor(CSS, ".unified360-main-logo .unified360-list-item.active");
  assert.equal(flatLogo.background, "transparent");
  assert.equal(flatLogo["box-shadow"], "none");
  assert.doesNotMatch(CSS, /\[class\*="dropdown" i\]/);
  assert.doesNotMatch(CSS, /\[class\*="header" i\]/);
  const navIcon = declarationsFor(CSS, ".unified360-side-nav-container .unified360-icon");
  assert.equal(navIcon.fill, "#cbd5e1");
  assert.match(CSS, /\.unified360-main-logo[\s\S]{0,500}fill:\s*#f8fafc/);
  const settingsSubmenuSurface = declarationsFor(CSS, ".unified360-submenus-container,");
  assert.equal(settingsSubmenuSurface.background, "#111827");
  assert.match(CSS, /\.unified360-submenus-container\s*\{[\s\S]{0,240}z-index:\s*1200\s*!important/);
  assert.match(CSS, /\.unified360-submenus-container\s*\{[\s\S]{0,240}width:\s*248px\s*!important/);
  assert.match(CSS, /\.unified360-flex-container > \.unified360-menu\s*\{[\s\S]{0,160}z-index:\s*1201\s*!important/);
  assert.match(CSS, /\.unified360-menu\[aria-label="SETTINGS"\][\s\S]{0,220}z-index:\s*1201\s*!important/);
  const submenuTrigger = declarationsFor(CSS, ".unified360-menu > .unified360-list-item");
  assert.equal(submenuTrigger["z-index"], "1201");
  assert.equal(submenuTrigger.visibility, "visible");
  const settingsTrigger = declarationsFor(CSS, ".unified360-menu[aria-label=\"SETTINGS\"] > .unified360-list-item");
  assert.equal(settingsTrigger.background, "transparent");
  const settingsSubmenuTitle = declarationsFor(CSS, ".unified360-submenus-dropdown-title-item");
  assert.equal(settingsSubmenuTitle.background, "#1f2937");
  const assignmentSelector = declarationsFor(CSS, ":is(.assign-group, .assign-agent).ember-power-select-trigger");
  assert.equal(assignmentSelector.background, "transparent");
  assert.equal(assignmentSelector["box-shadow"], "none");
  const metadataRail = declarationsFor(CSS, ".meta-icon");
  assert.equal(metadataRail.background, "transparent");
  const resolutionDivider = declarationsFor(CSS, ".message-status-text .divider.divider-tag");
  assert.equal(resolutionDivider.background, "transparent");
  const csatStars = declarationsFor(CSS, ".star-rating .fa-star.fill");
  assert.equal(csatStars.color, "#fbbf24");
  assert.equal(csatStars["font-size"], "16px");
  const csatResponse = declarationsFor(CSS, "button[data-test-csat-response-slider]");
  assert.equal(csatResponse.background, "transparent");
  const recipientSelector = declarationsFor(CSS, "#switcherSource :is(.dropdown1, #channelInput)");
  assert.equal(recipientSelector.background, "transparent");
  const audioButton = declarationsFor(CSS, "#ft-audio-recorder-button");
  assert.equal(audioButton.background, "transparent");
  const loadMore = declarationsFor(CSS, ":is(.load-more, [data-test-loadmore])");
  assert.equal(loadMore.background, "transparent");
  assert.equal(loadMore.color, "#cbd5e1");
  const loadMoreLink = declarationsFor(CSS, ".messages .load-more > a");
  assert.equal(loadMoreLink.background, "transparent");
  assert.equal(loadMoreLink.color, "#cbd5e1");
  const compactAvatar = declarationsFor(CSS, ".logged-user .user-image");
  assert.equal(compactAvatar.height, "32px");
  const bellIcon = declarationsFor(CSS, ".notifications-icon :is(i, svg, svg use)");
  assert.equal(bellIcon.color, "#cbd5e1");
  const privateNoteTab = declarationsFor(CSS, ".private-note-tab.active");
  assert.equal(privateNoteTab.background, "#1e293b");
  assert.equal(privateNoteTab.color, "#fbbf24");
  const generatedButton = declarationsFor(CSS, ".filter-link.toggle-button-sla");
  assert.equal(generatedButton.background, "#1f2937");
  assert.equal(generatedButton["background-image"], "none");
  const selectedFilter = declarationsFor(CSS, ".filter-option.selected");
  assert.equal(selectedFilter.background, "#1e3a5f");
  const selectedAgent = declarationsFor(CSS, "li.ember-power-select-option.selected-option");
  assert.equal(selectedAgent.background, "#1e3a5f");
  assert.equal(selectedAgent.color, "#f8fafc");
  const keyboardKey = declarationsFor(CSS, ".key");
  assert.equal(keyboardKey.background, "#334155");
  const themedAvatar = declarationsFor(CSS, ".avatar-content-wrap[class*=\"avatar-theme\"]");
  assert.equal(themedAvatar["background-color"], "#334155");
  assert.equal(themedAvatar.color, "#f8fafc");
  assert.match(SHADOW_CSS, /\[role="combobox"\]/);
  assert.match(SHADOW_CSS, /background-color:\s*#1f2937\s*!important/);
  assert.match(SHADOW_CSS, /\.freshworks-user-avatar\s*\{/);
  assert.match(SHADOW_CSS, /object-fit:\s*cover\s*!important/);
  assert.match(SHADOW_CSS, /\[part="fw-select-input-container"\]/);
  assert.match(SHADOW_CSS, /\.field-control-label[\s\S]{0,160}color:\s*#cbd5e1\s*!important/);
  assert.match(SHADOW_CSS, /:host-context\(\.logged-user\)/);

  const expected = [
    ["[role=\"main\"]", "#0f172a", "#f8fafc"],
    ["[role=\"navigation\"]", "#111827", "#f8fafc"],
    ["[role=\"banner\"]", "#111827", "#f8fafc"],
    ["[role=\"dialog\"]", "#1f2937", "#f8fafc"],
    ["[role=\"menuitem\"]", "#111827", "#f8fafc"],
    ["[aria-selected=\"true\"]", "#1e293b", "#f8fafc"],
    ["input", "#1f2937", "#f8fafc"],
    ["button", "#1f2937", "#f8fafc"],
    [":is(table, thead", "#111827", "#f8fafc"],
    ["[class*=\"empty\" i]", "#0f172a", "#cbd5e1"]
  ];
  for (const [selector, background, color] of expected) {
    const rule = declarationsFor(CSS, selector);
    assert.equal(rule["background-color"], background, `${selector} background-color`);
    assert.equal(rule.color, color, `${selector} color`);
  }
});

test("manifest isolates the external integration to the dark-mode script", () => {
  for (const target of ["chromium", "firefox"]) {
    const manifest = JSON.parse(fs.readFileSync(`src/manifests/${target}.json`, "utf8"));
    const integration = manifest.content_scripts.find(({ matches }) =>
      matches.includes("https://d3h0owdjgzys62.cloudfront.net/*")
    );
    assert.deepEqual(integration.js, ["content/freshchat-dark-mode.js"]);
    assert.equal(integration.all_frames, true);
  }
});

test("simulates opening the chat, sending and receiving a message", () => {
  const { CSS } = createHarness().api;
  const widget = { open: false, messages: [] };
  widget.open = true;
  widget.messages.push({ direction: "sent", text: "Olá" });
  widget.messages.push({ direction: "received", text: "Como posso ajudar?" });

  assert.equal(widget.open, true);
  assert.deepEqual(widget.messages.map(({ direction }) => direction), ["sent", "received"]);
  const sent = declarationsFor(CSS, ".outgoing-message");
  const received = declarationsFor(CSS, ".agent-message");
  assert.equal(sent["background-color"], "#6d28d9");
  assert.equal(sent.color, "#f8fafc");
  assert.equal(received["background-color"], "#1e293b");
  assert.equal(received.color, "#f8fafc");
});

test("all non-variable CSS rules remain scoped to Freshchat markers", () => {
  const { CSS } = createHarness().api;
  const withoutComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...withoutComments.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((match) => match[1].trim());
  for (const selectors of rules.filter((value) => value !== ":root")) {
    assert.match(selectors, /^(#fc_widget|#fc_frame|\.fc-widget|\.d-hotline|html\.ft-freshchat-dark)/);
  }
});
