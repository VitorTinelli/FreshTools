# FreshTools para Firefox

Extensão WebExtension para Freshdesk e Freshchat. Inclui:

- cópia da conversa com mensagens separadas entre agente e cliente;
- carregamento rápido do histórico anterior;
- gravação, pausa e reprodução de áudio ao lado de **Send DM**;
- opção de anexar ao Freshchat ou enviar ao Vocaroo e copiar o link;
- envio ao Vocaroo de anexos de áudio existentes, tanto do agente quanto do cliente.

## Áudio

Esta edição usa exclusivamente o `MediaRecorder` nativo do Firefox com
`audio/ogg;codecs=opus`. Ela não contém WebAssembly, conversores, código de
encoder ou bibliotecas de terceiros.

O áudio permanece na memória local até o usuário clicar no clipe para anexá-lo ou
na nuvem para enviá-lo ao Vocaroo. Nesse segundo caso, a extensão copia o link,
sem anexar o áudio ou alterar o campo de mensagem, e mostra uma confirmação por cinco segundos.

Em anexos de áudio já exibidos na conversa, use **Enviar ao Vocaroo**. O botão mostra
o download e o progresso do upload, permite cancelar e copia o link quando concluir.
Formatos de vídeo, como MP4, 3GP, MOV, AVI e MKV, não podem ser enviados.

Anexos de vídeo do agente ou do cliente recebem a ação **Ver vídeo**. O player abre
dentro da conversa em tamanho compacto e pode ser ampliado, reduzido ou exibido em tela cheia.

A integração usa o protocolo público empregado pelo site do Vocaroo, que não tem
uma API oficialmente documentada. Mudanças no serviço podem exigir uma atualização
da extensão. Os links estão sujeitos às regras de disponibilidade e retenção do Vocaroo.

## Validação antes de publicar

Em uma conversa de teste, envie ao Vocaroo um áudio curto e um áudio próximo de
25 MB, tanto do agente quanto do cliente. Repita o envio de um áudio que já tenha
sido reproduzido (cache ativo), cancele outro durante o upload e confirme que um
anexo de vídeo é recusado. Verifique no DevTools que não há erros de rede e que o
link copiado abre o áudio completo no Vocaroo.

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
