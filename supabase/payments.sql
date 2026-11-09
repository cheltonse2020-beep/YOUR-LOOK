-- =====================================================================
-- FORMA — pagamentos com Stripe (campos nas encomendas)
-- Executar no SQL Editor DEPOIS de orders.sql.
-- Só as Edge Functions (com a chave de serviço, no servidor) escrevem
-- nestes campos; os clientes continuam a poder apenas LER as suas encomendas.
-- =====================================================================
alter table public.orders add column if not exists stripe_session_id     text;
alter table public.orders add column if not exists stripe_payment_intent text;
alter table public.orders add column if not exists paid_at               timestamptz;

create unique index if not exists orders_stripe_session_id_key
  on public.orders (stripe_session_id) where stripe_session_id is not null;

comment on column public.orders.stripe_session_id is 'Última sessão Stripe Checkout criada para esta encomenda (create-checkout).';
comment on column public.orders.paid_at is 'Preenchido pelo webhook da Stripe (stripe-webhook) quando o pagamento é confirmado.';

-- Os clientes continuam sem UPDATE em orders (ver orders.sql): não podem marcar
-- uma encomenda como paga. O webhook usa a chave de serviço, que não passa pelo RLS.
revoke update on table public.orders from anon, authenticated;
