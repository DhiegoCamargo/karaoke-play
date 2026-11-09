# Etapa 2 — pesquisa com "Quero essa" (entrega revisada v2)

Base: os 8 arquivos reais de `experimento-audio` (ZIP `Karaoke_Play_Arquivos_Reais_Claude.zip`), já com o patch de estabilização. Crie a branch **`etapa2-pesquisa`** a partir de `experimento-audio` e envie os arquivos abaixo nela. `main` e `backup-kptom-funcionando` não são tocadas.

Arquivos alterados: `src/App.tsx`, `src/lib.ts`, `README.md`. **Sem mudança:** `src/playback.ts`, `src/kpTomBridge.ts`, `api/search.ts`, `package.json`, `vite.config.ts`. Veja `etapa2.diff` (tudo, em relação aos arquivos reais) e `correcoes-v2.diff` (só a revisão sobre a primeira entrega).

## Correções da revisão (v2)
1. **Nova pesquisa começa do zero** (`App.tsx`): ao pesquisar, limpa resultados, token de paginação (`more`), `lastTerm` e o aviso de "nenhum resultado" (estado novo `empty`, que mostra "Nenhum resultado. Tente outro nome ou cole o link do vídeo."). Só "Mais resultados" preserva e acrescenta aos resultados existentes. Um nome longo demais (item 2) não limpa nada, pois nenhuma pesquisa é iniciada.
2. **Limite de 100 caracteres** (`lib.ts`, `App.tsx`): `normalizeQuery` deixou de cortar o texto. Nova `buildTerm` conta o " karaokê" acrescentado: sem sufixo cabem 100 caracteres; com sufixo, 92. Se não couber, a pesquisa não é feita e aparece "Pesquisa muito longa: use até N caracteres." (nada é cortado em silêncio). Links do YouTube não passam por esse limite.
3. **`mergeResults`** elimina repetidos também dentro da página recebida e da primeira página, mantendo a ordem.
4. **Avisos amigáveis** (`lib.ts`): sem chave/servidor (503), host sem a função (404/405) ou resposta que não é da função (ex.: servidor de desenvolvimento devolvendo HTML com status 200) → "A pesquisa por nome não está disponível no momento. Você ainda pode colar o link…"; cota (429) → "O limite diário de pesquisas foi atingido…"; demais falhas → "Não foi possível pesquisar agora…"; sem rede → "Sem conexão…". O nome `YOUTUBE_API_KEY` aparece só no console (`console.warn`) e no README. Isso também corrige um defeito da v1: com resposta HTML, `r.items` ficava indefinido e quebrava com erro técnico.
5. **Preservado:** guarda contra respostas antigas (`searchSeq`) e paginação presa à consulta original (`lastTerm`).
6. **Intocados:** `playback.ts`, `kpTomBridge.ts`, pontuação (conferido byte a byte contra os arquivos reais).

## Alterações da primeira entrega
1. **"Quero essa"** (`App.tsx`). O botão "+" dos resultados virou "Quero essa" e abre o `SingerModal`: nome obrigatório (o botão Confirmar fica desabilitado se vazio; Enter confirma; Esc, Cancelar ou clique fora cancelam sem adicionar). O campo vem com o último nome usado. Ao confirmar, o nome é gravado como "último nome" e `add()` (a mesma função de antes, com a trava de duplicata e o início automático quando ocioso) recebe o nome por um terceiro parâmetro opcional. O campo "Quem vai cantar?" do cabeçalho continua existindo e é usado como antes pelo MP4 local e pelo "Adicionar de novo" do histórico.
2. **Sugestões de cantores** (`App.tsx`). Chips no modal com quem já participou da sessão (histórico, música atual e fila, sem repetir ignorando maiúsculas, até 8). Se o nome digitado coincide com um existente, usa-se a grafia já registrada, para o ranking não separar "ana" e "Ana".
3. **Consulta e cache** (`lib.ts`, `App.tsx`).
   - `normalizeQuery`: minúsculas, espaços colapsados, máximo de 100 caracteres.
   - Cache da chave sem acentos (inclui o token de página), em memória e no `sessionStorage`, validade de 1 h, até 40 entradas; só respostas bem-sucedidas; pedidos iguais simultâneos viram um só.
   - Paginação preservada e corrigida: "Mais resultados" agora usa a consulta da última pesquisa (antes usava o texto atual do campo, que podia ter sido editado), resultados são mesclados sem repetir vídeos, e respostas de pesquisas ultrapassadas são ignoradas.
   - O token de página passou a ser codificado na URL.
4. **README** atualizado (KP Tom, três fontes, pesquisa, Vercel, limites, estado real).

## Não alterado
KP Tom e ponte, estabilização anterior, `LocalPlayback`/MP4, pontuação, histórico, contagem, reprodução automática, ranking, fila.

## Limite por IP
**Não implementado.** Proposta técnica enviada à parte para decisão.

## Verificação (o que foi e não foi feito)
- **Executado:** `lib.ts` compilado com `tsc --strict` (sem erros) e testado em Node com `fetch` e `sessionStorage` simulados: normalização sem corte, `buildTerm` nos limites 92/93 (com sufixo) e 100/101 (sem), `mergeResults` com repetidos na mesma página, cache por chave sem acento, paginação, deduplicação de pedidos simultâneos, falhas fora do cache e mensagens amigáveis para 503, 404, 429, 500, HTML com status 200 e falta de rede — todos passaram. (Na v1 também rodei reaproveitamento por sessionStorage, limite de 40 entradas e expiração de 1 h; o código dessas partes não mudou, mas esses testes não foram repetidos na v2.)
- **Parcial:** `App.tsx` checado com tipos do React substituídos por declarações vazias, comparando com a base: só variam os erros de "any implícito" causados por essa substituição; nenhum erro fora do `App.tsx`. **Não prova** que o build passa.
- **Não executado:** `npm install`, `npm run build`, o modal no navegador, a pesquisa real e o comportamento de limpeza de resultados/estado vazio na tela (lógica em React, só revisada na leitura). Rode `npm run build` e faça o roteiro abaixo.

## Roteiro de teste (Chromebook)
- [ ] Pesquisa por nome na prévia da Vercel (precisa de `YOUTUBE_API_KEY`); resultados com miniatura, título e canal.
- [ ] "Quero essa": modal abre com o último nome; sem nome não confirma; Esc/Cancelar não adicionam; confirmar adiciona e toca (se ocioso) ou entra na fila.
- [ ] Chips: aparecem após 1+ apresentação; escolher um nome preenche o campo; digitar "ana" quando existe "Ana" grava "Ana".
- [ ] Mesma música para o mesmo cantor: aviso de duplicata.
- [ ] Pesquisar a mesma coisa com outra caixa/acento: resposta imediata (aba Rede: sem nova chamada).
- [ ] "Mais resultados" após editar o campo de busca: continua a pesquisa anterior, sem repetir vídeos.
- [ ] Modal aberto durante uma música: música e KP Tom seguem normais.
- [ ] Nova pesquisa depois de uma com resultados: a lista antiga some na hora ("Pesquisando…"); "Mais resultados" some até a nova resposta.
- [ ] Pesquisa sem resultado (ex.: texto aleatório): aparece "Nenhum resultado…"; ao pesquisar de novo, o aviso some.
- [ ] Nome com mais de 92 caracteres: aviso de tamanho, nada é cortado nem pesquisado, resultados anteriores ficam.
- [ ] "Mais resultados" não repete vídeos; editar o campo antes de clicar não muda a consulta paginada.
- [ ] Em host sem a função (StackBlitz): aviso amigável, sem "YOUTUBE_API_KEY" na tela; colar link continua funcionando.
- [ ] Regressão: sessão completa com YouTube + MP4, tom, velocidade, nota, contagem, ranking.
