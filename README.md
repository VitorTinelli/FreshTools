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
