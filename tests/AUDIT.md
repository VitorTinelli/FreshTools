# Auditoria dos testes — 30/10/2026

Revisão individual dos 30 cenários executados por `npm test`, comparando asserções, mocks e comportamento do código de produção. A revisão anterior removeu um cenário redundante de resolução JSON no Firefox, já coberto no pipeline compartilhado e na integração Chromium. Nenhum outro cenário foi removido: cada um abaixo protege um contrato distinto, ou uma integração distribuída separadamente.

Não foi executado teste de mutação nem teste em navegador. Aprovação nesta revisão não significa cobertura completa do produto.

| Nº | Arquivo | Cenário / risco protegido | Decisão e evidência |
| --- | --- | --- | --- |
| 1 | audio-integrity | Metadados OGG e duração válida | Reforçado: taxas de captura 44,1 e 48 kHz, duração esperada e pre-skip. Nome corrigido: fixture sintética não comprova decodificação ou CRC. |
| 2 | audio-integrity | Página fora de sequência | Mantido: altera só a sequência e exige erro específico. |
| 3 | audio-integrity | Duração incompatível | Mantido: altera granule e exige erro específico de duração. |
| 4 | audio-pipeline | Download direto | Reforçado: compara bytes e MIME, além de credenciais e redirects. |
| 5 | audio-pipeline | Resolução de URL JSON | Mantido após reforço anterior: duas URLs e credenciais include/omit verificadas. |
| 6 | audio-pipeline | Falhas HTTP e rede | Mantido: diferencia códigos de erro dos dois caminhos. |
| 7 | audio-pipeline | Arquivo vazio, vídeo e tamanho excedido | Reforçado: MIME e extensão testados isoladamente; exige códigos de erro. |
| 8 | audio-pipeline | Cancelamento no download | Mantido: aborta controlador real e verifica propagação de AbortError. Fetch simulado, sem rede real. |
| 9 | audio-pipeline | Cancelamento no upload | Mantido após reforço anterior: aguarda início explícito do upload antes de abortar. |
| 10 | background-vocaroo | Chromium: captura, download e upload | Reforçado: bytes recebidos pelo uploader e ID da conclusão, além de URLs e progresso. Integração distinta da unidade do pipeline. |
| 11 | background-vocaroo | Chromium: comando de cancelamento | Reforçado: ID do erro e ausência de conclusão bem-sucedida. |
| 12 | background-vocaroo | Chromium: comando de URL direta | Reforçado: ID da conclusão. Entrada de comando distinta da captura por webRequest. |
| 13 | background-vocaroo | Chromium: vídeo bloqueado | Reforçado: ID do erro. Mantém garantia de não chamar uploader. |
| 14 | background-vocaroo | Chromium: URL para reprodução de vídeo | Mantido: exige URL do vídeo e uploader que falha se for indevidamente chamado. |
| 15 | conversation-copy | Chromium: contrato de formatação | Mantido após reescrita anterior: saída completa comparada literalmente. Não afirma testar extração do DOM. |
| 16 | conversation-copy | Chromium: união de páginas | Mantido após reescrita anterior: repetição legítima, páginas vazias, sobreposição e ausência de mutação dos argumentos. |
| 17 | conversation-copy | Firefox: contrato de formatação | Mantido: entry point distribuído independentemente; mesma expectativa pública. |
| 18 | conversation-copy | Firefox: união de páginas | Mantido: mesmo contrato no código efetivamente distribuído para Firefox. |
| 19 | vocaroo-feedback | Cópia e notificação temporária | Mantido: verifica clipboard, texto, visibilidade e callback de expiração sem espera real. Não testa renderização visual. |
| 20 | vocaroo-feedback | Link inválido | Reforçado: domínio externo, HTTP, domínio semelhante e identificador vazio; nenhuma escrita no clipboard. |
| 21 | vocaroo-upload | Upload em blocos | Mantido após reforço anterior: tamanhos, índices e reconstrução byte a byte, URL final, progresso e fases. |
| 22 | vocaroo-upload | Rejeição pelo processamento remoto | Mantido: status explícito de falha deve produzir erro específico, diferente de falha HTTP opcional. |
| 23 | vocaroo-upload | Status opcional indisponível | Mantido: finalize aceito com status HTTP 500 ainda retorna link utilizável. |
| 24 | vocaroo-upload | Blob de vídeo | Mantido: valida API direta do uploader e garante zero chamadas de rede; entrada distinta do pipeline. |
| 25 | background-media-capture | Firefox: captura única | Reforçado: dispara evento duplicado, compara bytes e ID; mantém isolamento de aba e uma chamada de upload. |
| 26 | background-media-capture | Firefox: erro de rede | Reforçado: verifica ID e flag explícita de que upload não foi chamado, além de mensagem e ausência de fallback. |
| 27 | conversation-copy | Chromium: cabeçalho do grupo | Confere a identificação do agente quando o nome está fora da mensagem. |
| 28 | conversation-copy | Chromium: continuidade de autoria | Confere a herança do nome dentro do grupo e seu reset após a mudança de grupo. |
| 29 | conversation-copy | Firefox: cabeçalho do grupo | Exercita a identificação do agente no código distribuído para Firefox. |
| 30 | conversation-copy | Firefox: continuidade de autoria | Exercita a herança do nome no código distribuído para Firefox. |

## Limitações de cobertura

- Extração de mensagens, nomes, anexos e rolagem automática não estão cobertas por DOM real ou navegador. Os testes de formatação recebem mensagens já estruturadas.
- Os backgrounds usam APIs de extensão simuladas; não validam permissões ou eventos reais de cada navegador.
- Vocaroo e Freshchat não recebem requisições reais nestes testes. Compatibilidade atual dos serviços não é comprovada.
- A fixture OGG verifica o leitor de metadados, não o encoder ou a reprodução do áudio.
- A cópia pelo fallback de clipboard não possui cenário próprio nesta suíte.

## Validação

`npm test`: 30 cenários passaram, nenhum ignorado ou cancelado.
