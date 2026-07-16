# FreshTools

FreshTools é um projeto de extensão para navegadores, mantido em edições compatíveis com Chromium e Firefox.

## Estrutura do projeto

- `Chromium/`: edição destinada a Google Chrome, Microsoft Edge e outros navegadores baseados em Chromium.
- `Firefox/`: edição destinada ao Mozilla Firefox.
- `Chromium.zip` e `Firefox.zip`: pacotes gerados para distribuição e testes.

## Desenvolvimento

O projeto utiliza JavaScript, CSS e os recursos nativos de extensões dos navegadores. Cada edição possui seu próprio `manifest.json` e deve ser validada no navegador correspondente após qualquer alteração.

Não há uma etapa obrigatória de compilação. Os arquivos das pastas de cada navegador podem ser carregados diretamente em modo de desenvolvimento.

## Instalação para desenvolvimento

### Chromium

1. Abra a página de gerenciamento de extensões do navegador.
2. Ative o modo do desenvolvedor.
3. Selecione a opção para carregar uma extensão sem compactação.
4. Escolha a pasta `Chromium`.

### Firefox

1. Abra `about:debugging#/runtime/this-firefox`.
2. Selecione a opção para carregar uma extensão temporária.
3. Escolha o arquivo `Firefox/manifest.json`.

## Empacotamento

Ao criar um arquivo ZIP, compacte o conteúdo da pasta da edição, não a pasta em si. O arquivo `manifest.json` deve ficar diretamente na raiz do pacote.

## Versionamento

A versão atual do projeto é `1.1.1`. As edições Chromium e Firefox devem manter o mesmo número de versão em seus manifestos.

## Contribuição

Antes de enviar alterações, valide os manifestos, confira a sintaxe dos scripts e teste a extensão nos navegadores suportados.
