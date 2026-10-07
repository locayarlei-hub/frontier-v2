# Guia rápido — Frontier 1.0 Final

1. Copie para `js/config.js` a `SUPABASE_URL` e a `SUPABASE_PUBLISHABLE_KEY` que já funcionam na sua instalação atual.
2. Não é necessário executar SQL novo para esta atualização.
3. Teste com Live Server.
4. Suba `index.html`, `manifest.webmanifest`, `service-worker.js`, as pastas `css`, `js`, `icons` e `supabase` para o mesmo repositório GitHub Pages.
5. Abra o site publicado, entre na conta e vá em **Configurações**.
6. Em navegadores compatíveis, clique **Instalar Frontier**. No iPhone/iPad, use Safari → Compartilhar → Adicionar à Tela de Início.

## Atualizando uma versão antiga
Substitua os arquivos do site, mas preserve os valores corretos de `js/config.js`. Seus dados ficam no Supabase e não são apagados ao atualizar o frontend.

---

## Atualização para Frontier 1.3 — Season Finale

Se você já usa o Frontier com Supabase e GitHub Pages:

1. **Guarde seu `js/config.js` atual.** Ele contém sua URL e Publishable Key do Supabase.
2. Substitua os arquivos do site pela versão 1.3, mas mantenha/copiei novamente seus valores no `js/config.js` novo.
3. No Supabase, abra **SQL Editor** e execute `supabase/migration_1_3.sql`.
4. Publique os arquivos no GitHub e aguarde o GitHub Pages concluir o deploy.
5. Abra o Frontier e use `Ctrl + F5` na primeira abertura para garantir que o Service Worker 1.3 substitua o cache anterior.

### O que funciona sem configuração extra

- Hoje
- Hábitos
- Central de Notificações interna
- Finanças avulsas/recorrentes
- Revisão mensal
- Temas Texas, Deserto, Kuromi e Barbie

### O que é opcional

Notificações **push** com o aplicativo fechado. Para isso, siga `GUIA_NOTIFICACOES.md`.
