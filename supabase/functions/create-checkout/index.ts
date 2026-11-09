// =====================================================================
// FORMA — Edge Function: create-checkout
// Cria uma sessão Stripe Checkout para uma encomenda do próprio cliente.
//
// Pedido (do site, com a sessão do cliente):  POST { "order_id": "<uuid>", "embedded": true|false }
// Resposta: embebido → { "client_secret": "..." } (janela de pagamento dentro do site)
//           redireção → { "url": "https://checkout.stripe.com/..." }
//
// Segurança:
// - O utilizador é verificado no servidor (Auth /user) a partir do seu token.
// - A encomenda é lida COM O TOKEN DO CLIENTE: o RLS garante que só lê as suas.
// - Valores vêm das linhas da encomenda (preços do servidor), nunca do browser.
// - A chave secreta da Stripe vive só nos "Secrets" das Edge Functions.
// - Os URLs de regresso são fixos (SITE_URL), não vêm do pedido.
//
// Secrets necessários (Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY   sk_test_... (ou sk_live_... em produção)
//   SITE_URL            ex.: http://localhost:5500/index.html
//   ALLOWED_ORIGINS     (opcional) origens extra separadas por vírgulas
// Disponíveis automaticamente: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// =====================================================================

const env = (name: string): string => Deno.env.get(name) ?? '';

function serviceKey(): string {
  return env('SUPABASE_SERVICE_ROLE_KEY') || env('SERVICE_ROLE_KEY');
}
function publicKey(): string {
  return env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY');
}
// Chaves novas (sb_secret_/sb_publishable_) não são JWT: vão só no cabeçalho apikey.
function keyHeaders(key: string): Record<string, string> {
  return key.split('.').length === 3 ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

function allowedOrigin(origin: string | null): string {
  const site = env('SITE_URL');
  const list = [site ? new URL(site).origin : '', ...env('ALLOWED_ORIGINS').split(',')]
    .map(s => s.trim()).filter(Boolean);
  return origin && list.includes(origin) ? origin : (list[0] || '*');
}

function cors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
}

const cents = (value: number | string): number => Math.round(Number(value) * 100);

async function stripe(path: string, params: Record<string, string> | null, method = 'POST'): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? 'erro'}`);
  return data;
}

export async function handler(req: Request): Promise<Response> {
  const origin = allowedOrigin(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin);

  const missing = ['STRIPE_SECRET_KEY', 'SITE_URL', 'SUPABASE_URL'].filter(n => !env(n));
  if (missing.length || !serviceKey() || !publicKey()) {
    console.error('Configuração em falta:', missing.join(', ') || 'chaves Supabase');
    return json({ error: 'O pagamento online ainda não está configurado.' }, 500, origin);
  }
  if (!/^(sk|rk)_(test|live)_/.test(env('STRIPE_SECRET_KEY'))) {
    console.error('STRIPE_SECRET_KEY não parece uma chave secreta da Stripe.');
    return json({ error: 'O pagamento online ainda não está configurado.' }, 500, origin);
  }

  // 1. Quem está a pedir? (verificado no servidor de Auth)
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+/.test(auth)) return json({ error: 'Precisas de iniciar sessão.' }, 401, origin);
  const base = env('SUPABASE_URL').replace(/\/$/, '');
  const userRes = await fetch(`${base}/auth/v1/user`, { headers: { apikey: publicKey(), Authorization: auth } });
  if (!userRes.ok) return json({ error: 'A tua sessão terminou. Entra novamente.' }, 401, origin);
  const user = await userRes.json();

  // 2. Qual encomenda?
  let orderId = '';
  let embedded = false;
  try {
    const body = await req.json();
    orderId = String(body?.order_id ?? '');
    embedded = body?.embedded === true;
  } catch { /* corpo inválido */ }
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'Encomenda inválida.' }, 400, origin);

  // 3. Ler a encomenda com o token do cliente (RLS: só as suas)
  const orderRes = await fetch(
    `${base}/rest/v1/orders?id=eq.${orderId}&select=id,number,status,total,shipping_cost,stripe_session_id,order_items(name,color_name,size,qty,unit_price)`,
    { headers: { apikey: publicKey(), Authorization: auth } },
  );
  const rows = orderRes.ok ? await orderRes.json() : [];
  const order = rows[0];
  if (!order) return json({ error: 'Encomenda não encontrada.' }, 404, origin);
  if (order.status !== 'pending_payment') {
    return json({ error: order.status === 'paid' ? 'Esta encomenda já está paga.' : 'Esta encomenda já não pode ser paga.' }, 409, origin);
  }

  try {
    // 4. Sessão anterior desta encomenda: reutiliza (redireção) ou expira-a,
    //    para nunca haver duas sessões abertas que pudessem cobrar duas vezes.
    if (order.stripe_session_id) {
      try {
        const existing = await stripe(`checkout/sessions/${encodeURIComponent(order.stripe_session_id)}`, null, 'GET');
        if (existing.status === 'open') {
          if (!embedded && existing.url && existing.amount_total === cents(order.total)) {
            return json({ url: existing.url }, 200, origin);
          }
          await stripe(`checkout/sessions/${encodeURIComponent(existing.id)}/expire`, {});
        }
      } catch { /* sessão antiga inválida ou já expirada: cria-se outra */ }
    }

    // 5. Criar a sessão com os valores do servidor
    const site = env('SITE_URL');
    const back = (status: string) => {
      const u = new URL(site);
      u.searchParams.set('payment', status);
      u.searchParams.set('order', String(order.number));
      // {CHECKOUT_SESSION_ID} é substituído pela Stripe (não pode ser codificado)
      return `${u.toString()}&session_id={CHECKOUT_SESSION_ID}`;
    };
    const p: Record<string, string> = {
      mode: 'payment',
      locale: 'pt',
      client_reference_id: order.id,
      'metadata[order_id]': order.id,
      'metadata[order_number]': String(order.number),
      'payment_intent_data[metadata][order_id]': order.id,
      'payment_intent_data[description]': `FORMA — encomenda n.º ${order.number}`,
    };
    if (embedded) {
      p.ui_mode = 'embedded';
      p.return_url = back('success');
    } else {
      p.success_url = back('success');
      p.cancel_url = back('cancelled');
    }
    if (user.email) p.customer_email = user.email;

    const lines = [...order.order_items.map((i: any) => ({
      name: `${i.name} — ${i.color_name} (${i.size})`, amount: cents(i.unit_price), qty: i.qty,
    }))];
    if (Number(order.shipping_cost) > 0) lines.push({ name: 'Portes de envio', amount: cents(order.shipping_cost), qty: 1 });
    lines.forEach((l, n) => {
      p[`line_items[${n}][price_data][currency]`] = 'eur';
      p[`line_items[${n}][price_data][unit_amount]`] = String(l.amount);
      p[`line_items[${n}][price_data][product_data][name]`] = l.name;
      p[`line_items[${n}][quantity]`] = String(l.qty);
    });

    const expected = lines.reduce((s, l) => s + l.amount * l.qty, 0);
    if (expected !== cents(order.total)) {
      console.error(`Total incoerente na encomenda ${order.number}: linhas ${expected} vs total ${cents(order.total)}`);
      return json({ error: 'Não foi possível preparar o pagamento desta encomenda.' }, 500, origin);
    }

    const session = await stripe('checkout/sessions', p);

    // 6. Guardar a sessão na encomenda (chave de serviço, só no servidor)
    await fetch(`${base}/rest/v1/orders?id=eq.${order.id}&status=eq.pending_payment`, {
      method: 'PATCH',
      headers: { ...keyHeaders(serviceKey()), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ stripe_session_id: session.id }),
    });

    return json(embedded ? { client_secret: session.client_secret } : { url: session.url }, 200, origin);
  } catch (err) {
    console.error('Erro ao criar a sessão Stripe:', err);
    return json({ error: 'Não foi possível abrir o pagamento. Tenta de novo dentro de momentos.' }, 502, origin);
  }
}

Deno.serve(handler);
