(() => {
  "use strict";

  const STYLE_ID = "ft-freshchat-dark-mode";
  const ROOT_CLASS = "ft-freshchat-dark";
  const FRESHCHAT_HOST = /(^|\.)(freshchat\.com|freshworks\.com|myfreshworks\.com)$/i;
  const FRESHCHAT_INTEGRATION_HOST = /^d3h0owdjgzys62\.cloudfront\.net$/i;
  const WIDGET_SELECTOR = "#fc_widget, #fc_frame, .fc-widget, .d-hotline";

  /* Every selector is rooted in a FreshTools/Freshchat marker. Nothing here can
     style an unrelated host-page element. Keep the hex values in sync with the
     visual-contract test. */
  const CSS = `
:root {
  --ft-fc-canvas: #0f172a;
  --ft-fc-surface: #111827;
  --ft-fc-surface-raised: #1f2937;
  --ft-fc-border: #334155;
  --ft-fc-text: #f8fafc;
  --ft-fc-muted: #cbd5e1;
  --ft-fc-accent: #7c3aed;
  --ft-fc-accent-hover: #6d28d9;
  --ft-fc-received: #1e293b;
  --ft-fc-sent: #6d28d9;
  --ft-fc-focus: #a78bfa;
  --ft-fc-danger: #f87171;
}

/* Host-page launcher and iframe shell. */
#fc_widget, #fc_frame, .fc-widget, .d-hotline,
#fc_widget *, #fc_frame *, .fc-widget *, .d-hotline * {
  color-scheme: dark;
}
#fc_widget .fc-launcher, #fc_widget .d-hotline-launcher,
.fc-widget .fc-launcher, .d-hotline .d-hotline-launcher,
#fc_frame .fc-launcher {
  background-color: #7c3aed !important;
  border-color: #a78bfa !important;
  color: #f8fafc !important;
}
#fc_widget .fc-launcher:hover, #fc_widget .d-hotline-launcher:hover,
.fc-widget .fc-launcher:hover, .d-hotline .d-hotline-launcher:hover {
  background-color: #6d28d9 !important;
}

/* The class is added only after Freshchat provenance is established. */
html.ft-freshchat-dark,
html.ft-freshchat-dark body,
html.ft-freshchat-dark .fc-widget,
html.ft-freshchat-dark .d-hotline,
html.ft-freshchat-dark #fc_widget,
html.ft-freshchat-dark .chat-container,
html.ft-freshchat-dark .conversation-container,
html.ft-freshchat-dark .messenger-body,
html.ft-freshchat-dark .message-list,
html.ft-freshchat-dark .messages-container {
  background-color: #0f172a !important;
  color: #f8fafc !important;
  color-scheme: dark;
}

/* Native Freshworks/Crayons tokens used by controls and open shadow roots. */
html.ft-freshchat-dark {
  --lt-color-background-dark: #0b1220;
  --lt-color-background-default: #111827;
  --lt-color-background-light: #1f2937;
  --lt-color-border-dark: #475569;
  --lt-color-border-default: #334155;
  --lt-color-border-light: #1e293b;
  --lt-color-gray-100: #0f172a;
  --lt-color-gray-200: #111827;
  --lt-color-gray-300: #1e293b;
  --lt-color-gray-400: #334155;
  --lt-color-gray-500: #64748b;
  --lt-color-gray-600: #94a3b8;
  --lt-color-gray-700: #cbd5e1;
  --lt-color-gray-800: #e2e8f0;
  --lt-color-gray-900: #f8fafc;
  --lt-color-overlay-dark: #111827;
  --lt-color-overlay-default: #1f2937;
  --lt-color-text-dark: #f8fafc;
  --lt-color-text-default: #e2e8f0;
  --lt-color-text-light: #cbd5e1;
  --lt-color-text-very-light: #94a3b8;
  --lt-color-transparent: rgb(15 23 42 / 0%);
  --lt-color-white: #111827;
  --tw-ring-offset-color: #0f172a;
}

/* Freshchat Agent Dashboard -------------------------------------------------
   The dashboard changes generated class names frequently. These structural
   rules deliberately use semantic elements and stable ARIA/data attributes,
   but remain gated by html.ft-freshchat-dark, which is only added on verified
   Freshchat/Freshworks origins. Transparent descendants inherit the dark
   canvas; explicit controls and surfaces receive their own elevation. */
html.ft-freshchat-dark body,
html.ft-freshchat-dark #app,
html.ft-freshchat-dark #root,
html.ft-freshchat-dark [data-reactroot],
html.ft-freshchat-dark main,
html.ft-freshchat-dark [role="main"] {
  background-color: #0f172a !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark body :is(div, section, article, aside, nav, header, footer, form, ul, ol) {
  background-color: transparent !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

html.ft-freshchat-dark body :is(h1, h2, h3, h4, h5, h6, p, span, label, strong, small, time) {
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

/* Freshchat paints many layout bands with generated classes. Resetting only
   structural boxes removes those light-theme islands without touching media,
   icons or elements outside the verified dashboard document. */
html.ft-freshchat-dark body :is(main, [role="main"], [role="region"], [role="complementary"]) {
  background-color: #0f172a !important;
  color: #e2e8f0 !important;
}

html.ft-freshchat-dark body .navbar-secondary,
html.ft-freshchat-dark body .header-container {
  background-color: #0b1220 !important;
  border-color: #1e293b !important;
}

html.ft-freshchat-dark body .viewport,
html.ft-freshchat-dark body .conversations,
html.ft-freshchat-dark body .conversations-tour,
html.ft-freshchat-dark body .messages.filtered,
html.ft-freshchat-dark body .pivot-convo-container,
html.ft-freshchat-dark body #conversation-panels,
html.ft-freshchat-dark body [data-test-id="user-meta-data"],
html.ft-freshchat-dark body .user-meta-wrapper,
html.ft-freshchat-dark body .user-data.section {
  background-color: #0f172a !important;
  border-color: #334155 !important;
}

html.ft-freshchat-dark body .conversations,
html.ft-freshchat-dark body [data-test-id="user-meta-data"],
html.ft-freshchat-dark body .user-meta-wrapper {
  background-color: #111827 !important;
}

html.ft-freshchat-dark body .middle-pane-filter,
html.ft-freshchat-dark body .conversation-header,
html.ft-freshchat-dark body .reply-box,
html.ft-freshchat-dark body .reply-box-container {
  background-color: #172033 !important;
  border-color: #334155 !important;
}

/* Conversation rows are one continuous surface, not alternating blue cards. */
html.ft-freshchat-dark body .conversations :is(.card-container, .nav-container-wrapper) {
  background-color: #0f172a !important;
  border-color: #334155 !important;
  box-shadow: none !important;
}
html.ft-freshchat-dark body .conversations .left-pane-convo-details {
  background: transparent !important;
  box-shadow: none !important;
}
html.ft-freshchat-dark body .card-container:hover,
html.ft-freshchat-dark body .card-container.selected,
html.ft-freshchat-dark body .card-container.active {
  background-color: #172033 !important;
}

html.ft-freshchat-dark body :is(.search-label, .search-label::before, .search-label::after) {
  border-color: #94a3b8 !important;
  color: #cbd5e1 !important;
}

html.ft-freshchat-dark body :is(a, [role="link"]) {
  color: #93c5fd !important;
}

html.ft-freshchat-dark body :is(nav, aside, [role="navigation"], [data-test-id*="sidebar"], [data-testid*="sidebar"], [class*="sidebar" i]) {
  background-color: #111827 !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark body :is(
  header, [role="banner"], [data-test-id*="header"], [data-testid*="header"],
  .chat-header, .conversation-header, .modal-header, .drawer-header, .popover-header,
  [class*="topbar" i]
) {
  background-color: #111827 !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark body :is(
  [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"],
  [data-test-id*="modal"], [data-testid*="modal"], [class*="modal" i],
  [class*="popover" i], .dropdown-menu, .dropdown-content,
  .ember-basic-dropdown-content, [class*="drawer" i]
) {
  background-color: #1f2937 !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
  box-shadow: 0 18px 45px rgb(0 0 0 / 45%) !important;
}

html.ft-freshchat-dark body :is(
  [role="menuitem"], [role="option"], [role="tab"],
  [data-test-id*="conversation"], [data-testid*="conversation"],
  [class*="conversation-list" i], [class*="inbox-list" i], [class*="view-list" i],
  [class*="contact-card" i], [class*="customer-card" i], [class*="panel" i], [class*="card" i]
) {
  background-color: #111827 !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark body :is(
  [role="menuitem"], [role="option"], [role="tab"],
  [data-test-id*="conversation"], [data-testid*="conversation"],
  [class*="conversation-list" i], [class*="inbox-list" i], [class*="view-list" i]
):hover {
  background-color: #1f2937 !important;
}

html.ft-freshchat-dark body :is([aria-selected="true"], [aria-current="page"], [data-active="true"]) {
  background-color: #1e293b !important;
  border-color: #3b82f6 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark body :is(input, textarea, select, [contenteditable="true"], [role="textbox"]) {
  background-color: #1f2937 !important;
  border-color: #475569 !important;
  caret-color: #f8fafc !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark body :is(input, textarea)::placeholder {
  color: #cbd5e1 !important;
  opacity: 1 !important;
}

html.ft-freshchat-dark body button {
  background-color: #1f2937 !important;
  background-image: none !important;
  border-color: #475569 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body :is([role="button"], [role="tab"]) {
  background-image: none !important;
}
html.ft-freshchat-dark body button:hover { background-color: #334155 !important; }
html.ft-freshchat-dark body button:disabled { color: #94a3b8 !important; opacity: 0.65; }

html.ft-freshchat-dark body :is(table, thead, tbody, tr, th, td) {
  background-color: #111827 !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body tbody tr:hover td { background-color: #1f2937 !important; }

/* Views drawer: Freshchat declares white directly on each generated LI. */
html.ft-freshchat-dark body ul.nav-list > li.filter,
html.ft-freshchat-dark body ul.nav-list > li.filter.sortable-filter {
  background: #111827 !important;
  border-bottom: 1px solid #1e293b !important;
  color: #e2e8f0 !important;
}
html.ft-freshchat-dark body ul.nav-list > li.filter:hover {
  background: #1e293b !important;
}
html.ft-freshchat-dark body ul.nav-list > li.filter.active,
html.ft-freshchat-dark body ul.nav-list > li.filter[aria-selected="true"] {
  background: #1e293b !important;
  border-color: #3b82f6 !important;
}
html.ft-freshchat-dark body ul.nav-list > li.filter :is(a, div, span) {
  background: transparent !important;
  color: inherit !important;
}
html.ft-freshchat-dark body .add-custom-view {
  background: #0b1220 !important;
  border-top: 1px solid #334155 !important;
}
html.ft-freshchat-dark body .bottom-gradient {
  background: none !important;
  box-shadow: none !important;
  pointer-events: none !important;
}
html.ft-freshchat-dark body .add-custom-view > button {
  background: #1f2937 !important;
  border: 1px solid #475569 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark body :is(.is-visitor, .badge, [class*="badge" i], [class*="tag" i]) {
  background: #334155 !important;
  border-color: #475569 !important;
  color: #e2e8f0 !important;
}

html.ft-freshchat-dark body .unity-compose-editor {
  background: #111827 !important;
  border: 1px solid #475569 !important;
  box-shadow: 0 8px 24px rgb(0 0 0 / 32%) !important;
}
html.ft-freshchat-dark body .msg-reply-box.medium-editor-placeholder::after {
  color: #94a3b8 !important;
  opacity: 1 !important;
}

/* Neutral active states. Blue is reserved for a narrow selection indicator. */
html.ft-freshchat-dark body .unified360-list-item.active,
html.ft-freshchat-dark body .conversations li.active,
html.ft-freshchat-dark body li.active:has(.card-container) {
  background: #1e293b !important;
  border-color: #3b82f6 !important;
  box-shadow: inset 3px 0 0 #3b82f6 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body .conversations li.active:has(.card-container) {
  background: #1e293b !important;
  border-color: #3b82f6 !important;
  box-shadow: inset 3px 0 0 #3b82f6 !important;
}
html.ft-freshchat-dark body .conversations li.active:has(.card-container) :is(.card-container, .nav-container-wrapper) {
  background: transparent !important;
}
html.ft-freshchat-dark body :is(strong, b, .font-bold, .tw-font-bold) {
  color: #f8fafc !important;
  font-weight: 700 !important;
}

/* Structural wrappers whose names contain "header" or "dropdown" are not
   elevated surfaces. They must expose the continuous panel underneath. */
html.ft-freshchat-dark body .navbar-secondary :is(
  .header-container,
  .logged-user.dropdown-toggle
),
html.ft-freshchat-dark body .unified360-main-logo .unified360-list-item.active,
html.ft-freshchat-dark body .conversations .convo-action > :is(
  .dropdown-toggle,
  .dropdown-filter
) {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

/* The dashboard navigation uses SVG <use> symbols with a hard-coded dark fill. */
html.ft-freshchat-dark body .unified360-side-nav-container .unified360-icon,
html.ft-freshchat-dark body .unified360-side-nav-container .unified360-icon use {
  color: #cbd5e1 !important;
  fill: #cbd5e1 !important;
  stroke: none !important;
}
html.ft-freshchat-dark body :is(
  .unified360-main-logo,
  .unified360-list-item.active
) .unified360-icon,
html.ft-freshchat-dark body :is(
  .unified360-main-logo,
  .unified360-list-item.active
) .unified360-icon use {
  color: #f8fafc !important;
  fill: #f8fafc !important;
}

/* Settings and product submenus sit above the inbox, not behind it. */
html.ft-freshchat-dark body .unified360-submenus-container,
html.ft-freshchat-dark body .unified360-submenus-dropdown {
  background: #111827 !important;
  border: 0 !important;
  color: #e2e8f0 !important;
}
html.ft-freshchat-dark body .unified360-submenus-container {
  border-radius: 6px !important;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.38) !important;
  box-sizing: border-box !important;
  max-width: 248px !important;
  min-width: 248px !important;
  width: 248px !important;
  z-index: 1200 !important;
}
html.ft-freshchat-dark body .unified360-submenus-dropdown {
  box-shadow: none !important;
}
/* Every side-nav trigger stays above its own floating submenu on hover. */
html.ft-freshchat-dark body .unified360-flex-container > .unified360-menu {
  position: relative !important;
  z-index: 1201 !important;
}
html.ft-freshchat-dark body .unified360-menu > .unified360-list-item {
  position: relative !important;
  z-index: 1201 !important;
  opacity: 1 !important;
  visibility: visible !important;
}
html.ft-freshchat-dark body .unified360-menu > .unified360-list-item .unified360-icon,
html.ft-freshchat-dark body .unified360-menu > .unified360-list-item .unified360-icon use {
  opacity: 1 !important;
  visibility: visible !important;
}
html.ft-freshchat-dark body .unified360-menu[aria-label="SETTINGS"] > .unified360-list-item {
  background: transparent !important;
  border-color: transparent !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  position: relative !important;
  z-index: 1201 !important;
}
html.ft-freshchat-dark body .unified360-menu[aria-label="SETTINGS"] > .unified360-list-item .unified360-icon,
html.ft-freshchat-dark body .unified360-menu[aria-label="SETTINGS"] > .unified360-list-item .unified360-icon use {
  color: #cbd5e1 !important;
  fill: #cbd5e1 !important;
  opacity: 1 !important;
}
html.ft-freshchat-dark body .unified360-submenus-dropdown-title-item {
  background: #1f2937 !important;
  border-bottom: 1px solid #334155 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body .unified360-submenus-dropdown-item > a,
html.ft-freshchat-dark body .unified360-submenus-dropdown-item-label {
  color: #e2e8f0 !important;
}
html.ft-freshchat-dark body .unified360-submenus-dropdown-item:hover {
  background: #1e293b !important;
}

html.ft-freshchat-dark body :is(.assign-group, .assign-agent).ember-power-select-trigger,
html.ft-freshchat-dark body :is(.assign-group, .assign-agent) .ember-power-select-selected-item {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  color: #e2e8f0 !important;
}
html.ft-freshchat-dark body .assignment-info > button.contains-select2 {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

html.ft-freshchat-dark body .private-note-tab.active,
html.ft-freshchat-dark body .private-note-tab.active .private-note.private-tab-link {
  background: #1e293b !important;
  border-color: #f59e0b !important;
  box-shadow: inset 0 -2px 0 #f59e0b !important;
  color: #fbbf24 !important;
}

html.ft-freshchat-dark body .channel-switcher-selected-source-filter {
  background-color: #1e293b !important;
  border-color: #475569 !important;
}
html.ft-freshchat-dark body .meta-icon {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

html.ft-freshchat-dark body :is(.inapp-notifications, .notifications-icon) {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
html.ft-freshchat-dark body .notifications-icon :is(i, svg, svg use) {
  color: #cbd5e1 !important;
  fill: #cbd5e1 !important;
  stroke: #cbd5e1 !important;
}

html.ft-freshchat-dark body :is(.load-more, [data-test-loadmore]) {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  color: #cbd5e1 !important;
}
html.ft-freshchat-dark body .messages .load-more > a {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  color: #cbd5e1 !important;
}
html.ft-freshchat-dark body .messages .load-more > a :is(.ui-icon, .ui-svg-icon, [class^="path"]) {
  color: #cbd5e1 !important;
  fill: #cbd5e1 !important;
}

html.ft-freshchat-dark body .message-status-text .divider.divider-tag {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
html.ft-freshchat-dark body .star-rating .fa-star.fill {
  color: #fbbf24 !important;
  font-size: 16px !important;
  margin: 0 1px !important;
  text-shadow: 0 0 8px rgb(251 191 36 / 35%) !important;
  vertical-align: -1px !important;
}
html.ft-freshchat-dark body button[data-test-csat-response-slider] {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  color: #cbd5e1 !important;
}

html.ft-freshchat-dark body #switcherSource :is(.dropdown1, #channelInput),
html.ft-freshchat-dark body #ft-audio-recorder-button {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
html.ft-freshchat-dark body img.convo-list-active {
  background: transparent !important;
  box-shadow: none !important;
}

html.ft-freshchat-dark body .state-trigger {
  background: #1e3a5f !important;
  border-color: #3b82f6 !important;
  color: #eff6ff !important;
}

html.ft-freshchat-dark body .send.btn {
  background-image: none !important;
  background-color: #2563eb !important;
  border-color: #3b82f6 !important;
  color: #ffffff !important;
}
html.ft-freshchat-dark body .send.btn.disabled {
  background-color: #334155 !important;
  border-color: #475569 !important;
  color: #94a3b8 !important;
}

html.ft-freshchat-dark body :is(
  .filter-link.toggle-button-sla,
  .collapse-block,
  [data-test-id="hamburger-trigger"]
) {
  background: #1f2937 !important;
  background-image: none !important;
  border-color: #475569 !important;
  box-shadow: none !important;
  color: #e2e8f0 !important;
}
html.ft-freshchat-dark body :is(
  .filter-link.toggle-button-sla,
  .collapse-block,
  [data-test-id="hamburger-trigger"]
):hover {
  background: #334155 !important;
}

html.ft-freshchat-dark body .filter-option.selected {
  background: #1e3a5f !important;
  border-color: #3b82f6 !important;
  color: #eff6ff !important;
}

html.ft-freshchat-dark body li.ember-power-select-option.selected-option[role="option"][aria-selected="true"],
html.ft-freshchat-dark body li[data-test-option].selected-option[role="option"][aria-selected="true"] {
  background: #1e3a5f !important;
  border: 1px solid #3b82f6 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body li[data-test-option][role="option"]:not([aria-selected="true"]):hover {
  background: #1e293b !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body li[data-test-option][role="option"] :is(.agent-name, .agent-email, p, div) {
  background: transparent !important;
  color: inherit !important;
}
html.ft-freshchat-dark body li[data-test-option][role="option"] .agent-email {
  color: #cbd5e1 !important;
}

html.ft-freshchat-dark body .key {
  background: #334155 !important;
  border: 1px solid #64748b !important;
  box-shadow: none !important;
  color: #f8fafc !important;
}

/* Keep generated-initial avatars neutral; real photo avatars are left untouched. */
html.ft-freshchat-dark body .avatar-content-wrap[class*="avatar-theme"] {
  background-color: #334155 !important;
  border-color: #475569 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body .avatar-content-wrap[class*="avatar-theme"] .avatar-content {
  color: #f8fafc !important;
}
html.ft-freshchat-dark body .avatar-content-wrap.white-border {
  border-color: #475569 !important;
}
html.ft-freshchat-dark body .user-image {
  background: transparent !important;
  border-color: transparent !important;
  border-radius: 50% !important;
  filter: none !important;
  overflow: hidden !important;
}
html.ft-freshchat-dark body .user-image > freshworks-user-avatar {
  display: block !important;
  filter: none !important;
  height: 100% !important;
  width: 100% !important;
}
/* The account menu uses a compact avatar; do not stretch it to its trigger. */
html.ft-freshchat-dark body .logged-user .user-image,
html.ft-freshchat-dark body .logged-user .user-image > freshworks-user-avatar {
  height: 32px !important;
  width: 32px !important;
}
html.ft-freshchat-dark body :is(img, picture, freshworks-user-avatar) {
  filter: none !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
}

/* Freshchat marketplace iframe (WhatsApp Proactive Messaging). */
html.ft-freshchat-dark body .fw-widget-wrapper,
html.ft-freshchat-dark body .fw-widget-wrapper .field {
  background: #111827 !important;
  color: #e2e8f0 !important;
}
html.ft-freshchat-dark body :is(
  .select2-selection,
  .select2-dropdown,
  .select2-results,
  .select2-results__option,
  .select2-search__field
) {
  background: #1f2937 !important;
  border-color: #475569 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body .select2-results__option[aria-selected="true"] {
  background: #1e3a5f !important;
}

html.ft-freshchat-dark body :is(svg, button svg) { color: inherit; fill: currentColor; }
html.ft-freshchat-dark body svg :is(path, circle, rect, polygon, line) {
  stroke: currentColor;
}
html.ft-freshchat-dark body :is(img, video, canvas, picture) {
  background-color: transparent !important;
  filter: none !important;
}

html.ft-freshchat-dark body :is([class*="empty" i], [class*="placeholder" i], [data-test-id*="empty"], [data-testid*="empty"]) {
  background-color: #0f172a !important;
  color: #cbd5e1 !important;
}

html.ft-freshchat-dark .chat-header,
html.ft-freshchat-dark .conversation-header,
html.ft-freshchat-dark .messenger-header,
html.ft-freshchat-dark .channel-header,
html.ft-freshchat-dark [data-testid="chat-header"] {
  background-color: #111827 !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark .chat-header *,
html.ft-freshchat-dark .conversation-header *,
html.ft-freshchat-dark .messenger-header *,
html.ft-freshchat-dark .channel-header * {
  color: #f8fafc !important;
  fill: currentColor !important;
}

html.ft-freshchat-dark .message-bubble,
html.ft-freshchat-dark .fc-ui-message-bubble,
html.ft-freshchat-dark .agent-message,
html.ft-freshchat-dark .incoming-message,
html.ft-freshchat-dark li.user-messages.fc-agent-message .message-bubble,
html.ft-freshchat-dark li.user-messages.fc-agent-message .fc-ui-message-bubble {
  background-color: #1e293b !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark .user-message,
html.ft-freshchat-dark .outgoing-message,
html.ft-freshchat-dark .message-bubble.user-message,
html.ft-freshchat-dark li.user-messages:not(.fc-agent-message) .message-bubble,
html.ft-freshchat-dark li.user-messages:not(.fc-agent-message) .fc-ui-message-bubble {
  background-color: #6d28d9 !important;
  border-color: #7c3aed !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark .message-bubble *,
html.ft-freshchat-dark .fc-ui-message-bubble *,
html.ft-freshchat-dark .user-message *,
html.ft-freshchat-dark .agent-message *,
html.ft-freshchat-dark .incoming-message *,
html.ft-freshchat-dark .outgoing-message * {
  color: inherit !important;
}

/* Private notes must be immediately distinguishable from conversation messages. */
html.ft-freshchat-dark body .note-bubble .fc-ui-message-bubble.comment,
html.ft-freshchat-dark body #fc-ticket-summary[data-test-id="ticket-summary-card"] {
  background: #3b2a12 !important;
  border: 1px solid #b45309 !important;
  box-shadow: inset 4px 0 0 #f59e0b !important;
  color: #fef3c7 !important;
}
html.ft-freshchat-dark body .note-bubble .fc-ui-message-bubble.comment *,
html.ft-freshchat-dark body #fc-ticket-summary[data-test-id="ticket-summary-card"] * {
  color: #fef3c7 !important;
}
html.ft-freshchat-dark body .note-bubble .fc-ui-message-bubble.comment :is(a, .reply, [role="button"]) {
  color: #fbbf24 !important;
}
html.ft-freshchat-dark body .note-bubble .fc-ui-message-bubble.comment button {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  color: #fbbf24 !important;
}
/* Ticket content inside a private note inherits the amber note surface. */
html.ft-freshchat-dark body .note-bubble .body.inside-thread-view,
html.ft-freshchat-dark body .note-bubble .inside-thread-view {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

/* Keep normal conversation messages legible and separate from private notes. */
html.ft-freshchat-dark body .chat-container-wrap:not(.note-bubble) li.user-messages.fc-agent-message .fc-ui-message-bubble.comment {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body .chat-container-wrap:not(.note-bubble) li.user-messages.fc-agent-message .fc-ui-message-bubble.comment * {
  color: #f8fafc !important;
}
html.ft-freshchat-dark body .chat-container-wrap:not(.note-bubble) li.user-messages:not(.fc-agent-message) .fc-ui-message-bubble.comment.user-message {
  background: #334155 !important;
  border-color: #475569 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark body .chat-container-wrap:not(.note-bubble) li.user-messages:not(.fc-agent-message) .fc-ui-message-bubble.comment.user-message * {
  color: #f8fafc !important;
}

html.ft-freshchat-dark .message-time,
html.ft-freshchat-dark .timestamp,
html.ft-freshchat-dark .typing-indicator,
html.ft-freshchat-dark .delivery-status,
html.ft-freshchat-dark .subtitle {
  color: #cbd5e1 !important;
}

html.ft-freshchat-dark .composer,
html.ft-freshchat-dark .reply-box,
html.ft-freshchat-dark .message-input-container,
html.ft-freshchat-dark .input-container,
html.ft-freshchat-dark .footer-container {
  background-color: #111827 !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark .composer textarea,
html.ft-freshchat-dark .composer input,
html.ft-freshchat-dark .reply-box textarea,
html.ft-freshchat-dark .message-input,
html.ft-freshchat-dark [contenteditable="true"] {
  background-color: #1f2937 !important;
  border-color: #334155 !important;
  caret-color: #f8fafc !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark .composer textarea::placeholder,
html.ft-freshchat-dark .composer input::placeholder,
html.ft-freshchat-dark .reply-box textarea::placeholder,
html.ft-freshchat-dark .message-input::placeholder {
  color: #cbd5e1 !important;
  opacity: 1 !important;
}

html.ft-freshchat-dark .send-button,
html.ft-freshchat-dark .attachment-button,
html.ft-freshchat-dark .emoji-button,
html.ft-freshchat-dark [data-testid="send-button"],
html.ft-freshchat-dark [data-testid="attachment-button"] {
  background-color: transparent !important;
  color: #a78bfa !important;
  fill: currentColor !important;
}
html.ft-freshchat-dark .send-button:hover,
html.ft-freshchat-dark .attachment-button:hover,
html.ft-freshchat-dark .emoji-button:hover {
  background-color: #1f2937 !important;
  color: #f8fafc !important;
}

html.ft-freshchat-dark .faq-container,
html.ft-freshchat-dark .faq-list,
html.ft-freshchat-dark .topic-list,
html.ft-freshchat-dark .channel-list,
html.ft-freshchat-dark .conversation-list,
html.ft-freshchat-dark .article-container,
html.ft-freshchat-dark .search-container,
html.ft-freshchat-dark .csat-container {
  background-color: #0f172a !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark .faq-item,
html.ft-freshchat-dark .topic-item,
html.ft-freshchat-dark .channel-item,
html.ft-freshchat-dark .conversation-item,
html.ft-freshchat-dark .article-item,
html.ft-freshchat-dark .search-result {
  background-color: #111827 !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}
html.ft-freshchat-dark .faq-item:hover,
html.ft-freshchat-dark .topic-item:hover,
html.ft-freshchat-dark .channel-item:hover,
html.ft-freshchat-dark .conversation-item:hover,
html.ft-freshchat-dark .article-item:hover,
html.ft-freshchat-dark .search-result:hover {
  background-color: #1f2937 !important;
}
html.ft-freshchat-dark a { color: #a78bfa !important; }
html.ft-freshchat-dark hr { border-color: #334155 !important; }
html.ft-freshchat-dark .error,
html.ft-freshchat-dark [role="alert"] { color: #f87171 !important; }

html.ft-freshchat-dark * { scrollbar-color: #475569 #111827; }
html.ft-freshchat-dark *::-webkit-scrollbar { height: 10px; width: 10px; }
html.ft-freshchat-dark *::-webkit-scrollbar-track { background-color: #111827; }
html.ft-freshchat-dark *::-webkit-scrollbar-thumb {
  background-color: #475569;
  border: 2px solid #111827;
  border-radius: 999px;
}
html.ft-freshchat-dark *:focus-visible {
  outline: 2px solid #a78bfa !important;
  outline-offset: 2px !important;
}
`;

  const SHADOW_CSS = `
:host {
  --lt-color-background-dark: #0b1220;
  --lt-color-background-default: #111827;
  --lt-color-background-light: #1f2937;
  --lt-color-border-dark: #475569;
  --lt-color-border-default: #334155;
  --lt-color-border-light: #1e293b;
  --lt-color-text-dark: #f8fafc;
  --lt-color-text-default: #e2e8f0;
  --lt-color-text-light: #cbd5e1;
  --lt-color-white: #111827;
  color: #e2e8f0;
  color-scheme: dark;
}
*, *::before, *::after { border-color: #334155 !important; }
:is(input, textarea, select, button, [role="button"], [role="combobox"], [role="textbox"]) {
  background-color: #1f2937 !important;
  background-image: none !important;
  border-color: #475569 !important;
  color: #f8fafc !important;
}
:is(input, textarea)::placeholder { color: #94a3b8 !important; opacity: 1 !important; }
:is(
  [role="dialog"], [role="menu"], [role="listbox"],
  .dropdown-menu, .dropdown-content, .ember-basic-dropdown-content,
  [class*="popover" i]
) {
  background-color: #1f2937 !important;
  color: #f8fafc !important;
}
:is([role="option"], [role="menuitem"]):hover,
:is([role="option"], [role="menuitem"])[aria-selected="true"] {
  background-color: #1e3a5f !important;
  color: #eff6ff !important;
}
.input-container,
[part="fw-select-input-container"] {
  background-color: #1f2937 !important;
  border-color: #475569 !important;
  box-shadow: none !important;
  color: #f8fafc !important;
}
.input-container-inner,
.input-container input {
  background: transparent !important;
  color: #f8fafc !important;
}
.field-control-label,
label,
.input__label,
.checkbox-label {
  color: #cbd5e1 !important;
  opacity: 1 !important;
}
.dropdown-status-icon,
.dropdown-status-icon * {
  color: #cbd5e1 !important;
  fill: currentColor !important;
}
.freshworks-user-avatar-wrapper {
  background: transparent !important;
  height: 100% !important;
  width: 100% !important;
}
.freshworks-user-avatar {
  filter: none !important;
  height: 100% !important;
  object-fit: cover !important;
  opacity: 1 !important;
  width: 100% !important;
}
:host-context(.logged-user) .freshworks-user-avatar-wrapper,
:host-context(.logged-user) .freshworks-user-avatar {
  height: 32px !important;
  width: 32px !important;
}
`;

  function isFreshchatOrigin(targetDocument) {
    const hostname = targetDocument.defaultView?.location?.hostname || "";
    const referrerHostname = (() => {
      try { return new URL(targetDocument.referrer || "").hostname; } catch (_error) { return ""; }
    })();
    return FRESHCHAT_HOST.test(hostname) ||
      (FRESHCHAT_INTEGRATION_HOST.test(hostname) && FRESHCHAT_HOST.test(referrerHostname));
  }

  function isFreshchatDocument(targetDocument) {
    return isFreshchatOrigin(targetDocument) || Boolean(targetDocument.querySelector(WIDGET_SELECTOR));
  }

  function inject(targetDocument = document) {
    if (!targetDocument?.head || !isFreshchatDocument(targetDocument)) return false;
    // A classe que permite regras de body só entra no documento do próprio
    // Freshchat. Na página hospedeira apenas #fc_widget/#fc_frame são atingidos.
    if (isFreshchatOrigin(targetDocument)) targetDocument.documentElement.classList.add(ROOT_CLASS);
    if (targetDocument.getElementById(STYLE_ID)) return true;
    const style = targetDocument.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    targetDocument.head.appendChild(style);
    return true;
  }

  function injectReachableFrames(targetDocument = document) {
    for (const frame of targetDocument.querySelectorAll("#fc_widget iframe, #fc_frame, .fc-widget iframe, .d-hotline iframe")) {
      const tryFrame = () => {
        try { inject(frame.contentDocument); } catch (_crossOrigin) { /* Extension runs inside it. */ }
      };
      tryFrame();
      frame.addEventListener("load", tryFrame, { once: false });
    }
  }

  const observedShadowRoots = new WeakSet();

  function injectShadowRoots(root = document) {
    for (const host of root.querySelectorAll?.("*") || []) {
      const shadow = host.shadowRoot;
      if (!shadow) continue;
      if (!shadow.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = SHADOW_CSS;
        shadow.appendChild(style);
      }
      if (!observedShadowRoots.has(shadow)) {
        observedShadowRoots.add(shadow);
        const shadowObserver = new MutationObserver(() => injectShadowRoots(shadow));
        shadowObserver.observe(shadow, { childList: true, subtree: true });
      }
      injectShadowRoots(shadow);
    }
  }

  // O Freshchat aplica uma regra !important própria a algumas anotações
  // privadas depois da renderização. Estilos inline importantes são usados
  // somente nessas bolhas para manter contraste estável sem afetar mensagens.
  function normalizePrivateNotes(targetDocument = document) {
    for (const note of targetDocument.querySelectorAll(".note-bubble .fc-ui-message-bubble.comment")) {
      note.style.setProperty("background", "#3b2a12", "important");
      note.style.setProperty("border-color", "#b45309", "important");
      note.style.setProperty("box-shadow", "inset 4px 0 0 #f59e0b", "important");
      note.style.setProperty("color", "#fef3c7", "important");
      for (const child of note.querySelectorAll("*")) {
        const isAction = child.matches("button, a, .reply, [role='button']");
        child.style.setProperty("color", isAction ? "#fbbf24" : "#fef3c7", "important");
        if (child.matches(".body.inside-thread-view, .inside-thread-view")) {
          child.style.setProperty("background", "transparent", "important");
          child.style.setProperty("border-color", "transparent", "important");
          child.style.setProperty("box-shadow", "none", "important");
        }
        if (isAction) {
          child.style.setProperty("background", "transparent", "important");
          child.style.setProperty("border-color", "transparent", "important");
          child.style.setProperty("box-shadow", "none", "important");
        }
      }
    }
  }

  function install(targetDocument = document) {
    const run = () => {
      inject(targetDocument);
      injectReachableFrames(targetDocument);
      if (isFreshchatDocument(targetDocument)) {
        injectShadowRoots(targetDocument);
        normalizePrivateNotes(targetDocument);
      }
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(targetDocument.documentElement, { childList: true, subtree: true });
    return observer;
  }

  const api = Object.freeze({ CSS, ROOT_CLASS, SHADOW_CSS, STYLE_ID, inject, injectShadowRoots, normalizePrivateNotes, install });
  globalThis.FreshToolsFreshchatDarkMode = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => install(), { once: true });
  } else {
    install();
  }
})();
