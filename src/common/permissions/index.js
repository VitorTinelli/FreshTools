"use strict";

const api = globalThis.browser || globalThis.chrome;
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const grantButton = document.querySelector("#grant");
const permissionCard = document.querySelector(".permission-card");
const originList = document.querySelector("#origin-list");
const manifest = api.runtime.getManifest();
const origins = manifest.host_permissions || [];
const t = (message) => globalThis.FreshToolsI18n?.t(message) || message;

globalThis.lucide?.createIcons();

for (const element of document.querySelectorAll("[data-version]")) element.textContent = manifest.version;
for (const origin of origins) {
  const item = document.createElement("li");
  item.textContent = origin.replace("https://*.", "").replace("https://", "").replace("/*", "");
  originList.append(item);
}

function show(message, kind = "checking") {
  statusText.textContent = message;
  status.className = `status ${kind}`;
}

async function refresh() {
  const granted = await api.permissions.contains({ origins });
  if (granted) {
    permissionCard.classList.remove("needs-attention");
    show(t("Tudo pronto — todos os sites estão autorizados."), "success");
    grantButton.textContent = t("Permissões concedidas ✓");
    grantButton.disabled = true;
    return;
  }
  show(t("Sua autorização ainda é necessária."));
  grantButton.textContent = t("Permitir todos os sites");
  grantButton.disabled = false;
  permissionCard.classList.add("needs-attention");
  requestAnimationFrame(() => grantButton.focus({ preventScroll: true }));
}

grantButton.addEventListener("click", async () => {
  grantButton.disabled = true;
  permissionCard.classList.remove("needs-attention");
  show(t("Confirme a solicitação exibida pelo navegador…"));
  try {
    const granted = await api.permissions.request({ origins });
    if (!granted) show(t("Permissão não concedida. Você pode tentar novamente."), "error");
  } catch (error) {
    show(`${t("Não foi possível solicitar as permissões:")} ${error.message}`, "error");
  }
  await refresh();
});

globalThis.addEventListener("freshtools-language-change", () => refresh());

refresh().catch((error) => show(`${t("Não foi possível verificar as permissões:")} ${error.message}`, "error"));
