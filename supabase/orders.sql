-- =====================================================================
-- FORMA — encomendas (Supabase)
-- Executar no SQL Editor DEPOIS de schema.sql, e depois products.sql.
--
-- Segurança:
-- - Os preços vêm SEMPRE da tabela products (servidor). O browser só envia
--   SKU, tamanho e quantidade; qualquer preço enviado é ignorado.
-- - Os clientes não escrevem diretamente em orders/order_items: só através
--   da função place_order(), que valida tudo e associa a encomenda a auth.uid().
-- - RLS: cada cliente só vê as suas encomendas. Não pode alterar o estado.
-- - Sem pagamento online por agora: as encomendas ficam 'pending_payment'.
-- =====================================================================

-- 1. Catálogo (preços oficiais) ----------------------------------------
create table if not exists public.products (
  sku         text primary key check (sku ~ '^(top|pants|shoes):[A-Za-z0-9]+$'),
  kind        text not null check (kind in ('top', 'pants', 'shoes')),
  name        text not null,
  color_name  text not null,
  price       numeric(10, 2) not null check (price > 0),
  active      boolean not null default true
);

alter table public.products enable row level security;
drop policy if exists "Catálogo visível" on public.products;
create policy "Catálogo visível" on public.products for select to anon, authenticated using (active);
revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;

-- 2. Encomendas ----------------------------------------------------------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity (start with 1001) unique,
  user_id        uuid not null references auth.users (id) on delete cascade,
  status         text not null default 'pending_payment'
                 check (status in ('pending_payment', 'paid', 'shipped', 'delivered', 'cancelled')),
  subtotal       numeric(10, 2) not null default 0,
  shipping_cost  numeric(10, 2) not null default 0,
  total          numeric(10, 2) not null default 0,
  ship_name      text not null,
  ship_address   text not null,
  ship_postal    text not null,
  ship_city      text not null,
  ship_country   text not null default 'Portugal',
  ship_phone     text not null,
  notes          text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  sku         text not null references public.products (sku),
  name        text not null,          -- cópia no momento da compra
  color_name  text not null,
  size        text not null,
  qty         integer not null check (qty between 1 and 10),
  unit_price  numeric(10, 2) not null check (unit_price > 0)
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- 3. RLS: cada cliente só lê as suas encomendas -------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Ver as próprias encomendas" on public.orders;
create policy "Ver as próprias encomendas" on public.orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Ver linhas das próprias encomendas" on public.order_items;
create policy "Ver linhas das próprias encomendas" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));

-- Só leitura para clientes; sem INSERT/UPDATE/DELETE (o estado é gerido pela loja).
revoke all on table public.orders, public.order_items from anon, authenticated;
grant select on table public.orders, public.order_items to authenticated;

-- 4. Criar encomenda (única forma de um cliente escrever) ---------------
-- p_items:    [{"sku":"top:greySweat","size":"M","qty":1}, ...]
-- p_shipping: {"name":"...","address":"...","postal":"1000-001","city":"...","phone":"...","notes":"..."}
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
  v_qty       integer;
  v_size      text;
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

    v_size := v_item ->> 'size';
    if v_prod.kind = 'shoes' then
      if v_size is null or v_size not in ('38', '39', '40', '41', '42', '43', '44', '45', '46') then
        raise exception 'Número de calçado inválido para %.', v_prod.name;
      end if;
    elsif v_size is null or v_size not in ('XS', 'S', 'M', 'L', 'XL') then
      raise exception 'Tamanho inválido para %.', v_prod.name;
    end if;

    if coalesce(v_item ->> 'qty', '') !~ '^[0-9]{1,2}$' then raise exception 'Quantidade inválida.'; end if;
    v_qty := (v_item ->> 'qty')::integer;
    if v_qty not between 1 and 10 then raise exception 'Quantidade inválida (1 a 10 por artigo).'; end if;

    insert into public.order_items (order_id, sku, name, color_name, size, qty, unit_price)
    values (v_order.id, v_prod.sku, v_prod.name, v_prod.color_name, v_size, v_qty, v_prod.price);

    v_subtotal := v_subtotal + v_prod.price * v_qty;
  end loop;

  v_shipping := case when v_subtotal >= 100 then 0 else 4.90 end;   -- portes grátis a partir de 100 €

  update public.orders
     set subtotal = v_subtotal, shipping_cost = v_shipping, total = v_subtotal + v_shipping
   where id = v_order.id
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'number', v_order.number,
    'status', v_order.status,
    'subtotal', v_order.subtotal,
    'shipping_cost', v_order.shipping_cost,
    'total', v_order.total
  );
end;
$$;

revoke execute on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
