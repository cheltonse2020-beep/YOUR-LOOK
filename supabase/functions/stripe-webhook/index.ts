// =====================================================================
// YOUR LOOK — Edge Function: stripe-webhook
// Recebe os eventos da Stripe e marca a encomenda como paga.
// É a ÚNICA forma de uma encomenda passar a 'paid' (o browser nunca o faz).
//
// Segurança:
// - Assinatura verificada (cabeçalho Stripe-Signature, HMAC-SHA256 com o
//   segredo do webhook, tolerância de 5 minutos). Pedidos sem assinatura válida → 400.
// - Só marca como paga se o valor e a moeda coincidirem com o total da encomenda.
// - Idempotente: só altera encomendas que ainda estão 'pending_payment'.
// - Esta função tem de ser publicada SEM verificação de JWT (a Stripe não envia JWT);
//   a autenticidade vem da assinatura.
//
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_...). Automáticos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Eventos a subscrever na Stripe: checkout.session.completed,
//   checkout.session.async_payment_succeeded, checkout.session.async_payment_failed
// =====================================================================

const env = (name: string): string => Deno.env.get(name) ?? '';
const TOLERANCE_SECONDS = 300;

function serviceKey(): string {
  return env('SUPABASE_SERVICE_ROLE_KEY') || env('SERVICE_ROLE_KEY');
}
function keyHeaders(key: string): Record<string, string> {
  return key.split('.').length === 3 ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

const text = (status: number, body: string) => new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verificação da assinatura conforme a Stripe: v1 = HMAC_SHA256(segredo, `${t}.${corpo}`)
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map(p => p.trim().split('='));
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(timestamp) || !signatures.length) return false;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some(sig => safeEqual(sig, expected));
}

async function markPaid(session: any): Promise<string> {
  const orderId = session?.metadata?.order_id || session?.client_reference_id;
  if (!/^[0-9a-f-]{36}$/i.test(orderId ?? '')) return 'sem order_id';

  const base = env('SUPABASE_URL').replace(/\/$/, '');
  const headers = { ...keyHeaders(serviceKey()), 'Content-Type': 'application/json' };

  const res = await fetch(`${base}/rest/v1/orders?id=eq.${orderId}&select=id,number,status,total`, { headers });
  const order = (res.ok ? await res.json() : [])[0];
  if (!order) return 'encomenda inexistente';
  if (order.status !== 'pending_payment') return `já estava ${order.status}`;

  // O valor pago tem de ser exatamente o total da encomenda, em euros
  if (session.currency !== 'eur' || session.amount_total !== Math.round(Number(order.total) * 100)) {
    console.error(`Valor não coincide na encomenda ${order.number}: pago ${session.amount_total} ${session.currency}, esperado ${Math.round(Number(order.total) * 100)} eur`);
    return 'valor não coincide';
  }

  const upd = await fetch(`${base}/rest/v1/orders?id=eq.${orderId}&status=eq.pending_payment`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'paid',
      payment_status: 'paid',   // admin.sql: pagamento separado do envio
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    }),
  });
  if (!upd.ok) throw new Error(`Falha ao atualizar a encomenda ${order.number}: ${upd.status}`);
  return `encomenda ${order.number} paga`;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return text(405, 'Método não permitido');
  if (!env('STRIPE_WEBHOOK_SECRET') || !serviceKey() || !env('SUPABASE_URL')) {
    console.error('Configuração em falta (STRIPE_WEBHOOK_SECRET / chaves Supabase).');
    return text(500, 'Não configurado');
  }

  const payload = await req.text();   // corpo original: necessário para a assinatura
  const ok = await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), env('STRIPE_WEBHOOK_SECRET'));
  if (!ok) return text(400, 'Assinatura inválida');

  let event: any;
  try { event = JSON.parse(payload); } catch { return text(400, 'JSON inválido'); }
  const session = event?.data?.object;

  try {
    let result = 'ignorado';
    switch (event.type) {
      case 'checkout.session.completed':
        // Cartão: já pago. Multibanco e outros métodos assíncronos: 'unpaid' até o cliente pagar.
        result = session?.payment_status === 'paid' ? await markPaid(session) : 'aguarda pagamento assíncrono';
        break;
      case 'checkout.session.async_payment_succeeded':
        result = await markPaid(session);
        break;
      case 'checkout.session.async_payment_failed':
        result = 'pagamento assíncrono falhou — a encomenda continua a aguardar pagamento';
        break;
    }
    console.log(`${event.type} (${event.id}): ${result}`);
    return text(200, 'ok');
  } catch (err) {
    console.error('Erro ao processar o evento:', err);
    return text(500, 'Erro');   // a Stripe volta a tentar
  }
}

Deno.serve(handler);
