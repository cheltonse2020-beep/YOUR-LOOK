-- =====================================================================
-- YOUR LOOK — teste do painel de administração (permissões, stock, looks, envios)
-- Executar no SQL Editor DEPOIS de admin.sql. Corre numa transação e faz
-- ROLLBACK no fim: não deixa dados. Resultado esperado:
--   "OK: todos os testes de administração passaram"
-- =====================================================================
begin;

-- Produtos próprios do teste (desaparecem no ROLLBACK): o teste não depende do catálogo da loja
insert into public.products (sku, kind, name, color_name, price, active) values
  ('top:testeSweat',   'top',   'Sweatshirt Teste', 'Cinzento', 44.90, true),
  ('top:testeTee',     'top',   'T-shirt Teste',    'Branco',   24.90, true),
  ('pants:testeJeans', 'pants', 'Jeans Teste',      'Azul',     59.90, true),
  ('shoes:testeCourt', 'shoes', 'Sapatilhas Teste', 'Branco',   69.90, true);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'admin.teste@example.invalid',   '{"full_name":"Admin Teste"}',   'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c3', 'cliente.teste@example.invalid', '{"full_name":"Cliente Teste"}', 'authenticated', 'authenticated');
update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-0000000000a1';   -- como no SQL Editor

-- Registo malicioso: metadados a pedir administrador NÃO dão permissão
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'esperto.teste@example.invalid', '{"full_name":"Esperto","is_admin":true,"role":"admin"}', 'authenticated', 'authenticated');
do $$
begin
  assert (select is_admin from public.profiles where id = '00000000-0000-4000-8000-0000000000e1') = false,
         'FALHOU: o registo atribuiu administrador a partir dos metadados';
end $$;

-- ======================= Cliente comum =======================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);

do $$
begin
  -- O mesmo vale para quem se registou a pedir administrador nos metadados
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
  assert not public.is_admin(), 'FALHOU: metadados do registo deram acesso de administrador';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
end $$;

do $$
declare n int;
begin
  assert not public.is_admin(), 'FALHOU: cliente comum é considerado administrador';

  begin update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-0000000000c3';
        raise exception 'FALHOU: cliente tornou-se administrador'; exception when insufficient_privilege then null; end;

  begin insert into public.products (sku, kind, name, color_name, price) values ('top:hack1', 'top', 'X', 'Preto', 1);
        raise exception 'FALHOU: cliente criou produto'; exception when insufficient_privilege then null; end;

  update public.products set price = 0.01 where sku = 'top:testeSweat';
  get diagnostics n = row_count;
  assert n = 0, 'FALHOU: cliente alterou o preço de um produto';
  assert (select price from public.products where sku = 'top:testeSweat') = 44.90, 'FALHOU: preço alterado';

  begin update public.products set sku = 'top:outro' where sku = 'top:testeSweat';
        raise exception 'FALHOU: cliente alterou SKU'; exception when insufficient_privilege then null; end;

  begin insert into public.categories (id, name) values ('hack', 'Hack');
        raise exception 'FALHOU: cliente criou categoria'; exception when insufficient_privilege then null; end;
  update public.categories set visible = false where id = 'gym';
  get diagnostics n = row_count;
  assert n = 0, 'FALHOU: cliente escondeu uma categoria';

  begin insert into public.looks (name, category_id) values ('Hack', 'gym');
        raise exception 'FALHOU: cliente criou look'; exception when insufficient_privilege then null; end;
  begin insert into public.product_variants (product_sku, color_name, size, stock) values ('top:testeSweat', 'Cinzento', 'M', 99);
        raise exception 'FALHOU: cliente criou variante'; exception when insufficient_privilege then null; end;

  begin perform public.admin_overview();
        raise exception 'FALHOU: cliente viu a visão geral'; exception when insufficient_privilege then null; end;
  begin perform public.admin_list_orders();
        raise exception 'FALHOU: cliente listou encomendas'; exception when insufficient_privilege then null; end;
  begin perform public.admin_set_fulfillment(gen_random_uuid(), 'shipped');
        raise exception 'FALHOU: cliente alterou envio'; exception when insufficient_privilege then null; end;

  begin insert into storage.objects (bucket_id, name) values ('looks', 'hack.png');
        raise exception 'FALHOU: cliente carregou imagem'; exception when insufficient_privilege then null; end;
end $$;

-- ======================= Administrador =======================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  v_look uuid;
  r jsonb;
begin
  assert public.is_admin(), 'FALHOU: administrador não reconhecido';

  -- Categoria, produto e variantes
  insert into public.categories (id, name, position) values ('teste-cat', 'Teste', 9);
  insert into public.products (sku, kind, name, color_name, color_hex, style, price, status, description)
    values ('top:testeAdmin', 'top', 'T-shirt Teste', 'Preto', '#111111', 'tee', 30, 'draft', 'Algodão.');
  insert into public.product_variants (product_sku, color_name, size, stock) values
    ('top:testeAdmin', 'Preto', 'M', 2), ('top:testeAdmin', 'Preto', 'L', 0);

  -- Validações
  begin update public.products set price = -5 where sku = 'top:testeAdmin';
        raise exception 'FALHOU: aceitou preço negativo'; exception when check_violation then null; end;
  begin update public.products set price = 0 where sku = 'top:testeAdmin';
        raise exception 'FALHOU: aceitou preço zero'; exception when check_violation then null; end;
  begin update public.product_variants set stock = -1 where product_sku = 'top:testeAdmin';
        raise exception 'FALHOU: aceitou stock negativo'; exception when check_violation then null; end;
  begin update public.product_variants set size = 'M M' where product_sku = 'top:testeAdmin';
        raise exception 'FALHOU: aceitou tamanho inválido'; exception when check_violation then null; end;

  -- Look: não publica sem imagem nem produtos
  insert into public.looks (name, category_id, position) values ('Look Teste', 'teste-cat', 0) returning id into v_look;
  begin update public.looks set status = 'published' where id = v_look;
        raise exception 'FALHOU: publicou look sem imagem'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  update public.looks set image_path = 'teste/modelo.png' where id = v_look;
  insert into public.look_products (look_id, product_sku, position) values (v_look, 'top:testeAdmin', 0);
  begin update public.looks set status = 'published' where id = v_look;
        raise exception 'FALHOU: publicou look só com produtos em rascunho'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  update public.products set status = 'published' where sku = 'top:testeAdmin';
  assert (select active from public.products where sku = 'top:testeAdmin'), 'FALHOU: active não segue o estado';
  insert into public.look_products (look_id, product_sku, position) values (v_look, 'pants:testeJeans', 1);
  update public.looks set status = 'published' where id = v_look;
  assert (select published_at is not null from public.looks where id = v_look), 'FALHOU: published_at';

  begin delete from public.look_products where look_id = v_look;
        raise exception 'FALHOU: look publicado ficou sem produtos'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;

  perform set_config('forma.test_look', v_look::text, true);

  -- Visão geral com dados reais
  r := public.admin_overview();
  assert (r -> 'low_stock') @> '[{"sku":"top:testeAdmin","size":"L","stock":0}]', 'FALHOU: stock baixo não aparece';

  -- Admin não escreve diretamente nas encomendas (só pelas funções)
  begin update public.orders set payment_status = 'paid';
        raise exception 'FALHOU: admin alterou pagamento diretamente'; exception when insufficient_privilege then null; end;
end $$;

-- ======================= Visitante: vê o look publicado =======================
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  assert exists (select 1 from public.looks where name = 'Look Teste' and status = 'published'), 'FALHOU: visitante não vê look publicado';
  assert (select count(*) from public.look_products where look_id = current_setting('forma.test_look')::uuid) = 2,
         'FALHOU: visitante não vê os produtos do look';
  assert exists (select 1 from public.categories where id = 'teste-cat'), 'FALHOU: categoria visível não aparece';
  begin perform count(*) from public.product_variants;
        raise exception 'FALHOU: visitante lê o stock'; exception when insufficient_privilege then null; end;
end $$;

-- ======================= Cliente encomenda (stock) =======================
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
do $$
declare
  ship constant jsonb := '{"name":"Cliente Teste","address":"Rua de Teste, 1","postal":"4000-001","city":"Porto","phone":"912345678"}';
  r jsonb;
begin
  assert not exists (select 1 from public.looks where status = 'draft' and name = 'Look Teste'), 'FALHOU';
  begin perform public.place_order('[{"sku":"top:testeAdmin","size":"M","qty":3}]', ship);
        raise exception 'FALHOU: vendeu mais do que o stock'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"top:testeAdmin","size":"XL","qty":1}]', ship);
        raise exception 'FALHOU: vendeu tamanho sem variante'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"top:testeAdmin","size":"L","qty":1}]', ship);
        raise exception 'FALHOU: vendeu variante esgotada'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;

  r := public.place_order('[{"sku":"top:testeAdmin","size":"M","qty":2}]', ship);
  perform set_config('forma.order_a', r ->> 'id', true);
  r := public.place_order('[{"sku":"pants:testeJeans","size":"M","qty":1}]', ship);   -- sem variantes: sem controlo de stock
  perform set_config('forma.order_b', r ->> 'id', true);
end $$;

-- ======================= Administrador: envios e pagamento =======================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare
  a uuid := current_setting('forma.order_a')::uuid;
  b uuid := current_setting('forma.order_b')::uuid;
  r jsonb;
begin
  assert (select stock from public.product_variants where product_sku = 'top:testeAdmin' and size = 'M') = 0, 'FALHOU: stock não descontado';
  assert (select variant_id is not null from public.order_items where order_id = a), 'FALHOU: variante não guardada na linha';

  r := public.admin_list_orders(p_search := 'cliente.teste@');
  assert (r ->> 'total')::int = 2, 'FALHOU: pesquisa por email';
  r := public.admin_order_detail(a);
  assert r ->> 'email' = 'cliente.teste@example.invalid' and (r -> 'items' -> 0 ->> 'unit_price')::numeric = 30, 'FALHOU: detalhe da encomenda';

  -- Sem pagamento confirmado não se envia
  begin perform public.admin_set_fulfillment(a, 'shipped');
        raise exception 'FALHOU: enviou encomenda não paga'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  r := public.admin_set_fulfillment(a, 'preparing');
  assert r ->> 'payment_status' = 'pending' and r ->> 'status' = 'pending_payment', 'FALHOU: preparar mexeu no pagamento';

  -- Cancelar repõe o stock
  r := public.admin_set_fulfillment(a, 'cancelled');
  assert (select stock from public.product_variants where product_sku = 'top:testeAdmin' and size = 'M') = 2, 'FALHOU: stock não reposto';
  begin perform public.admin_set_fulfillment(a, 'preparing');
        raise exception 'FALHOU: reabriu encomenda cancelada'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- Pagamento confirmado pela Stripe (webhook, chave de serviço = fora do papel authenticated)
reset role;
update public.orders set status = 'paid' where id = current_setting('forma.order_b')::uuid and status = 'pending_payment';  -- escrita antiga
do $$
begin
  assert (select payment_status from public.orders where id = current_setting('forma.order_b')::uuid) = 'paid', 'FALHOU: webhook não confirmou o pagamento';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare
  b uuid := current_setting('forma.order_b')::uuid;
  r jsonb;
begin
  begin perform public.admin_set_fulfillment(b, 'delivered');
        raise exception 'FALHOU: entregue sem envio'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  r := public.admin_set_fulfillment(b, 'shipped');
  assert r ->> 'status' = 'shipped' and r ->> 'payment_status' = 'paid', 'FALHOU: envio';
  begin perform public.admin_set_fulfillment(b, 'cancelled');
        raise exception 'FALHOU: cancelou encomenda enviada'; exception when raise_exception then
        if sqlerrm like 'FALHOU%' then raise; end if; end;
  r := public.admin_set_fulfillment(b, 'delivered');
  assert r ->> 'status' = 'delivered', 'FALHOU: entrega';
end $$;

-- O cliente vê o estado atualizado da sua encomenda, mas não a dos outros
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
do $$
begin
  assert (select status from public.orders where id = current_setting('forma.order_b')::uuid) = 'delivered', 'FALHOU: cliente não vê estado';
  assert (select count(*) from public.orders) = 2, 'FALHOU: cliente vê encomendas de outros';
end $$;

reset role;
select 'OK: todos os testes de administração passaram' as resultado;

rollback;
