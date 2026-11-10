'use strict';

/* =========================================================
   YOUR LOOK — encomendas
   Cesto → "Prosseguir com a encomenda" → (iniciar sessão) → resumo + entrega
   → place_order() no Supabase (preços calculados no servidor) → confirmação.
   Também: "As minhas encomendas" (só as do próprio cliente, por RLS).
   Usa de app.js: bag, LOOKS, money, icon, saveBag. De auth.js: window.FORMA_AUTH.
   ========================================================= */
(() => {
  const $ = id => document.getElementById(id);
  const dialog = $('checkout');
  const RESUME_KEY = 'forma-resume-checkout';
  const FREE_SHIPPING_FROM = 100;
  const SHIPPING_COST = 4.9;
  const STATUS_LABEL = {
    pending_payment: 'A aguardar pagamento',
    paid: 'Paga',
    shipped: 'Enviada',
    delivered: 'Entregue',
    cancelled: 'Cancelada',
  };

  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const auth = () => window.FORMA_AUTH;

  /* ---------- Cesto → linhas da encomenda (agrupadas por peça + tamanho) ---------- */
  function bagToLines() {
    const lines = new Map();
    const add = (piece, size) => {
      const key = `${piece.sku}|${size}`;
      const line = lines.get(key) || { sku: piece.sku, size, qty: 0, piece };
      line.qty += 1;
      lines.set(key, line);
    };
    bag.forEach(item => {
      const look = bagLook(item);
      if (!look) return;
      if (item.type === 'piece') {
        if (look.pieces[item.piece]) add(look.pieces[item.piece], item.size);
      } else {                      // conjunto completo = todas as peças do look
        look.pieces.forEach(p => add(p, p.kind === 'shoes' ? item.shoe : item.size));
      }
    });
    return [...lines.values()];
  }

  /* ---------- Vistas ---------- */
  function showView(id) {
    if (id !== 'payment-embed') destroyEmbedded();
    ['checkout-form', 'checkout-done', 'orders-view', 'payment-view', 'payment-embed'].forEach(v => { $(v).hidden = v !== id; });
    dialog.classList.toggle('wide', id === 'payment-embed');
    dialog.querySelectorAll('.form-status').forEach(el => { el.textContent = ''; delete el.dataset.tone; });
    if (!dialog.open) dialog.showModal();
  }

  function setStatus(container, text, tone = 'error') {
    const el = container.querySelector('.form-status');
    el.textContent = text;
    el.dataset.tone = tone;
  }

  /* ---------- Início: botão do cesto ---------- */
  function start() {
    if (!bag.length) return;
    const a = auth();
    if (!a || a.problem) {
      $('cart').close();
      if (a) a.openLogin(); else alert('O serviço de contas não está disponível.');
      return;
    }
    if (!a.session) {
      try { sessionStorage.setItem(RESUME_KEY, '1'); } catch { /* sem armazenamento: o cliente volta a carregar no botão */ }
      $('cart').close();
      a.openLogin('Entra ou cria conta para continuar com a encomenda. O teu cesto fica guardado.');
      return;
    }
    $('cart').close();
    openCheckout();
  }

  function openCheckout() {
    const lines = bagToLines();
    if (!lines.length) return;
    const subtotal = lines.reduce((s, l) => s + l.piece.price * l.qty, 0);
    const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_COST;

    $('checkout-lines').innerHTML = lines.map(l => `
      <li>
        <span class="cart-thumb">${pieceThumb(l.piece)}</span>
        <span class="line-info">${escapeHtml(l.piece.name)}<small>${escapeHtml(l.piece.colorName)} · ${l.piece.kind === 'shoes' ? 'Número' : 'Tamanho'} ${escapeHtml(l.size)}${l.qty > 1 ? ` · ${l.qty} unid.` : ''}</small></span>
        <span class="line-price">${money(l.piece.price * l.qty)}</span>
      </li>`).join('');
    $('checkout-subtotal').textContent = money(subtotal);
    $('checkout-shipping').textContent = shipping ? money(shipping) : 'Grátis';
    $('checkout-total').textContent = money(subtotal + shipping);

    const form = $('checkout-form');
    if (!form.elements.ship_name.value) form.elements.ship_name.value = auth()?.profileName || '';
    showView('checkout-form');
    if (lines.some(l => l.qty > 10)) {
      setStatus(form, 'Há artigos com mais de 10 unidades. Remove algumas do cesto (máximo 10 por artigo).');
    }
    setTimeout(() => form.querySelector('input:placeholder-shown, input:not([value])')?.focus({ preventScroll: true }), 30);
  }

  /* ---------- Confirmar ---------- */
  const POSTAL_RE = /^\d{4}-\d{3}$/;
  const PHONE_RE = /^[+0-9 ()-]{9,20}$/;

  function invalid(form, input, text) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    setStatus(form, text);
  }

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    const f = form.elements;
    const shipping = {
      name: f.ship_name.value.trim().replace(/\s+/g, ' '),
      address: f.address.value.trim().replace(/\s+/g, ' '),
      postal: f.postal.value.trim(),
      city: f.city.value.trim(),
      phone: f.phone.value.trim(),
      notes: f.notes.value.trim(),
    };
    if (shipping.name.length < 2) return invalid(form, f.ship_name, 'Indica o nome para a entrega.');
    if (shipping.address.length < 5) return invalid(form, f.address, 'Indica a morada completa (rua, número, andar).');
    if (!POSTAL_RE.test(shipping.postal)) return invalid(form, f.postal, 'Código postal inválido. Usa o formato 0000-000.');
    if (shipping.city.length < 2) return invalid(form, f.city, 'Indica a localidade.');
    if (!PHONE_RE.test(shipping.phone)) return invalid(form, f.phone, 'Indica um número de telefone válido.');

    const lines = bagToLines();
    if (!lines.length) { setStatus(form, 'O cesto está vazio.'); return; }
    if (lines.some(l => l.qty > 10)) { setStatus(form, 'Máximo 10 unidades por artigo.'); return; }

    const a = auth();
    if (!a?.session) { dialog.close(); a?.openLogin('A tua sessão terminou. Entra novamente para concluir a encomenda.'); return; }

    const button = form.querySelector('button.primary');
    const original = button.innerHTML;
    form.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span>A registar encomenda…';
    form.setAttribute('aria-busy', 'true');
    try {
      // Só SKU, tamanho e quantidade: o servidor ignora preços vindos do browser.
      const items = lines.map(l => ({ sku: l.sku, size: l.size, qty: l.qty }));
      const { data, error } = await a.client.rpc('place_order', { p_items: items, p_shipping: shipping });
      if (error) {
        setStatus(form, orderError(error));
        return;
      }
      bag = [];
      saveBag();
      form.elements.notes.value = '';
      lastOrderId = data.id;
      $('checkout-done-text').textContent =
        `A tua encomenda n.º ${data.number} foi registada, no total de ${money(Number(data.total))}` +
        `${Number(data.shipping_cost) === 0 ? ' (portes grátis)' : ''}. Falta só o pagamento.`;
      $('checkout-pay').textContent = `Pagar agora · ${money(Number(data.total))}`;
      showView('checkout-done');   // fica por baixo, caso o pagamento não abra
      pay(data.id, $('checkout-pay'), $('checkout-done'), { number: data.number, total: data.total });
    } catch (err) {
      setStatus(form, a.errorText(err));
    } finally {
      form.querySelectorAll('input, button').forEach(el => { el.disabled = false; });
      button.innerHTML = original;
      form.removeAttribute('aria-busy');
    }
  }

  function orderError(error) {
    // Mensagens escritas em português pela própria função place_order
    if (error.code === 'P0001' && error.message) return error.message;
    if (error.code === '42501') return 'A tua sessão terminou. Entra novamente para concluir a encomenda.';
    if (error.code === 'PGRST202') return 'As encomendas ainda não estão configuradas no servidor (falta executar supabase/orders.sql).';
    return auth()?.errorText(error) || 'Não foi possível registar a encomenda. Tenta de novo.';
  }

  /* ---------- Pagamento (Stripe Checkout via Edge Function create-checkout) ---------- */
  let lastOrderId = null;

  async function functionError(error) {
    // FunctionsHttpError traz a resposta da função; as nossas mensagens vêm em { error }
    try {
      if (error.context?.status === 404) return 'O pagamento online ainda não está configurado no servidor.';
      const body = await error.context?.json?.();
      if (body?.error) return body.error;
    } catch { /* sem corpo */ }
    if (error.name === 'FunctionsFetchError') {
      console.warn('[FORMA] create-checkout não respondeu. Confirma que a Edge Function está publicada no Supabase.');
      return 'O pagamento online ainda não está disponível. A tua encomenda ficou guardada: podes pagá-la mais tarde em "As minhas encomendas".';
    }
    return 'Não foi possível abrir o pagamento. Tenta de novo dentro de momentos.';
  }

  /* Janela de pagamento dentro do site (Stripe Embedded Checkout).
     Precisa da chave publicável da Stripe (pk_...) em config.js; sem ela, usa a página da Stripe. */
  let embedded = null;
  const stripeKey = () => String((window.FORMA_CONFIG || {}).stripePublishableKey || '');
  const canEmbed = () => /^pk_(test|live)_/.test(stripeKey());

  function loadStripe() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error('Stripe.js')));
      s.onerror = () => reject(new Error('Stripe.js'));
      document.head.append(s);
    });
  }

  function destroyEmbedded() {
    if (embedded) { try { embedded.destroy(); } catch { /* já destruído */ } embedded = null; }
  }

  async function openEmbedded(clientSecret, info) {
    showView('payment-embed');
    $('embed-summary').textContent = info ? `Encomenda n.º ${info.number} · ${money(Number(info.total))}` : '';
    $('stripe-checkout').innerHTML = '<p class="muted embed-loading"><span class="spinner dark" aria-hidden="true"></span> A abrir pagamento seguro…</p>';
    const StripeJs = await loadStripe();
    const stripe = StripeJs(stripeKey());
    destroyEmbedded();
    embedded = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => clientSecret });
    $('stripe-checkout').innerHTML = '';
    embedded.mount('#stripe-checkout');
  }

  async function pay(orderId, button, container, info = null) {
    const a = auth();
    if (!a?.session) { dialog.close(); a?.openLogin('Entra para pagar a tua encomenda.'); return; }
    container.querySelector('.form-status').textContent = '';
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span>A abrir pagamento seguro…';
    const useEmbed = canEmbed();
    try {
      const { data, error } = await a.client.functions.invoke('create-checkout', { body: { order_id: orderId, embedded: useEmbed } });
      if (error || !(useEmbed ? data?.client_secret : data?.url)) {
        setStatus(container, error ? await functionError(error) : 'Não foi possível abrir o pagamento.');
        return;
      }
      if (useEmbed) {
        try {
          await openEmbedded(data.client_secret, info);
        } catch (err) {
          console.error('[FORMA] Falha ao abrir o pagamento embebido:', err);
          showView(container.id);
          setStatus(container, 'Não foi possível carregar a janela de pagamento. Verifica a ligação e tenta de novo.');
        }
        return;
      }
      window.location.assign(data.url);   // página segura da Stripe
    } catch (err) {
      setStatus(container, a.errorText(err));
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  // Regresso da Stripe: ?payment=success|cancelled&order=<número>
  const returnParams = (() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('payment');
    const number = url.searchParams.get('order');
    if (!status) return null;
    ['payment', 'order', 'session_id'].forEach(k => url.searchParams.delete(k));
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    return /^(success|cancelled)$/.test(status) && /^\d{1,10}$/.test(number || '') ? { status, number: Number(number) } : null;
  })();

  function paymentView(title, text, tone, action) {
    $('payment-title').textContent = title;
    $('payment-text').textContent = text;
    $('payment-view').dataset.tone = tone;
    const btn = $('payment-action');
    btn.hidden = !action;
    if (action) { btn.textContent = action.label; btn.onclick = action.run; }
    showView('payment-view');
  }

  async function fetchOrder(number) {
    const { data } = await auth().client.from('orders').select('id, number, status, total').eq('number', number).maybeSingle();
    return data;   // null se não existir ou não for deste cliente (RLS)
  }

  async function showPaymentResult({ status, number }) {
    if (status === 'cancelled') {
      const order = await fetchOrder(number);
      paymentView('Pagamento cancelado',
        `Não foi cobrado nada. A encomenda n.º ${number} continua a aguardar pagamento.`, 'info',
        order?.status === 'pending_payment'
          ? { label: `Tentar pagar de novo · ${money(Number(order.total))}`, run: () => pay(order.id, $('payment-action'), $('payment-view')) }
          : null);
      return;
    }
    paymentView('A confirmar o pagamento…', `A aguardar a confirmação da Stripe para a encomenda n.º ${number}.`, 'info', null);
    $('payment-title').insertAdjacentHTML('afterbegin', '<span class="spinner dark" aria-hidden="true"></span> ');
    for (let i = 0; i < 10; i++) {
      const order = await fetchOrder(number);
      if (order?.status === 'paid') {
        paymentView('Pagamento confirmado', `Obrigado! A encomenda n.º ${number} está paga (${money(Number(order.total))}). Vamos prepará-la para envio.`, 'ok', null);
        return;
      }
      await new Promise(res => setTimeout(res, 2000));
    }
    paymentView('Pagamento em processamento',
      `A Stripe ainda está a confirmar o pagamento da encomenda n.º ${number}. Pode demorar alguns minutos; ` +
      'se escolheste Multibanco, fica concluída quando pagares a referência. Acompanha o estado em "As minhas encomendas".', 'info', null);
  }

  /* ---------- As minhas encomendas ---------- */
  async function openOrders() {
    const dropdown = $('user-dropdown');
    if (dropdown) { dropdown.hidden = true; $('user-button')?.setAttribute('aria-expanded', 'false'); }
    const a = auth();
    if (!a?.session) { a?.openLogin('Entra para veres as tuas encomendas.'); return; }

    showView('orders-view');
    const view = $('orders-view');
    $('orders-list').innerHTML = '<p class="muted"><span class="spinner dark" aria-hidden="true"></span> A carregar…</p>';
    view.setAttribute('aria-busy', 'true');
    const { data, error } = await a.client
      .from('orders')
      .select('id, number, status, total, shipping_cost, created_at, order_items(name, color_name, size, qty, unit_price)')
      .order('created_at', { ascending: false });
    view.removeAttribute('aria-busy');

    if (error) {
      $('orders-list').innerHTML = '';
      setStatus(view, error.code === 'PGRST205' || error.code === '42P01'
        ? 'As encomendas ainda não estão configuradas no servidor (falta executar supabase/orders.sql).'
        : a.errorText(error));
      return;
    }
    if (!data.length) {
      $('orders-list').innerHTML = '<p class="muted">Ainda não tens encomendas.</p>';
      return;
    }
    $('orders-list').innerHTML = data.map(o => `
      <article class="order-card">
        <div class="order-head">
          <strong>N.º ${o.number}</strong>
          <span class="order-status" data-status="${escapeHtml(o.status)}">${escapeHtml(STATUS_LABEL[o.status] || o.status)}</span>
        </div>
        <p class="muted">${new Date(o.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <ul>${o.order_items.map(i => `<li>${i.qty} × ${escapeHtml(i.name)} <small>${escapeHtml(i.color_name)} · ${escapeHtml(i.size)}</small><span>${money(i.unit_price * i.qty)}</span></li>`).join('')}</ul>
        <div class="order-foot"><span>Total${Number(o.shipping_cost) === 0 ? ' (portes grátis)' : ''}</span><strong>${money(Number(o.total))}</strong></div>
        ${o.status === 'pending_payment' ? `<button type="button" class="primary pay-btn" data-pay="${escapeHtml(o.id)}" data-number="${o.number}" data-total="${Number(o.total)}">Pagar agora · ${money(Number(o.total))}</button>` : ''}
      </article>`).join('');
  }

  /* ---------- Eventos ---------- */
  $('checkout-start').addEventListener('click', start);
  $('checkout-form').addEventListener('submit', submit);
  $('checkout-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', destroyEmbedded);
  $('checkout-see-orders').addEventListener('click', openOrders);
  $('payment-orders').addEventListener('click', openOrders);
  $('checkout-pay').addEventListener('click', e => lastOrderId && pay(lastOrderId, e.currentTarget, $('checkout-done')));
  $('orders-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-pay]');
    if (btn) pay(btn.dataset.pay, btn, $('orders-view'), { number: btn.dataset.number, total: btn.dataset.total });
  });
  $('menu-orders').addEventListener('click', openOrders);

  // Código postal: 1000001 → 1000-001
  $('checkout-form').elements.postal.addEventListener('input', e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 7);
    e.target.value = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  });

  let pendingReturn = returnParams;   // mostrado assim que a sessão estiver disponível

  // Depois de iniciar sessão (também após confirmar email ou entrar com Google), retoma a encomenda.
  document.addEventListener('forma:auth', e => {
    const { event, session } = e.detail;
    if (event === 'SIGNED_OUT' && dialog.open) dialog.close();
    if (!session || !['SIGNED_IN', 'INITIAL_SESSION'].includes(event)) return;
    if (pendingReturn) { const ret = pendingReturn; pendingReturn = null; setTimeout(() => showPaymentResult(ret), 200); return; }
    let resume = false;
    try { resume = sessionStorage.getItem(RESUME_KEY) === '1'; sessionStorage.removeItem(RESUME_KEY); } catch { /* ignorar */ }
    if (resume && bag.length) setTimeout(openCheckout, 350);
  });

  // Caso a sessão já tenha sido restaurada antes de este ficheiro carregar
  if (auth()?.session) {
    document.dispatchEvent(new CustomEvent('forma:auth', { detail: { event: 'INITIAL_SESSION', session: auth().session } }));
  }
})();
