# Frontier 1.3 — Season Finale

Frontier é uma central pessoal em HTML/CSS/JavaScript + Supabase, com foco em utilidade diária e integração entre áreas da vida.

## Módulos

- Visão Geral + **Hoje**
- Projetos e viagens
- Estudos
- Veículos
- Livros
- Finanças com lançamentos avulsos e recorrentes
- Agenda
- Notas
- Animais
- **Hábitos**
- **Central de Notificações**
- **Revisão Mensal**
- Pesquisa global
- PWA instalável

## Temas

- Noite do Texas
- Deserto claro
- Kuromi
- Barbie

## Atualizando uma instalação existente

1. Preserve seu `js/config.js` atual, que contém a URL e a Publishable Key do Supabase.
2. Substitua os demais arquivos pela versão 1.3.
3. Execute `supabase/migration_1_3.sql` no SQL Editor para criar apenas as novas tabelas da versão 1.3, sem mexer nas tabelas antigas.
4. Web Push é opcional. Consulte `GUIA_NOTIFICACOES.md` somente se quiser notificações com o app fechado.

## Segurança

No frontend use somente a **Publishable/Anon Key** do Supabase. Nunca coloque Service Role, Secret Key ou VAPID Private Key no GitHub.
