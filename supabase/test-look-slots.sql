-- =====================================================================
-- YOUR LOOK — teste de acessórios e tamanhos à venda (look-slots.sql)
-- Executar no SQL Editor DEPOIS de look-slots.sql. Corre numa transação e faz
-- ROLLBACK no fim: não deixa dados. Resultado esperado:
--   "OK: acessórios e tamanhos à venda funcionam"
-- =====================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000005a1', 'admin.slots@example.invalid',   '{"full_name":"Admin"}',   'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000005c3', 'cliente.slots@example.invalid', '{"full_name":"Cliente"}', 'authenticated', 'authenticated');
update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-0000000005a1';

-- ======================= Administrador =======================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000005a1","role":"authenticated"}', true);

do $$
begin
  insert into public.products (sku, kind, name, color_name, price, status, sizes)
    values ('top:slotShirt', 'top', 'Camisa Slot', 'Branco', 40, 'published', '{S,M}');
  insert into public.products (sku, kind, name, color_name, style, price, status)
    values ('accessory:slotGlasses', 'accessory', 'Óculos Slot', 'Preto', 'glasses', 25, 'published');
  insert into public.products (sku, kind, name, color_name, price, status)
    values ('shoes:slotShoe', 'shoes', 'Sapato Slot', 'Preto', 80, 'published');

  -- tamanhos inválidos são recusados pela base de dados
  begin update public.products set sizes = '{m}' where sku = 'top:slotShirt';
        raise exception 'FALHOU: aceitou tamanho em minúsculas'; exception when check_violation then null; end;
  begin update public.products set sizes = '{M,M}' where sku = 'top:slotShirt';
        raise exception 'FALHOU: aceitou tamanho repetido'; exception when check_violation then null; end;
  begin insert into public.products (sku, kind, name, color_name, price) values ('hat:x', 'hat', 'X', 'Preto', 1);
        raise exception 'FALHOU: aceitou tipo desconhecido'; exception when check_violation then null; end;

  update public.products set sizes = '{S,M,L}' where sku = 'top:slotShirt';
  assert (select sizes from public.products where sku = 'top:slotShirt') = '{S,M,L}', 'FALHOU: administrador não guardou os tamanhos';
end $$;

-- ======================= Cliente =======================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000005c3","role":"authenticated"}', true);

do $$
declare
  ship jsonb := '{"name":"Cliente Teste","address":"Rua de Teste 1","postal":"1000-001","city":"Lisboa","phone":"912345678"}';
  r jsonb;
  n int;
begin
  -- o cliente não muda os tamanhos
  update public.products set sizes = '{XS,S,M,L,XL}' where sku = 'top:slotShirt';
  get diagnostics n = row_count;
  assert n = 0, 'FALHOU: cliente alterou os tamanhos à venda';

  -- tamanho ativado: aceite; acessório em tamanho único: aceite; sapato sem lista: tamanhos padrão
  r := public.place_order('[{"sku":"top:slotShirt","size":"L","qty":1},{"sku":"accessory:slotGlasses","size":"U","qty":1},{"sku":"shoes:slotShoe","size":"42","qty":1}]', ship);
  assert (r ->> 'total')::numeric = 145, 'FALHOU: total errado ' || (r ->> 'total');

  -- tamanho NÃO ativado: recusado (XL é padrão, mas não está na lista desta camisa)
  begin perform public.place_order('[{"sku":"top:slotShirt","size":"XL","qty":1}]', ship);
        raise exception 'FALHOU: vendeu um tamanho não ativado'; exception when raise_exception then
          if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"accessory:slotGlasses","size":"M","qty":1}]', ship);
        raise exception 'FALHOU: acessório vendido num tamanho'; exception when raise_exception then
          if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.place_order('[{"sku":"shoes:slotShoe","size":"M","qty":1}]', ship);
        raise exception 'FALHOU: sapato vendido em tamanho de roupa'; exception when raise_exception then
          if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

select 'OK: acessórios e tamanhos à venda funcionam' as resultado;
rollback;
