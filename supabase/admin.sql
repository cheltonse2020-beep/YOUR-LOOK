-- =====================================================================
-- FORMA / Your Look — painel de administração (migração)
-- Executar no SQL Editor DEPOIS de: schema.sql, orders.sql, products.sql, payments.sql.
-- Só acrescenta: não apaga tabelas, colunas nem dados. Pode ser executado várias vezes.
--
-- Autorização: public.profiles.is_admin (já existente). O utilizador não o pode
-- alterar (privilégios de coluna + trigger em schema.sql). O primeiro administrador
-- é definido no SQL Editor — ver o fim deste ficheiro.
-- =====================================================================

-- 0. É administrador? ----------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Função comum: atualiza updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 1. Categorias ----------------------------------------------------------
create table if not exists public.categories (
  id          text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40),
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  description text not null default '' check (char_length(description) <= 200),
  image_url   text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 500)),
  position    integer not null default 0 check (position between 0 and 9999),
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.categories (id, name, description, position) values
  ('date-night', 'Date Night', 'conjuntos para uma noite especial.', 1),
  ('gym',        'Gym',        'conjuntos para treinar com estilo.', 2),
  ('beach',      'Beach',      'conjuntos para dias de praia.',      3),
  ('run',        'Run',        'conjuntos para correr.',             4)
on conflict (id) do nothing;

drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

-- 2. Produtos: descrição, fotografias, publicação ------------------------
alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists images      text[] not null default '{}';
alter table public.products add column if not exists color_hex   text;
alter table public.products add column if not exists style       text;
alter table public.products add column if not exists status      text;
alter table public.products add column if not exists created_at  timestamptz not null default now();
alter table public.products add column if not exists updated_at  timestamptz not null default now();

update public.products set status = case when active then 'published' else 'archived' end where status is null;
alter table public.products alter column status set default 'published';
alter table public.products alter column status set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_status_check') then
    alter table public.products add constraint products_status_check check (status in ('draft', 'published', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_admin_fields_check') then
    alter table public.products add constraint products_admin_fields_check check (
      char_length(btrim(name)) between 1 and 80
      and char_length(btrim(color_name)) between 1 and 40
      and char_length(description) <= 1000
      and cardinality(images) <= 8
      and price <= 10000
      and (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$')
      and (style is null or style in ('sweater', 'tee', 'shirt', 'camp', 'tank',
                                      'baggy', 'straight', 'jogger', 'shorts', 'runshorts', 'sandal'))
    );
  end if;
end $$;

-- "active" (usado por place_order) segue sempre o estado de publicação
create or replace function public.products_sync()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.active := (new.status = 'published');
  new.name := btrim(new.name);
  new.color_name := btrim(new.color_name);
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists products_sync on public.products;
create trigger products_sync before insert or update on public.products
  for each row execute function public.products_sync();
update public.products set status = status;   -- alinha "active" nas linhas existentes

-- 3. Variantes (cor + tamanho) com stock independente -------------------
create table if not exists public.product_variants (
  id          bigint generated always as identity primary key,
  product_sku text not null references public.products (sku),
  color_name  text not null check (char_length(btrim(color_name)) between 1 and 40),
  color_hex   text check (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$'),
  size        text not null check (size ~ '^[A-Za-z0-9]{1,6}$'),
  stock       integer not null default 0 check (stock between 0 and 100000),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_sku, color_name, size)
);
create index if not exists product_variants_sku_idx on public.product_variants (product_sku);
drop trigger if exists product_variants_touch on public.product_variants;
create trigger product_variants_touch before update on public.product_variants
  for each row execute function public.touch_updated_at();

-- Linhas de encomenda: variante comprada (os dados do artigo continuam copiados na linha)
alter table public.order_items add column if not exists variant_id bigint references public.product_variants (id) on delete set null;

-- 4. Looks do carrossel ---------------------------------------------------
create table if not exists public.looks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  description  text not null default '' check (char_length(description) <= 200),
  category_id  text not null references public.categories (id),
  image_path   text check (image_path is null or image_path ~ '^[A-Za-z0-9/_.-]{1,200}$'),
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  position     integer not null default 0 check (position between 0 and 9999),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists looks_status_position_idx on public.looks (status, category_id, position);

create table if not exists public.look_products (
  look_id     uuid not null references public.looks (id) on delete cascade,
  product_sku text not null references public.products (sku),
  position    smallint not null default 0 check (position between 0 and 20),
  primary key (look_id, product_sku)
);

-- Só se publica um look com imagem e pelo menos um produto publicado
create or replace function public.looks_validate()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  if new.status = 'published' then
    if new.image_path is null then
      raise exception 'Para publicar, carrega primeiro a imagem do modelo.';
    end if;
    if not exists (
      select 1 from public.look_products lp join public.products p on p.sku = lp.product_sku
      where lp.look_id = new.id and p.status = 'published'
    ) then
      raise exception 'Para publicar, associa pelo menos um produto publicado ao look.';
    end if;
    if tg_op = 'INSERT' or old.status is distinct from 'published' then new.published_at := now(); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists looks_validate on public.looks;
create trigger looks_validate before insert or update on public.looks
  for each row execute function public.looks_validate();

create or replace function public.look_products_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.looks where id = old.look_id and status = 'published')
     and not exists (select 1 from public.look_products where look_id = old.look_id) then
    raise exception 'Um look publicado tem de ter pelo menos um produto.';
  end if;
  return old;
end;
$$;
drop trigger if exists look_products_guard on public.look_products;
create trigger look_products_guard after delete on public.look_products
  for each row execute function public.look_products_guard();

-- 5. Encomendas: pagamento separado da preparação/envio -------------------
alter table public.orders add column if not exists payment_status     text;
alter table public.orders add column if not exists fulfillment_status text;
alter table public.orders add column if not exists shipped_at         timestamptz;
alter table public.orders add column if not exists delivered_at       timestamptz;
alter table public.orders add column if not exists cancelled_at       timestamptz;

update public.orders
   set payment_status = case when status in ('paid', 'shipped', 'delivered') then 'paid' else 'pending' end
 where payment_status is null;
update public.orders
   set fulfillment_status = case status when 'shipped' then 'shipped' when 'delivered' then 'delivered'
                                        when 'cancelled' then 'cancelled' else 'unfulfilled' end
 where fulfillment_status is null;
alter table public.orders alter column payment_status set default 'pending';
alter table public.orders alter column payment_status set not null;
alter table public.orders alter column fulfillment_status set default 'unfulfilled';
alter table public.orders alter column fulfillment_status set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('pending', 'paid', 'failed', 'refunded'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_fulfillment_status_check') then
    alter table public.orders add constraint orders_fulfillment_status_check
      check (fulfillment_status in ('unfulfilled', 'preparing', 'shipped', 'delivered', 'cancelled'));
  end if;
end $$;

-- "status" (usado pela loja e pela Stripe) passa a ser calculado a partir dos dois estados.
-- Compatibilidade: uma escrita antiga que só muda status='paid' (webhook) confirma o pagamento.
create or replace function public.orders_sync_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.payment_status is not distinct from old.payment_status
     and new.fulfillment_status is not distinct from old.fulfillment_status then
    if new.status = 'paid' then new.payment_status := 'paid'; end if;
    if new.status in ('shipped', 'delivered', 'cancelled') then new.fulfillment_status := new.status; end if;
  end if;
  new.status := case
    when new.fulfillment_status = 'cancelled' then 'cancelled'
    when new.fulfillment_status = 'delivered' then 'delivered'
    when new.fulfillment_status = 'shipped'   then 'shipped'
    when new.payment_status = 'paid'          then 'paid'
    else 'pending_payment'
  end;
  return new;
end;
$$;
drop trigger if exists orders_sync_status on public.orders;
create trigger orders_sync_status before insert or update on public.orders
  for each row execute function public.orders_sync_status();

-- 6. Criar encomenda: agora com stock por variante -----------------------
-- Produtos com variantes ativas: o tamanho/cor tem de existir e ter stock (é descontado).
-- Produtos sem variantes: tamanhos padrão, sem controlo de stock (como antes).
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
      if v_prod.kind = 'shoes' then
        if v_size is null or v_size not in ('38', '39', '40', '41', '42', '43', '44', '45', '46') then
          raise exception 'Número de calçado inválido para %.', v_prod.name;
        end if;
      elsif v_size is null or v_size not in ('XS', 'S', 'M', 'L', 'XL') then
        raise exception 'Tamanho inválido para %.', v_prod.name;
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

-- 7. Funções administrativas (validam a permissão no servidor) ------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'orders_total',      (select count(*) from public.orders),
    'orders_today',      (select count(*) from public.orders where created_at >= date_trunc('day', now())),
    'awaiting_payment',  (select count(*) from public.orders where payment_status = 'pending' and fulfillment_status <> 'cancelled'),
    'to_fulfill',        (select count(*) from public.orders where payment_status = 'paid' and fulfillment_status in ('unfulfilled', 'preparing')),
    'paid_orders',       (select count(*) from public.orders where payment_status = 'paid'),
    'revenue_total',     (select coalesce(sum(total), 0) from public.orders where payment_status = 'paid'),
    'revenue_month',     (select coalesce(sum(total), 0) from public.orders where payment_status = 'paid' and created_at >= date_trunc('month', now())),
    'pending_value',     (select coalesce(sum(total), 0) from public.orders where payment_status = 'pending' and fulfillment_status <> 'cancelled'),
    'products_published',(select count(*) from public.products where status = 'published'),
    'products_total',    (select count(*) from public.products where status <> 'archived'),
    'looks_published',   (select count(*) from public.looks where status = 'published'),
    'looks_draft',       (select count(*) from public.looks where status = 'draft'),
    'variants_tracked',  (select count(*) from public.product_variants v join public.products p on p.sku = v.product_sku
                           where v.active and p.status <> 'archived'),
    'low_stock', coalesce((
      select jsonb_agg(x order by x.stock, x.name) from (
        select p.sku, p.name, v.color_name, v.size, v.stock
          from public.product_variants v join public.products p on p.sku = v.product_sku
         where v.active and p.status <> 'archived' and v.stock <= 3
         order by v.stock, p.name limit 12
      ) x), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select o.id, o.number, o.total, o.payment_status, o.fulfillment_status, o.created_at, o.ship_name
          from public.orders o order by o.created_at desc limit 5
      ) x), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.admin_list_orders(
  p_search text default '', p_payment text default '', p_fulfillment text default '',
  p_limit integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  q text := lower(btrim(coalesce(p_search, '')));
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  off integer := greatest(coalesce(p_offset, 0), 0);
  v jsonb;
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  with f as (
    select o.*, u.email, pr.full_name,
           (select coalesce(sum(qty), 0) from public.order_items i where i.order_id = o.id) as items_count
      from public.orders o
      left join auth.users u on u.id = o.user_id
      left join public.profiles pr on pr.id = o.user_id
     where (coalesce(p_payment, '') = '' or o.payment_status = p_payment)
       and (coalesce(p_fulfillment, '') = '' or o.fulfillment_status = p_fulfillment)
       and (q = '' or o.number::text = ltrim(q, '#')
            or position(q in lower(coalesce(u.email, ''))) > 0
            or position(q in lower(o.ship_name)) > 0
            or position(q in lower(coalesce(pr.full_name, ''))) > 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'number', x.number, 'created_at', x.created_at, 'total', x.total,
        'payment_status', x.payment_status, 'fulfillment_status', x.fulfillment_status,
        'email', x.email, 'customer', coalesce(nullif(x.full_name, ''), x.ship_name), 'items_count', x.items_count)
        order by x.created_at desc)
      from (select * from f order by created_at desc limit lim offset off) x), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.admin_order_detail(p_order uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select to_jsonb(o) || jsonb_build_object(
           'email', u.email,
           'customer', pr.full_name,
           'items', coalesce((select jsonb_agg(jsonb_build_object(
               'sku', i.sku, 'name', i.name, 'color_name', i.color_name, 'size', i.size,
               'qty', i.qty, 'unit_price', i.unit_price, 'variant_id', i.variant_id) order by i.id)
             from public.order_items i where i.order_id = o.id), '[]'::jsonb))
    into v
    from public.orders o
    left join auth.users u on u.id = o.user_id
    left join public.profiles pr on pr.id = o.user_id
   where o.id = p_order;
  if v is null then raise exception 'Encomenda não encontrada.'; end if;
  return v - 'user_id';
end;
$$;

-- Preparação/envio. NUNCA altera o estado de pagamento (só a Stripe o confirma).
create or replace function public.admin_set_fulfillment(p_order uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('unfulfilled', 'preparing', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Estado de envio inválido.';
  end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Encomenda não encontrada.'; end if;

  if o.fulfillment_status = p_status then
    return jsonb_build_object('id', o.id, 'fulfillment_status', o.fulfillment_status, 'payment_status', o.payment_status);
  end if;
  if o.fulfillment_status = 'cancelled' then raise exception 'Esta encomenda está cancelada.'; end if;
  if o.fulfillment_status = 'delivered' then raise exception 'Esta encomenda já foi entregue.'; end if;
  if p_status in ('shipped', 'delivered') and o.payment_status <> 'paid' then
    raise exception 'Só é possível enviar encomendas com o pagamento confirmado pela Stripe.';
  end if;
  if p_status = 'delivered' and o.fulfillment_status <> 'shipped' then
    raise exception 'Marca primeiro a encomenda como enviada.';
  end if;
  if p_status = 'cancelled' and o.fulfillment_status = 'shipped' then
    raise exception 'Não é possível cancelar uma encomenda já enviada.';
  end if;
  if p_status = 'unfulfilled' and o.fulfillment_status = 'shipped' then
    raise exception 'Uma encomenda enviada não pode voltar a "por preparar".';
  end if;

  if p_status = 'cancelled' then
    -- Repõe o stock das variantes compradas
    update public.product_variants v
       set stock = least(v.stock + s.q, 100000)
      from (select variant_id, sum(qty) as q from public.order_items
             where order_id = o.id and variant_id is not null group by variant_id) s
     where v.id = s.variant_id;
  end if;

  update public.orders
     set fulfillment_status = p_status,
         shipped_at   = case when p_status = 'shipped'   then now() else shipped_at end,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
   where id = o.id
  returning * into o;

  return jsonb_build_object('id', o.id, 'fulfillment_status', o.fulfillment_status, 'payment_status', o.payment_status, 'status', o.status);
end;
$$;

revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_list_orders(text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_order_detail(uuid) from public, anon;
revoke execute on function public.admin_set_fulfillment(uuid, text) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_list_orders(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_order_detail(uuid) to authenticated;
grant execute on function public.admin_set_fulfillment(uuid, text) to authenticated;

-- 8. RLS e privilégios ----------------------------------------------------
alter table public.categories enable row level security;
alter table public.product_variants enable row level security;
alter table public.looks enable row level security;
alter table public.look_products enable row level security;

-- Categorias: visíveis para todos; o administrador vê e edita todas
drop policy if exists "Categorias visíveis" on public.categories;
create policy "Categorias visíveis" on public.categories for select to anon, authenticated
  using (visible or (select public.is_admin()));
drop policy if exists "Admin cria categorias" on public.categories;
create policy "Admin cria categorias" on public.categories for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "Admin edita categorias" on public.categories;
create policy "Admin edita categorias" on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to anon, authenticated;
grant insert (id, name, description, image_url, position, visible) on table public.categories to authenticated;
grant update (name, description, image_url, position, visible) on table public.categories to authenticated;

-- Produtos: publicados para todos; o administrador vê e edita todos (sem apagar)
drop policy if exists "Catálogo visível" on public.products;
drop policy if exists "Catálogo publicado" on public.products;
create policy "Catálogo publicado" on public.products for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
drop policy if exists "Admin cria produtos" on public.products;
create policy "Admin cria produtos" on public.products for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "Admin edita produtos" on public.products;
create policy "Admin edita produtos" on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert (sku, kind, name, color_name, color_hex, style, description, images, price, status) on table public.products to authenticated;
grant update (name, color_name, color_hex, style, description, images, price, status) on table public.products to authenticated;

-- Variantes: só o administrador (o stock não é público)
drop policy if exists "Admin lê variantes" on public.product_variants;
create policy "Admin lê variantes" on public.product_variants for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin cria variantes" on public.product_variants;
create policy "Admin cria variantes" on public.product_variants for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "Admin edita variantes" on public.product_variants;
create policy "Admin edita variantes" on public.product_variants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on table public.product_variants from anon, authenticated;
grant select on table public.product_variants to authenticated;
grant insert (product_sku, color_name, color_hex, size, stock, active) on table public.product_variants to authenticated;
grant update (color_name, color_hex, size, stock, active) on table public.product_variants to authenticated;

-- Looks: publicados para todos; rascunhos só para o administrador (pré-visualização)
drop policy if exists "Looks publicados" on public.looks;
create policy "Looks publicados" on public.looks for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
drop policy if exists "Admin cria looks" on public.looks;
create policy "Admin cria looks" on public.looks for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "Admin edita looks" on public.looks;
create policy "Admin edita looks" on public.looks for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on table public.looks from anon, authenticated;
grant select on table public.looks to anon, authenticated;
grant insert (id, name, description, category_id, image_path, status, position) on table public.looks to authenticated;
grant update (name, description, category_id, image_path, status, position) on table public.looks to authenticated;

drop policy if exists "Produtos de looks publicados" on public.look_products;
create policy "Produtos de looks publicados" on public.look_products for select to anon, authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.looks l where l.id = look_id and l.status = 'published'));
drop policy if exists "Admin associa produtos" on public.look_products;
create policy "Admin associa produtos" on public.look_products for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "Admin reordena produtos" on public.look_products;
create policy "Admin reordena produtos" on public.look_products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admin remove produtos do look" on public.look_products;
create policy "Admin remove produtos do look" on public.look_products for delete to authenticated
  using ((select public.is_admin()));
revoke all on table public.look_products from anon, authenticated;
grant select on table public.look_products to anon, authenticated;
grant insert, update, delete on table public.look_products to authenticated;

-- Encomendas: o administrador lê todas (alterações só pelas funções acima)
drop policy if exists "Admin vê encomendas" on public.orders;
create policy "Admin vê encomendas" on public.orders for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin vê linhas de encomenda" on public.order_items;
create policy "Admin vê linhas de encomenda" on public.order_items for select to authenticated
  using ((select public.is_admin()));
revoke insert, update, delete on table public.orders, public.order_items from anon, authenticated;

-- 9. Storage: imagens públicas para leitura, escrita só para administradores ---
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('looks',   'looks',   true, 5242880, array['image/png', 'image/webp']),
      ('catalog', 'catalog', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;

    drop policy if exists "FORMA admin lê imagens" on storage.objects;
    create policy "FORMA admin lê imagens" on storage.objects for select to authenticated
      using (bucket_id in ('looks', 'catalog') and (select public.is_admin()));
    drop policy if exists "FORMA admin carrega imagens" on storage.objects;
    create policy "FORMA admin carrega imagens" on storage.objects for insert to authenticated
      with check (bucket_id in ('looks', 'catalog') and (select public.is_admin()));
    drop policy if exists "FORMA admin substitui imagens" on storage.objects;
    create policy "FORMA admin substitui imagens" on storage.objects for update to authenticated
      using (bucket_id in ('looks', 'catalog') and (select public.is_admin()))
      with check (bucket_id in ('looks', 'catalog') and (select public.is_admin()));
    drop policy if exists "FORMA admin apaga imagens" on storage.objects;
    create policy "FORMA admin apaga imagens" on storage.objects for delete to authenticated
      using (bucket_id in ('looks', 'catalog') and (select public.is_admin()));
  end if;
end $$;

-- =====================================================================
-- PRIMEIRO ADMINISTRADOR (executar à parte, no SQL Editor, com o teu email):
--
--   update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'o-teu-email@exemplo.pt');
--
-- A conta tem de existir (registada e confirmada). Só quem tem acesso ao
-- painel do Supabase o pode fazer; o site nunca permite alterar is_admin.
-- Para retirar: o mesmo comando com "is_admin = false".
-- =====================================================================
