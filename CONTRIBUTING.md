# Contribuindo com o FreshTools

Obrigado por contribuir. O FreshTools é uma WebExtension em JavaScript puro para Chromium e Firefox. O código-fonte fica em `src/`; `dist/` é gerado e não deve ser editado nem versionado.

## Pré-requisitos

- Node.js 20 ou superior;
- Chrome, Edge ou outro navegador Chromium para validar o pacote Chromium;
- Firefox 140 ou superior para validar o pacote Firefox.

Não há dependências de npm para instalar.

## Estrutura do projeto

```text
src/common/                 recursos compartilhados pelos navegadores
src/platforms/chromium/     código e recursos exclusivos do Chromium
src/platforms/firefox/      código exclusivo do Firefox
src/manifests/              manifestos MV3 por navegador
tests/                      testes automatizados
scripts/                    build, validação e execução de testes
dist/                       pacotes gerados (ignorado pelo Git)
```

Mantenha em `src/common/` apenas arquivos com comportamento idêntico. Se uma API, permissão ou fluxo for diferente entre navegadores, use a pasta da respectiva plataforma.

## Fluxo de desenvolvimento

1. Faça a alteração em `src/` e, quando aplicável, atualize os testes em `tests/`.
2. Execute as validações:

   ```powershell
   npm run check
   npm run build
   npm test
   ```

3. Carregue os pacotes gerados para um teste manual:

   - Chromium: abra `chrome://extensions`, ative o modo de desenvolvedor e carregue `dist/chromium`.
   - Firefox: abra `about:debugging#/runtime/this-firefox` e carregue `dist/firefox/manifest.json`.

4. Não edite arquivos dentro de `dist/`; gere-os novamente com `npm run build`.

## Critérios para mudanças

- Não amplie permissões nem `host_permissions` sem justificar a necessidade e testar em ambos os manifestos.
- Preserve o isolamento entre código injetado na página, content scripts e background.
- Recursos exclusivos do Chromium, como AudioWorklet, WASM e `declarativeNetRequest`, não podem ser incluídos no pacote Firefox.
- Qualquer alteração no fluxo Vocaroo deve cobrir êxito, falha, cancelamento e arquivos de vídeo recusados.
- Não introduza dependências externas ou downloads em tempo de execução sem aprovação explícita.
- Preserve os avisos de licença em `src/platforms/chromium/` ao atualizar o encoder OGG/Opus.

## Testes manuais mínimos

Em uma conversa de teste do Freshchat/Freshdesk, valide:

- cópia da conversa;
- gravação, pausa, descarte e anexo de áudio;
- envio ao Vocaroo e cancelamento durante upload;
- reprodução de áudio e vídeo anexados;
- rejeição de vídeo no fluxo de Vocaroo.

## Pull requests

A branch `main` é protegida e não aceita pushes diretos. Crie uma branch para cada alteração e abra um pull request para integrar o trabalho.

Todo pull request precisa ter as conversas resolvidas antes do merge. Não há exigência de número mínimo de aprovações neste momento, mas a revisão é recomendada para alterações em permissões, manifestos, captura de mídia ou dependências de terceiros.

Descreva o comportamento alterado, os navegadores testados e os comandos executados. Inclua capturas ou detalhes de console quando a mudança afetar a interface dentro do Freshchat.
