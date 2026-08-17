# FreshTools

Extensão WebExtension para Chromium (Google Chrome, Edge, etc) e Firefox. Ela adiciona um **ícone de lápis** ao lado esquerdo do botão de mais opções da conversa e copia as mensagens carregadas na página neste formato:

```text
CONVERSA DO FRESHDESK
Tópico: ......
Mensagens: 2

[AGENTE]
Nosso expediente está encerrando agora...

[CLIENTE]
Obrigado 🙏
```

## Instalar no Chrome, Edge, Brave ou outro Chromium

1. Abra a página de extensões (`chrome://extensions` ou `edge://extensions`).
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione esta pasta, `freshdesk-copiar-conversa`.

## Instalar temporariamente no Firefox

1. Abra `about:debugging#/runtime/this-firefox`.
2. Clique em **Carregar extensão temporária**.
3. Selecione o arquivo `manifest.json` desta pasta.
4. Volte à aba do Freshdesk e recarregue a página. Scripts de uma extensão recém-carregada não são inseridos retroativamente em abas que já estavam abertas.

Se o Firefox solicitar acesso, abra **Gerenciar extensão → Permissões** e habilite o acesso aos sites Freshdesk/Freshworks. O aviso "não pode ler ou alterar dados neste site" é esperado em páginas internas como `about:debugging`, nas quais extensões não podem executar scripts.

Para distribuição permanente no Firefox, compacte os arquivos e envie o pacote para assinatura no Firefox Add-ons.

## Uso

1. Abra uma conversa no Freshdesk/Freshchat.
2. Clique no **ícone de lápis**, ao lado do menu de mais opções.
3. Aguarde enquanto a extensão salta rapidamente ao topo e carrega os lotes anteriores do histórico. O progresso aparece ao passar o mouse sobre o ícone.
4. A extensão copia as mensagens e retorna a conversa à posição anterior.

## Gravar e compartilhar áudio

1. Abra uma conversa e localize o botão de microfone ao lado de **Send DM**.
2. Clique no microfone e permita o acesso quando o navegador solicitar.
3. Durante a gravação, use os botões para pausar/continuar ou parar.
4. Depois de parar, ouça o áudio no player.
5. Use o clipe para adicioná-lo ao anexo nativo do Freshchat, a nuvem para enviar ao Vocaroo e copiar o link, ou a lixeira para excluir.
6. Quando usar o Vocaroo, cole manualmente o link copiado onde desejar. A extensão não anexa o áudio nem altera o campo de mensagem.

Os anexos de áudio que já aparecem na conversa — enviados pelo agente ou pelo cliente — também recebem a ação **Enviar ao Vocaroo**. Durante o processo, o botão mostra o download, o progresso do upload e permite cancelar. Ao concluir, o link é copiado e uma notificação permanece no canto superior direito por cinco segundos.

Formatos de vídeo, como MP4, 3GP, MOV, AVI e MKV, não recebem a ação de upload e também são recusados pela validação antes do envio.

## Reproduzir vídeos

Anexos de vídeo enviados pelo agente ou pelo cliente recebem a ação **Ver vídeo**. O vídeo abre em um player compacto dentro da conversa, com controles para ampliar, reduzir e entrar em tela cheia. A reprodução depende dos formatos e codecs aceitos pelo navegador.

O áudio é processado localmente na memória do navegador. No Chromium, a captura usa AudioWorklet e o OGG/Opus é finalizado em Worker. O áudio só sai da memória após uma ação explícita: o clipe o entrega ao Freshchat e a nuvem o envia ao Vocaroo. Se a integridade ou a duração não puder ser confirmada, ele é descartado. Firefox continua usando OGG/Opus nativo. O limite aplicado é de 25 MB.

A integração com o Vocaroo usa o protocolo público empregado pelo próprio site, que não possui uma API oficialmente documentada. Mudanças feitas pelo Vocaroo podem exigir uma atualização da extensão. Os links são externos e estão sujeitos à disponibilidade, privacidade e retenção do serviço.
