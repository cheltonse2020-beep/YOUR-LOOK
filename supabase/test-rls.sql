-- =====================================================================
-- FORMA — teste de isolamento de perfis (RLS) entre dois utilizadores
-- Executar no SQL Editor DEPOIS de schema.sql.
-- Corre tudo numa transação e faz ROLLBACK no fim: não deixa dados.
-- Se alguma verificação falhar, o script pára com "FALHOU: ...".
-- No fim deve aparecer: "OK: todos os testes de isolamento passaram".
-- =====================================================================
begin;

-- Dois utilizadores de teste (o trigger on_auth_user_created cria os perfis)
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-00000000000a', 'ana.teste@example.invalid',   '{"full_name":"Ana Teste"}',   'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'bruno.teste@example.invalid', '{"full_name":"Bruno Teste"}', 'authenticated', 'authenticated');

do $$
begin
  assert (select count(*) from public.profiles
          where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')) = 2,
         'FALHOU: o trigger não criou os dois perfis';
  assert (select full_name from public.profiles where id = '00000000-0000-4000-8000-00000000000a') = 'Ana Teste',
         'FALHOU: o nome do registo não foi copiado para o perfil';
  assert (select is_admin from public.profiles where id = '00000000-0000-4000-8000-00000000000a') = false,
         'FALHOU: perfil novo não devia ser administrador';
end $$;

-- ---------- A partir daqui, agir como a Ana (role authenticated) ----------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  -- 1. Só vê o próprio perfil
  assert (select count(*) from public.profiles) = 1, 'FALHOU: a Ana vê perfis de outros utilizadores';
  assert (select id from public.profiles) = '00000000-0000-4000-8000-00000000000a', 'FALHOU: a Ana não vê o próprio perfil';

  -- 2. Pode editar o próprio nome
  update public.profiles set full_name = '  Ana Editada  ' where id = '00000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  assert n = 1, 'FALHOU: a Ana não conseguiu editar o próprio nome';
  assert (select full_name from public.profiles) = 'Ana Editada', 'FALHOU: o nome não foi guardado/aparado';

  -- 3. Não consegue editar o perfil do Bruno (0 linhas afetadas)
  update public.profiles set full_name = 'Pirata' where id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'FALHOU: a Ana conseguiu editar o perfil do Bruno';

  -- 4. Não se consegue tornar administradora
  begin
    update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FALHOU: a Ana conseguiu alterar is_admin';
  exception when insufficient_privilege then
    null; -- esperado
  end;

  -- 5. Não consegue criar perfis
  begin
    insert into public.profiles (id, full_name) values ('00000000-0000-4000-8000-00000000000c', 'Falso');
    raise exception 'FALHOU: a Ana conseguiu inserir um perfil';
  exception when insufficient_privilege then
    null;
  end;

  -- 6. Não consegue apagar perfis (nem o próprio, nem o do Bruno)
  begin
    delete from public.profiles where id = '00000000-0000-4000-8000-00000000000b';
    raise exception 'FALHOU: a Ana conseguiu apagar um perfil';
  exception when insufficient_privilege then
    null;
  end;

  -- 7. Não consegue chamar a função do trigger diretamente
  begin
    perform public.handle_new_user();
    raise exception 'FALHOU: a função handle_new_user pode ser chamada diretamente';
  exception when insufficient_privilege or feature_not_supported then
    null;
  end;
end $$;

-- ---------- Agir como o Bruno ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.profiles) = 1, 'FALHOU: o Bruno vê perfis de outros utilizadores';
  assert (select full_name from public.profiles) = 'Bruno Teste', 'FALHOU: o perfil do Bruno foi alterado por outra pessoa';
end $$;

-- ---------- Visitante sem sessão (anon) ----------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform count(*) from public.profiles;
    raise exception 'FALHOU: um visitante sem sessão consegue ler perfis';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
-- Se chegou aqui, todas as verificações passaram (uma falha teria parado o script com "FALHOU: ...").
-- O SQL Editor do Supabase só mostra o resultado do último SELECT, por isso a confirmação é um SELECT.
select 'OK: todos os testes de isolamento passaram' as resultado;

rollback;
