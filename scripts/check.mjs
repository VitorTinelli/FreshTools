import { access, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["chromium", "firefox"];

function manifestFiles(manifest) {
  return [
    ...(manifest.background?.scripts ?? []),
    manifest.background?.service_worker,
    ...manifest.content_scripts.flatMap(({ js = [], css = [] }) => [...js, ...css]),
    ...(manifest.web_accessible_resources?.flatMap(({ resources = [] }) => resources) ?? []),
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {})
  ].filter(Boolean);
}

for (const target of targets) {
  const manifestPath = resolve(root, "src", "manifests", `${target}.json`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.name !== "FreshTools" || manifest.manifest_version !== 3) {
    throw new Error(`${target}: manifesto inválido`);
  }

  for (const file of manifestFiles(manifest)) {
    const commonFile = resolve(root, "src", "common", file);
    const platformFile = resolve(root, "src", "platforms", target, file);
    await access(commonFile).catch(() => access(platformFile));
  }

  if (target === "firefox") {
    for (const forbidden of ["audio-worklet.js", "vendor"]) {
      const entries = await readdir(resolve(root, "src", "platforms", "firefox"));
      if (entries.includes(forbidden)) throw new Error(`firefox: recurso exclusivo do Chromium encontrado: ${forbidden}`);
    }
  }

  console.log(`FreshTools: manifesto ${target} válido.`);
}
