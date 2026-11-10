# Karaokê Play

React + TypeScript + Vite + Tailwind v4. Três fontes de música na mesma fila:

- **YouTube incorporado** (player oficial, IFrame API). Reprodução fixa em 1,00×; **tom pela extensão experimental KP Tom** (opcional).
- **MP4/MP3 local**: tom (−12 a +12) processado no navegador com SoundTouch (AudioWorklet), mantendo velocidade de 1,00×.
- **Biblioteca hospedada**: apenas preparada no código (`source: 'library'`), sem interface.

Fila, nota sorteada (recreativa, não avalia a voz), ranking, histórico, contagem regressiva, modo festa e tela cheia valem para todas as fontes.

## KP Tom (experimental)
Extensão Chrome própria, fora deste repositório, que processa o áudio dentro do iframe do YouTube. O site a comanda por mensagens (`src/kpTomBridge.ts`).
- Só Chrome em computador/ChromeOS; precisa ser instalada pelo usuário.
- Nas opções da extensão, **autorize a origem exata do site** (ex.: o endereço do StackBlitz, que muda por sessão, ou o domínio da Vercel) e recarregue a página.
- Sem a extensão, o painel indica o Transpose ou o modo MP4 local; o painel "Diagnóstico da extensão" mostra o estado da conexão.
- **Uso público**: as políticas do YouTube restringem alterar o áudio de vídeos incorporados. Mantenha como teste privado até esclarecer isso com o YouTube (não é parecer jurídico).

O controle de tom permite subir/descer em semitons e **Restaurar** ao tom original (0). A opção **Manter tom na próxima música** preserva a tonalidade selecionada. Não há controle de velocidade nesta etapa. Sem a KP Tom, os botões de tom do YouTube ficam indisponíveis; reprodução e demais funções continuam disponíveis.

## Pesquisa de músicas
`Pesquisar` → o site acrescenta "karaokê" à consulta (sem mostrar), exibe miniatura, título e canal, e cada resultado tem **Quero essa**: abre uma janela para confirmar quem vai cantar (último nome já preenchido e atalhos dos cantores da sessão) e adiciona à fila. Colar um link do YouTube também funciona.
- Consultas são normalizadas (caixa, espaços) e o resultado fica em cache por 1 h na aba (sessionStorage). Não há cache permanente.
- O termo enviado (com o " karaokê" acrescentado) tem no máximo 100 caracteres, limite do servidor; se não couber, o site avisa em vez de cortar o nome. Nova pesquisa começa do zero; "Mais resultados" continua a pesquisa anterior.
- A busca usa `api/search.ts`, função serverless que guarda a chave no servidor. Se a chave faltar ou a função não existir no host, o site mostra um aviso simples e continua aceitando links; os detalhes técnicos aparecem só no console do navegador e aqui (variável `YOUTUBE_API_KEY`).

## Rodar / publicar na Vercel
1. Google Cloud: ative a **YouTube Data API v3** e crie uma chave (restrinja à API; restrição por site não serve, pois a chamada parte do servidor).
2. Vercel: importe o repositório (preset Vite), defina `YOUTUBE_API_KEY` em *Environment Variables* e faça o deploy. Cada branch recebe uma URL de prévia. Confira os termos do plano gratuito para uso público.
3. Local: `npm install`, `vercel dev` (com `.env.local`) para ter a pesquisa; `npm run dev` serve só a interface.
- Cota padrão da API: 10.000 unidades/dia e cada busca custa 100 (cerca de 100 buscas/dia no site todo) — confirme no Google Cloud. O servidor envia cache de 1 h para a CDN.
- StackBlitz e GitHub Pages **não executam** `api/search.ts`: a pesquisa por nome só funciona num host com funções serverless.

## Estado
- Testado pelo autor no Chromebook/StackBlitz (relato): YouTube, MP4 com SoundTouch, KP Tom, fila, nota, ranking, contagem.
- **Não verificado**: build de produção (`npm run build`), pesquisa real na Vercel, o modal "Quero essa", celular, Safari/Firefox, TVs.
- Pendente: limite de uso por IP (em avaliação), catálogo JSON, separar `App.tsx` em componentes.
