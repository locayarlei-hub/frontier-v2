-- FRONTIER OFICIAL V1 — Supabase
-- Execute no SQL Editor de um projeto novo.
-- A aplicação usa Supabase Auth + tabelas JSONB por usuário.
-- Cada usuário enxerga somente os próprios dados via RLS.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Perfil opcional, criado automaticamente após cadastro.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Entidades principais. O payload mantém o frontend flexível para os diversos tipos de projeto.
create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_folders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.vehicles (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.study_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.books (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices por usuário.
create index if not exists projects_user_idx on public.projects(user_id);
create index if not exists finance_user_idx on public.finance_entries(user_id);
create index if not exists accounts_user_idx on public.accounts(user_id);
create index if not exists notes_user_idx on public.notes(user_id);
create index if not exists folders_user_idx on public.note_folders(user_id);
create index if not exists pets_user_idx on public.pets(user_id);
create index if not exists calendar_user_idx on public.calendar_events(user_id);
create index if not exists vehicles_user_idx on public.vehicles(user_id);
create index if not exists study_sessions_user_idx on public.study_sessions(user_id);
create index if not exists books_user_idx on public.books(user_id);

-- updated_at.
do $$
declare t text;
begin
  foreach t in array array['profiles','projects','finance_entries','accounts','notes','note_folders','pets','calendar_events','vehicles','study_sessions','books']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- RLS.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.finance_entries enable row level security;
alter table public.accounts enable row level security;
alter table public.notes enable row level security;
alter table public.note_folders enable row level security;
alter table public.pets enable row level security;
alter table public.calendar_events enable row level security;
alter table public.vehicles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.books enable row level security;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all
using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['projects','finance_entries','accounts','notes','note_folders','pets','calendar_events','vehicles','study_sessions','books']
  loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.finance_entries to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.note_folders to authenticated;
grant select, insert, update, delete on public.pets to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;
grant select, insert, update, delete on public.books to authenticated;
grant select, update on public.profiles to authenticated;

-- Bucket preparado para anexos futuros (documentos, comprovantes, fotos de animais etc.).
insert into storage.buckets (id, name, public)
values ('frontier-attachments','frontier-attachments',false)
on conflict (id) do nothing;

drop policy if exists "frontier attachments read own" on storage.objects;
create policy "frontier attachments read own"
on storage.objects for select to authenticated
using (bucket_id='frontier-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "frontier attachments insert own" on storage.objects;
create policy "frontier attachments insert own"
on storage.objects for insert to authenticated
with check (bucket_id='frontier-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "frontier attachments update own" on storage.objects;
create policy "frontier attachments update own"
on storage.objects for update to authenticated
using (bucket_id='frontier-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "frontier attachments delete own" on storage.objects;
create policy "frontier attachments delete own"
on storage.objects for delete to authenticated
using (bucket_id='frontier-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- FRONTIER 1.3 — hábitos, central de notificações e Web Push opcional
create table if not exists public.habits (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user_idx on public.habits(user_id);
create index if not exists habit_logs_user_idx on public.habit_logs(user_id);
create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

do $$
declare t text;
begin
  foreach t in array array['habits','habit_logs','notifications','push_subscriptions']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['habits','habit_logs','notifications','push_subscriptions']
  loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, update, delete on public.habit_logs to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_key text not null,
  delivered_at timestamptz not null default now(),
  unique(user_id, delivery_key)
);
create index if not exists push_delivery_log_user_idx on public.push_delivery_log(user_id);
alter table public.push_delivery_log enable row level security;
-- Sem policy para usuários finais: esta tabela é usada apenas pela Edge Function via service_role.
