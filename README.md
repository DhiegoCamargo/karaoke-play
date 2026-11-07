# Karaokê Play

React + TS + Vite + Tailwind v4. Player: YouTube IFrame API. Pesquisa: `api/search.ts` (serverless; a chave fica só no servidor).

## Rodar localmente
1. `npm install`
2. Crie uma chave da YouTube Data API v3 no Google Cloud Console (Credenciais > Chave de API; restrinja à API).
3. `npm i -g vercel && vercel dev` com `YOUTUBE_API_KEY=...` (`.env.local`). `npm run dev` sozinho serve só a interface (a pesquisa mostrará "não configurada"; colar link do YouTube funciona).

## Publicar
Vercel: importe o repositório, defina `YOUTUBE_API_KEY` em Environment Variables e faça deploy. Cota padrão: 10.000 unidades/dia (cada busca custa 100); respostas são cacheadas 1 h.

## Estado
- Implementado: pesquisa, link direto, fila (reordenar/remover/tocar agora), nota sorteada (crypto, uniforme), ranking, histórico, contagem 5/10/15 s com pausar/pular/cancelar, modo festa, configurações em LocalStorage, tratamento de erros.
- Não testado ainda (sem rede/navegador neste ambiente): build, pesquisa real, autoplay, celular, Transpose.
- Pendente: separar App.tsx em componentes, arrastar e soltar, testes automatizados.
- Transpose: sem integração; apenas ajuda ao usuário.
