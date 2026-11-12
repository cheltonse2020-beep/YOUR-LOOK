-- =====================================================================
-- YOUR LOOK — acessórios e tamanhos à venda por produto
-- Executar no SQL Editor DEPOIS de admin.sql. Pode ser executado mais de uma vez.
-- Só acrescenta: não apaga produtos, looks nem encomendas.
--
-- 1. Novo tipo de produto «accessory» (óculos, relógio, colar, chapéu, mala, cinto…),
--    vendido em tamanho único (código 'U').
-- 2. products.sizes — tamanhos ATIVADOS para venda (ex.: {S,M,L}). Vazio = tamanhos
--    padrão (XS–XL ou 38–46). Quem decide é o servidor (place_order), não o browser.
--    Produtos com variantes de stock continuam a usar as variantes.
-- =====================================================================

-- 1. Tipos de produto ---------------------------------------------------
do $$
declare c record;
begin
  -- retira a verificação antiga do tipo (top/pants/shoes), seja qual for o nome
  for c in
    select con.conname from pg_constraint con
     where con.conrelid = 'public.products'::regclass and con.contype = 'c'
       and (pg_get_constraintdef(con.oid) ilike '%kind%' or pg_get_constraintdef(con.oid) ilike '%sku%')
       and pg_get_constraintdef(con.oid) not ilike '%accessory%'
  loop
    execute format('alter table public.products drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'products_kind_v2_check') then
    alter table public.products add constraint products_kind_v2_check
      check (kind in ('top', 'pants', 'shoes', 'accessory'));
  end if;
  -- o código (SKU) começa pelo tipo: top:…, pants:…, shoes:…, accessory:…
  if not exists (select 1 from pg_constraint where conname = 'products_sku_v2_check') then
    alter table public.products add constraint products_sku_v2_check
      check (sku ~ '^(top|pants|shoes|accessory):[A-Za-z0-9]+$');
  end if;
end $$;

-- 2. Tamanhos à venda ---------------------------------------------------
alter table public.products add column if not exists sizes text[] not null default '{}';

-- valida a lista de tamanhos (função imutável para poder ser usada num CHECK)
create or replace function public.valid_sizes(p text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(p) <= 20
     and not exists (select 1 from unnest(p) s where s is null or s !~ '^[A-Z0-9]{1,6}$')
     and cardinality(p) = (select count(distinct s) from unnest(p) s)
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_sizes_check') then
    alter table public.products add constraint products_sizes_check check (public.valid_sizes(sizes));
  end if;
end $$;

-- 3. Formas/ícones: acrescenta os tipos de acessório -------------------
alter table public.products drop constraint if exists products_admin_fields_check;
alter table public.products add constraint products_admin_fields_check check (
  char_length(btrim(name)) between 1 and 80
  and char_length(btrim(color_name)) between 1 and 40
  and char_length(description) <= 1000
  and cardinality(images) <= 8
  and price <= 10000
  and (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$')
  and (style is null or style in ('sweater', 'tee', 'shirt', 'camp', 'tank',
                                  'baggy', 'straight', 'jogger', 'shorts', 'runshorts', 'sandal',
                                  'glasses', 'watch', 'necklace', 'hat', 'bag', 'belt', 'other'))
);

-- 4. Permissões: só administradores escrevem (RLS de admin.sql); acrescenta a coluna nova
grant insert (sku, kind, name, color_name, color_hex, style, description, images, price, status, sizes) on table public.products to authenticated;
grant update (name, color_name, color_hex, style, description, images, price, status, sizes) on table public.products to authenticated;

-- 5. Encomendas: o servidor só aceita tamanhos ativados -----------------
create or replace function public.place_order(p_items jsonb, p_shipping jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_order     public.orders%rowtype;
  v_item      jsonb;
  v_prod      public.products%rowtype;
  v_variant   public.product_variants%rowtype;
  v_tracked   boolean;
  v_color     text;
  v_qty       integer;
  v_size      text;
  v_allowed   text[];
  v_subtotal  numeric(10, 2) := 0;
  v_shipping  numeric(10, 2);
  v_name      text := btrim(coalesce(p_shipping ->> 'name', ''));
  v_address   text := btrim(coalesce(p_shipping ->> 'address', ''));
  v_postal    text := btrim(coalesce(p_shipping ->> 'postal', ''));
  v_city      text := btrim(coalesce(p_shipping ->> 'city', ''));
  v_phone     text := btrim(coalesce(p_shipping ->> 'phone', ''));
  v_notes     text := btrim(coalesce(p_shipping ->> 'notes', ''));
begin
  if v_uid is null then
    raise exception 'Precisas de iniciar sessão para encomendar.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O cesto está vazio.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados artigos numa só encomenda (máximo 50 linhas).';
  end if;

  if char_length(v_name) not between 2 and 80 then raise exception 'Indica o nome para a entrega.'; end if;
  if char_length(v_address) not between 5 and 200 then raise exception 'Indica a morada completa.'; end if;
  if v_postal !~ '^[0-9]{4}-[0-9]{3}$' then raise exception 'Código postal inválido (formato 0000-000).'; end if;
  if char_length(v_city) not between 2 and 80 then raise exception 'Indica a localidade.'; end if;
  if v_phone !~ '^[+0-9 ()-]{9,20}$' then raise exception 'Número de telefone inválido.'; end if;
  if char_length(v_notes) > 500 then raise exception 'As notas podem ter no máximo 500 caracteres.'; end if;

  insert into public.orders (user_id, ship_name, ship_address, ship_postal, ship_city, ship_phone, notes)
  values (v_uid, v_name, v_address, v_postal, v_city, v_phone, v_notes)
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Artigo inválido.'; end if;

    select * into v_prod from public.products where sku = v_item ->> 'sku' and active;
    if not found then
      raise exception 'Um dos artigos já não está disponível (%).', coalesce(v_item ->> 'sku', '?');
    end if;

    if coalesce(v_item ->> 'qty', '') !~ '^[0-9]{1,2}$' then raise exception 'Quantidade inválida.'; end if;
    v_qty := (v_item ->> 'qty')::integer;
    if v_qty not between 1 and 10 then raise exception 'Quantidade inválida (1 a 10 por artigo).'; end if;

    v_size := v_item ->> 'size';
    v_color := coalesce(nullif(btrim(v_item ->> 'color'), ''), v_prod.color_name);
    v_tracked := exists (select 1 from public.product_variants where product_sku = v_prod.sku and active);

    if v_tracked then
      select * into v_variant from public.product_variants
       where product_sku = v_prod.sku and active and size = v_size and lower(color_name) = lower(v_color)
       for update;
      if not found then
        raise exception 'O tamanho % de % (%) não está disponível.', coalesce(v_size, '?'), v_prod.name, v_color;
      end if;
      if v_variant.stock < v_qty then
        raise exception 'Stock insuficiente para % (%, %): restam %.', v_prod.name, v_variant.color_name, v_size, v_variant.stock;
      end if;
      update public.product_variants set stock = stock - v_qty where id = v_variant.id;
      v_color := v_variant.color_name;
    else
      -- tamanhos ativados no painel; sem lista, os tamanhos padrão do tipo
      v_allowed := case
        when cardinality(v_prod.sizes) > 0 then v_prod.sizes
        when v_prod.kind = 'shoes' then array['38', '39', '40', '41', '42', '43', '44', '45', '46']
        when v_prod.kind = 'accessory' then array['U']
        else array['XS', 'S', 'M', 'L', 'XL']
      end;
      if v_size is null or not (v_size = any (v_allowed)) then
        raise exception 'O tamanho % de % não está disponível.', coalesce(v_size, '?'), v_prod.name;
      end if;
      v_color := v_prod.color_name;
    end if;

    insert into public.order_items (order_id, sku, name, color_name, size, qty, unit_price, variant_id)
    values (v_order.id, v_prod.sku, v_prod.name, v_color, v_size, v_qty, v_prod.price,
            case when v_tracked then v_variant.id end);

    v_subtotal := v_subtotal + v_prod.price * v_qty;
  end loop;

  v_shipping := case when v_subtotal >= 100 then 0 else 4.90 end;

  update public.orders
     set subtotal = v_subtotal, shipping_cost = v_shipping, total = v_subtotal + v_shipping
   where id = v_order.id
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id, 'number', v_order.number, 'status', v_order.status,
    'subtotal', v_order.subtotal, 'shipping_cost', v_order.shipping_cost, 'total', v_order.total
  );
end;
$$;
revoke execute on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
revoke execute on function public.valid_sizes(text[]) from public, anon;
grant execute on function public.valid_sizes(text[]) to authenticated;
