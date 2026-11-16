# FreshTools

Extensão WebExtension para Freshdesk e Freshchat, distribuída para Chromium e Firefox. Ela copia conversas, grava e reproduz áudio, reproduz vídeo e envia áudios ao Vocaroo.

## Desenvolvimento

Requer Node.js 20 ou superior. Instale as dependências de desenvolvimento antes do primeiro build:

```powershell
npm install
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
| Transcrição local em português | WASM, sem GPU obrigatória | WASM, sem GPU obrigatória |

## Transcrição de áudio

Clique em **Transcrever** junto ao áudio recebido ou na prévia de uma gravação. No primeiro uso, **Baixar e transcrever** baixa o Whisper Tiny multilíngue quantizado (aproximadamente 41 MB de pesos, mais arquivos auxiliares). O modelo fica no cache local do navegador; os arquivos JavaScript e WASM são empacotados na extensão. Não é necessário login, chave de API ou serviço pago.

O limite é de 5 minutos e 25 MB por áudio, com uma transcrição por aba. **Cancelar** encerra o processamento; **Copiar** copia o texto. O áudio é processado no computador, sem envio ao provedor do modelo. Os textos não são salvos permanentemente. Com o modelo em cache e o áudio disponível, a transcrição também funciona sem rede. Limpar os dados da extensão ou do navegador pode exigir novo download.

A precisão e a velocidade dependem do computador, da fala e do ruído. Revise o resultado antes de usá-lo. Este recurso não inclui ditado ao vivo, tradução, identificação de falantes ou histórico.

O modelo usa a revisão fixa `ff4177021cc41f7db950912b73ea4fdf7d01d8e7` de `onnx-community/whisper-tiny`. O runtime usa apenas WASM de uma thread; nenhum script é executado de CDN. As permissões de hosts existentes são preservadas: o modelo público é baixado por CORS.

O Chromium empacota um encoder OGG/Opus de terceiros em `src/platforms/chromium/vendor/`; consulte `THIRD_PARTY_NOTICES.md` nessa mesma pasta. Nenhum recurso de encoder é baixado durante a execução.
