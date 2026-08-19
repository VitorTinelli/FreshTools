# FreshTools

Extensão WebExtension para Freshdesk e Freshchat, distribuída para Chromium e Firefox. Ela copia conversas, grava e reproduz áudio, reproduz vídeo e envia áudios ao Vocaroo.

## Desenvolvimento

Requer Node.js 20 ou superior. Não há dependências externas.

```powershell
npm run check
npm run build
npm test
```

O código-fonte fica em `src/`: `common/` contém recursos compartilhados, `platforms/` contém as implementações específicas e `manifests/` define a configuração de cada navegador. O build gera `dist/chromium` e `dist/firefox`; esses diretórios são descartáveis e não são versionados.

## Instalação

- Chromium (Chrome, Edge, Brave): em `chrome://extensions`, ative o modo de desenvolvedor, selecione **Carregar sem compactação** e escolha `dist/chromium`.
- Firefox: em `about:debugging#/runtime/this-firefox`, selecione **Carregar extensão temporária** e escolha `dist/firefox/manifest.json`.

## Matriz de compatibilidade

| Recurso | Chromium | Firefox |
| --- | --- | --- |
| Copiar conversa | Sim | Sim |
| Gravação OGG/Opus | AudioWorklet + encoder WASM | MediaRecorder nativo |
| Vocaroo | Sim | Sim |
| Reprodução de áudio e vídeo | Sim | Sim |

O Chromium empacota um encoder OGG/Opus de terceiros em `src/platforms/chromium/vendor/`; consulte `THIRD_PARTY_NOTICES.md` nessa mesma pasta. Nenhum recurso de encoder é baixado durante a execução.
