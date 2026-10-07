# Testes — Frontier 1.3 Season Finale

Validações executadas antes de gerar o ZIP:

- Sintaxe de `app.js`, `backend.js`, `charts.js`, `config.js` e `service-worker.js` validada com Node.
- 270 IDs do HTML verificados sem duplicatas.
- Chamadas `Frontier.*` da interface conferidas contra a API pública do JavaScript.
- Smoke test automatizado em navegador Chromium com a interface carregada diretamente:
  - criar conta local;
  - criar e concluir hábito;
  - criar movimentação financeira recorrente com 3 ocorrências;
  - criar compromisso para o dia seguinte e vê-lo na Central de Notificações;
  - marcar notificação como lida;
  - abrir Revisão Mensal;
  - conferir os quatro temas (Texas, Deserto, Kuromi e Barbie);
  - conferir navegação mobile em viewport 390x844.
- Resultado do smoke test: `UI_SMOKE_OK`, sem erros de página.

A parte de Web Push depende das chaves VAPID e da Edge Function no Supabase do usuário, então não foi possível fazer envio real sem credenciais do projeto.
