-- =====================================================================
-- YOUR LOOK — teste de eliminação de produtos (product-delete.sql)
-- Executar no SQL Editor DEPOIS de product-delete.sql. Faz ROLLBACK no fim.
-- Resultado esperado: "OK: eliminação de produtos protegida"
-- =====================================================================
begin;

insert into public.products (sku, kind, name, color_name, price, active) values
  ('top:delSolto',   'top',   'Solto',      'Preto', 10, true),
  ('top:delPedido',  'top',   'Encomendado','Preto', 10, true),
  ('top:delUnico',   'top',   'Única peça', 'Preto', 10, true),
  ('pants:delPar1',  'pants', 'Par 1',      'Preto', 10, true),
  ('pants:delPar2',  'pants', 'Par 2',      'Preto', 10, true);
insert into public.product_variants (product_sku, color_name, size, stock) values ('top:delSolto', 'Preto', 'M', 3);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000007a1', 'admin.del@example.invalid',   '{"full_name":"Admin"}',   'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000007c3', 'cliente.del@example.invalid', '{"full_name":"Cliente"}', 'authenticated', 'authenticated');
update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-0000000007a1';

insert into public.orders (id, user_id, ship_name, ship_address, ship_postal, ship_city, ship_phone, notes)
  values ('00000000-0000-4000-8000-0000000007d1', '00000000-0000-4000-8000-0000000007c3', 'Cliente', 'Rua 1, 2', '1000-001', 'Lisboa', '912345678', '');
insert into public.order_items (order_id, sku, name, color_name, size, qty, unit_price)
  values ('00000000-0000-4000-8000-0000000007d1', 'top:delPedido', 'Encomendado', 'Preto', 'M', 1, 10);

insert into public.looks (id, name, category_id, image_path, status) values
  ('00000000-0000-4000-8000-0000000007e1', 'Look Único', 'gym', 'a.png', 'draft'),
  ('00000000-0000-4000-8000-0000000007e2', 'Look Par',   'gym', 'b.png', 'draft');
insert into public.look_products (look_id, product_sku, position) values
  ('00000000-0000-4000-8000-0000000007e1', 'top:delUnico', 0),
  ('00000000-0000-4000-8000-0000000007e2', 'pants:delPar1', 0),
  ('00000000-0000-4000-8000-0000000007e2', 'pants:delPar2', 1);
update public.looks set status = 'published' where id in ('00000000-0000-4000-8000-0000000007e1', '00000000-0000-4000-8000-0000000007e2');

-- ---------- Cliente: não elimina nada ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007c3","role":"authenticated"}', true);
do $$
declare n int;
begin
  begin perform public.admin_delete_product('top:delSolto');
        raise exception 'FALHOU: cliente eliminou um produto'; exception when insufficient_privilege then null; end;
  begin delete from public.products where sku = 'top:delSolto'; get diagnostics n = row_count;
        assert n = 0, 'FALHOU: cliente apagou diretamente';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------- Administrador ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007a1","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  -- produto solto (com variante): eliminado
  r := public.admin_delete_product('top:delSolto');
  assert not exists (select 1 from public.products where sku = 'top:delSolto'), 'FALHOU: não eliminou';

  -- produto numa encomenda: recusado
  begin perform public.admin_delete_product('top:delPedido');
        raise exception 'FALHOU: eliminou produto de uma encomenda'; exception when raise_exception then
          if sqlerrm like 'FALHOU%' then raise; end if; end;
  assert exists (select 1 from public.products where sku = 'top:delPedido'), 'FALHOU: produto da encomenda desapareceu';

  -- única peça de um look publicado: recusado
  begin perform public.admin_delete_product('top:delUnico');
        raise exception 'FALHOU: deixou um look publicado vazio'; exception when raise_exception then
          if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- peça de um look com outra peça: sai do look, o look continua publicado
  r := public.admin_delete_product('pants:delPar1');
  assert r -> 'looks' ? 'Look Par', 'FALHOU: não indicou o look afetado';
  assert (select count(*) from public.look_products where look_id = '00000000-0000-4000-8000-0000000007e2') = 1, 'FALHOU: look não atualizado';
  assert (select status from public.looks where id = '00000000-0000-4000-8000-0000000007e2') = 'published', 'FALHOU: look despublicado';

  begin perform public.admin_delete_product('top:naoExiste');
        raise exception 'FALHOU: aceitou produto inexistente'; exception when raise_exception then
          if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

select 'OK: eliminação de produtos protegida' as resultado;
rollback;
