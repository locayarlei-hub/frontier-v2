# Frontier 1.3 — Notificações no celular (opcional)

A Central de Notificações interna funciona assim que as novas tabelas do Supabase forem criadas. O **Web Push** é opcional e só é necessário se você quiser receber notificações com o Frontier fechado.

## 1. Atualizar o banco

No Supabase, abra **SQL Editor** e execute o arquivo:

`supabase/migration_1_3.sql`

O script é preparado para criar as novas tabelas sem apagar as antigas. As novidades são `habits`, `habit_logs`, `notifications`, `push_subscriptions` e `push_delivery_log`.

## 2. Gerar um par VAPID

Você precisa de uma chave pública e uma privada próprias para Web Push. Uma forma é usar Node.js e o pacote `web-push` no terminal:

```bash
npx web-push generate-vapid-keys
```

Guarde:

- **Public Key**: pode ficar no frontend.
- **Private Key**: nunca coloque no GitHub ou no `config.js`.

## 3. Colocar a chave pública no Frontier

No `js/config.js`, mantenha seus dados do Supabase e preencha somente a chave pública:

```js
window.FRONTIER_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_...",
  VAPID_PUBLIC_KEY: "SUA_CHAVE_PUBLICA_VAPID"
};
```

## 4. Criar a Edge Function

No Supabase, crie uma Edge Function chamada:

`frontier-push`

Use o arquivo:

`supabase/functions/frontier-push/index.ts`

como código da função.

## 5. Criar os Secrets da função

Na área de Secrets das Edge Functions, adicione:

- `VAPID_PUBLIC_KEY` = sua chave pública VAPID
- `VAPID_PRIVATE_KEY` = sua chave privada VAPID
- `VAPID_SUBJECT` = `mailto:seu-email@exemplo.com`

A chave privada fica somente no Supabase.

## 6. Agendar o envio

Use o agendador/Cron do Supabase para chamar a função `frontier-push` uma vez por dia, de preferência pela manhã. A função verifica compromissos, contas, prazos de projetos, vacinas, consultas e manutenções próximas e só envia se houver algo importante.

## 7. Ativar no celular

Depois de publicar a nova versão e instalar o Frontier como PWA:

1. Entre no Frontier.
2. Abra **Configurações**.
3. Em **Notificações**, toque em **Ativar notificações no celular**.
4. Autorize a permissão do navegador.

A assinatura do aparelho será guardada no Supabase para sua própria conta.

## Sem Web Push

Se você preferir não configurar essa parte agora, não há problema: a **Central de Notificações interna**, a tela **Hoje**, os hábitos e a revisão mensal continuam funcionando normalmente.
