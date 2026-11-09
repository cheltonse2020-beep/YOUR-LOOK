-- =====================================================================
-- FORMA — teste das encomendas (preços no servidor, validação e RLS)
-- Executar no SQL Editor DEPOIS de schema.sql, orders.sql e products.sql.
-- Corre numa transação e faz ROLLBACK no fim: não deixa dados.
-- Se tudo correr bem, o resultado final é:
--   "OK: todos os testes de encomendas passaram"
-- =====================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-0000000000c1', 'cliente.a@example.invalid', '{"full_name":"Cliente A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c2', 'cliente.b@example.invalid', '{"full_name":"Cliente B"}', 'authenticated', 'authenticated');

-- ---------- Cliente A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

do $$
declare
  r jsonb;
  ship constant jsonb := '{"name":"Cliente A","address":"Rua das Flores, 10","postal":"1000-001","city":"Lisboa","phone":"912 345 678"}';
  n int;
begin
  -- 1. Encomenda normal; o "price" enviado pelo browser é ignorado
  r := public.place_order(
    '[{"sku":"top:greySweat","size":"M","qty":2,"price":0.01},{"sku":"shoes:court","size":"42","qty":1,"price":0.01}]',
    ship);
  assert (r ->> 'subtotal')::numeric = 159.70, 'FALHOU: subtotal devia vir dos preços do servidor (2×44,90 + 69,90)';
  assert (r ->> 'shipping_cost')::numeric = 0, 'FALHOU: portes deviam ser grátis acima de 100 €';
  assert (r ->> 'total')::numeric = 159.70, 'FALHOU: total errado';
  assert r ->> 'status' = 'pending_payment', 'FALHOU: estado inicial devia ser pending_payment';

  -- 2. Encomenda pequena paga portes
  r := public.place_order('[{"sku":"top:whiteTee","size":"S","qty":1}]', ship);
  assert (r ->> 'total')::numeric = 29.80, 'FALHOU: 24,90 + 4,90 de portes';

  -- 3. Entradas inválidas são recusadas e não deixam encomendas a meio
  begin perform public.place_order('[{"sku":"top:naoExiste","size":"M","qty":1}]', ship);
        raise exception 'FALHOU: aceitou SKU inexistente'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"shoes:court","size":"M","qty":1}]', ship);
        raise exception 'FALHOU: aceitou tamanho de roupa num sapato'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"top:greySweat","size":"M","qty":0}]', ship);
        raise exception 'FALHOU: aceitou quantidade 0'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"top:greySweat","size":"M","qty":11}]', ship);
        raise exception 'FALHOU: aceitou quantidade 11'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"top:greySweat","size":"M","qty":"-1"}]', ship);
        raise exception 'FALHOU: aceitou quantidade negativa'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[]', ship);
        raise exception 'FALHOU: aceitou cesto vazio'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"top:greySweat","size":"M","qty":1}]', jsonb_set(ship, '{postal}', '"1000"'));
        raise exception 'FALHOU: aceitou código postal inválido'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;

  select count(*) into n from public.orders;
  assert n = 2, 'FALHOU: a cliente A devia ter exatamente 2 encomendas (as inválidas não podem ficar gravadas)';
  select count(*) into n from public.order_items;
  assert n = 3, 'FALHOU: a cliente A devia ver 3 linhas de encomenda';

  -- 4. Não pode escrever diretamente nas tabelas
  begin insert into public.orders (user_id, ship_name, ship_address, ship_postal, ship_city, ship_phone, total)
        values ('00000000-0000-4000-8000-0000000000c1', 'x', 'xxxxx', '1000-001', 'x', '912345678', 0.01);
        raise exception 'FALHOU: inseriu encomenda diretamente'; exception when insufficient_privilege then null; end;
  begin update public.orders set status = 'paid';
        raise exception 'FALHOU: alterou o estado da encomenda'; exception when insufficient_privilege then null; end;
  begin update public.order_items set unit_price = 0.01;
        raise exception 'FALHOU: alterou o preço de uma linha'; exception when insufficient_privilege then null; end;
  begin delete from public.orders;
        raise exception 'FALHOU: apagou encomendas'; exception when insufficient_privilege then null; end;
  -- Bloqueado por privilégios (antes de admin.sql) ou pelo RLS (depois): o preço não muda
  begin update public.products set price = 0.01 where sku = 'top:greySweat';
  exception when insufficient_privilege then null; end;
  assert (select price from public.products where sku = 'top:greySweat') = 44.90, 'FALHOU: alterou o preço do catálogo';
end $$;

-- ---------- Cliente B: não vê nada da cliente A ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.orders) = 0, 'FALHOU: o cliente B vê encomendas de A';
  assert (select count(*) from public.order_items) = 0, 'FALHOU: o cliente B vê linhas de encomenda de A';
end $$;

-- ---------- Visitante sem sessão ----------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin perform public.place_order('[{"sku":"top:greySweat","size":"M","qty":1}]', '{}');
        raise exception 'FALHOU: visitante sem sessão conseguiu encomendar'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.orders;
        raise exception 'FALHOU: visitante sem sessão lê encomendas'; exception when insufficient_privilege then null; end;
  assert (select count(*) from public.products) > 0, 'FALHOU: o catálogo devia ser público';
end $$;

reset role;
select 'OK: todos os testes de encomendas passaram' as resultado;

rollback;
