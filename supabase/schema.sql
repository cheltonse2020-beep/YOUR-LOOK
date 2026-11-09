-- =====================================================================
-- FORMA — perfis de utilizador (Supabase)
-- Executar uma vez no SQL Editor do projeto Supabase.
-- As credenciais (email/palavra-passe/Google) ficam no Supabase Auth
-- (schema auth). Esta tabela guarda apenas dados de perfil.
-- =====================================================================

-- 1. Tabela ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 80),
  is_admin    boolean not null default false,   -- só alterável por SQL/service role, nunca pelo próprio utilizador
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público de cada utilizador autenticado (1:1 com auth.users).';
comment on column public.profiles.is_admin is 'Permissão de administrador. Não editável pelo utilizador (privilégios de coluna + trigger).';

-- 2. Row Level Security ----------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Ler o próprio perfil" on public.profiles;
create policy "Ler o próprio perfil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Editar o próprio perfil" on public.profiles;
create policy "Editar o próprio perfil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sem políticas de INSERT nem DELETE: os perfis são criados só pelo trigger
-- abaixo e apagados em cascata quando o utilizador é eliminado no Auth.

-- 3. Privilégios (defesa em profundidade, além do RLS) ---------------
-- Visitantes sem sessão (anon) não têm acesso nenhum.
-- Utilizadores autenticados só podem ler e alterar a coluna full_name.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- 4. Proteção de colunas sensíveis -----------------------------------
-- Mesmo que alguém altere os privilégios por engano, um utilizador
-- (roles anon/authenticated) não consegue mudar is_admin, id ou created_at.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'Não é permitido alterar is_admin.'
        using errcode = '42501';
    end if;
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.full_name := btrim(new.full_name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- 5. Criação automática do perfil após o registo ----------------------
-- security definer: corre com os privilégios do dono (postgres), porque o
-- utilizador ainda não tem sessão no momento do registo.
-- search_path vazio: evita sequestro de objetos por outros schemas.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),  -- registo por email (options.data.full_name) e Google
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),       -- Google (alternativa)
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      80
    )
  )
  on conflict (id) do nothing;   -- nunca bloquear um registo por causa do perfil
  return new;
end;
$$;

-- A função só deve correr como trigger, nunca por chamada direta da API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Perfis para utilizadores que já existiam antes deste script ------
insert into public.profiles (id, full_name)
select u.id,
       left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                     nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
                     split_part(coalesce(u.email, ''), '@', 1)), 80)
from auth.users u
on conflict (id) do nothing;
