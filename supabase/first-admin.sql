-- =====================================================================
-- FORMA — atribuir o PRIMEIRO administrador
-- Executar no SQL Editor do Supabase (só quem gere o projeto tem acesso),
-- DEPOIS de schema.sql e admin.sql.
--
-- 1. Substitui o email abaixo pelo da conta que vai ser administradora.
-- 2. A conta tem de existir (registada na loja) e ter o email confirmado.
--
-- O email serve APENAS para encontrar a conta. A permissão fica associada ao
-- ID do utilizador, em public.profiles.is_admin — um campo que os clientes não
-- conseguem alterar (privilégios de coluna + trigger) e que não está nos
-- metadados editáveis do utilizador. O site nunca compara emails para autorizar.
-- Só altera a linha dessa conta; não mexe em mais nada.
-- =====================================================================
do $$
declare
  v_email text := lower(btrim('o-teu-email@exemplo.pt'));   -- ← substitui aqui
  v_user  auth.users%rowtype;
  v_found integer;
  v_others text;
begin
  if v_email = 'o-teu-email@exemplo.pt' then
    raise exception 'Substitui primeiro o email na linha "v_email" deste script.';
  end if;

  select count(*) into v_found from auth.users where lower(email) = v_email;
  if v_found = 0 then
    raise exception 'Não existe nenhuma conta com o email %. Regista-a primeiro na loja e confirma o email.', v_email;
  end if;
  if v_found > 1 then
    raise exception 'Há % contas com o email %. Atribui a permissão pelo ID do utilizador.', v_found, v_email;
  end if;

  select * into v_user from auth.users where lower(email) = v_email;
  if v_user.email_confirmed_at is null then
    raise exception 'A conta % ainda não confirmou o email. Abre o link de confirmação e tenta de novo.', v_email;
  end if;

  -- Perfil: normalmente já existe (criado no registo); se não existir, cria-o.
  insert into public.profiles (id, full_name, is_admin)
  values (v_user.id, left(coalesce(nullif(btrim(v_user.raw_user_meta_data ->> 'full_name'), ''), split_part(v_email, '@', 1)), 80), true)
  on conflict (id) do update set is_admin = true
   where public.profiles.is_admin is distinct from true;

  select string_agg(u.email, ', ') into v_others
    from public.profiles p join auth.users u on u.id = p.id
   where p.is_admin and p.id <> v_user.id;

  raise notice 'OK: % (ID %) é administrador.', v_email, v_user.id;
  if v_others is not null then
    raise notice 'Atenção: também são administradores: %', v_others;
  end if;
end $$;

-- Confirmação: lista de administradores (deve aparecer só a tua conta)
select p.id as user_id, u.email, p.is_admin
  from public.profiles p join auth.users u on u.id = p.id
 where p.is_admin;

-- Para retirar a permissão mais tarde:
--   update public.profiles set is_admin = false where id = '<user_id>';
