# FreshTools para Firefox

Extensão WebExtension para Freshdesk e Freshchat. Inclui:

- cópia da conversa com mensagens separadas entre agente e cliente;
- carregamento rápido do histórico anterior;
- gravação, pausa, reprodução e anexação de áudio ao lado de **Send DM**.

## Áudio

Esta edição usa exclusivamente o `MediaRecorder` nativo do Firefox com
`audio/ogg;codecs=opus`. Ela não contém WebAssembly, conversores, código de
encoder ou bibliotecas de terceiros.

O áudio permanece na memória local até o usuário clicar no clipe para anexá-lo.
A extensão nunca envia a mensagem automaticamente.

## Instalação temporária

1. Abra `about:debugging#/runtime/this-firefox`.
2. Clique em **Carregar extensão temporária**.
3. Selecione o `manifest.json` desta pasta.
4. Recarregue a página do Freshdesk/Freshchat.

## Construção e código-fonte

Não há compilação, transpilação, concatenação ou minificação. Os arquivos desta
pasta são simultaneamente o código-fonte e o pacote executável da extensão.

Requisitos: qualquer sistema operacional capaz de criar um arquivo ZIP. Não são
necessários Node.js, npm ou outros programas.

Para reproduzir o pacote, compacte diretamente o conteúdo desta pasta, mantendo
o `manifest.json` na raiz do ZIP.
