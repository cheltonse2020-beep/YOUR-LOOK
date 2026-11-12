-- =====================================================================
-- YOUR LOOK — eliminar produtos a partir do painel de administração
-- Executar no SQL Editor DEPOIS de admin.sql. Pode ser executado mais de uma vez.
--
-- admin_delete_product(sku) — só administradores (validado no servidor):
--   • recusa se o produto estiver em encomendas (as encomendas precisam dele: arquiva-o);
--   • recusa se for a única peça publicada de um look publicado (o look ficaria vazio na loja);
--   • senão retira-o dos looks, apaga as variantes de stock e apaga o produto.
-- Os clientes continuam sem qualquer permissão para apagar (sem DELETE na tabela).
-- =====================================================================
create or replace function public.admin_delete_product(p_sku text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text;
  v_orders integer;
  v_looks  text[];
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  select name into v_name from public.products where sku = p_sku for update;
  if not found then
    raise exception 'Este produto já não existe.';
  end if;

  select count(*) into v_orders from public.order_items where sku = p_sku;
  if v_orders > 0 then
    raise exception '«%» está em % encomenda(s) e não pode ser eliminado: as encomendas precisam dele. Usa «Arquivar» para o esconder da loja.', v_name, v_orders;
  end if;

  -- looks publicados que ficariam sem nenhuma peça publicada
  select array_agg(l.name order by l.name) into v_looks
    from public.looks l
   where l.status = 'published'
     and exists (select 1 from public.look_products lp where lp.look_id = l.id and lp.product_sku = p_sku)
     and not exists (select 1 from public.look_products lp join public.products p on p.sku = lp.product_sku
                      where lp.look_id = l.id and lp.product_sku <> p_sku and p.status = 'published');
  if v_looks is not null then
    raise exception '«%» é a única peça publicada do look %. Junta-lhe outra peça ou despublica o look antes de eliminar.', v_name, array_to_string(v_looks, ', ');
  end if;

  select array_agg(distinct l.name) into v_looks
    from public.look_products lp join public.looks l on l.id = lp.look_id
   where lp.product_sku = p_sku;

  delete from public.look_products   where product_sku = p_sku;
  delete from public.product_variants where product_sku = p_sku;
  delete from public.products        where sku = p_sku;

  return jsonb_build_object('sku', p_sku, 'name', v_name, 'looks', coalesce(to_jsonb(v_looks), '[]'::jsonb));
end;
$$;
revoke execute on function public.admin_delete_product(text) from public, anon;
grant execute on function public.admin_delete_product(text) to authenticated;
