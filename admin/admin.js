'use strict';

/* =========================================================
   FORMA — painel de administração
   Toda a autorização é feita no Supabase (is_admin(), RLS, funções admin_*,
   políticas do Storage). Este ficheiro só mostra o que a base de dados permite:
   uma conta sem permissão não consegue ler nem alterar nada, mesmo alterando o código.
   ========================================================= */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.FORMA_CONFIG || {};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = n => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const fmtDate = d => (d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  const fmtDateTime = d => (d ? new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

  let client = null;
  let session = null;

  /* ---------- Rótulos ---------- */
  const PUB = { draft: ['Rascunho', ''], published: ['Publicado', 'ok'], archived: ['Arquivado', 'bad'] };
  const PAY = { pending: ['A aguardar pagamento', 'warn'], paid: ['Pago', 'ok'], failed: ['Pagamento falhou', 'bad'], refunded: ['Reembolsado', 'info'] };
  const FUL = { unfulfilled: ['Por preparar', ''], preparing: ['Em preparação', 'info'], shipped: ['Enviada', 'info'], delivered: ['Entregue', 'ok'], cancelled: ['Cancelada', 'bad'] };
  const KIND = { top: 'Parte de cima', pants: 'Calças / calções', shoes: 'Calçado' };
  const STYLES = {
    top: [['sweater', 'Camisola / sweat'], ['tee', 'T-shirt'], ['shirt', 'Camisa'], ['camp', 'Camisa de manga curta'], ['tank', 'Camisola de alças']],
    pants: [['baggy', 'Larga'], ['straight', 'Direita'], ['jogger', 'Jogger'], ['shorts', 'Calções / bermudas'], ['runshorts', 'Calções curtos']],
    shoes: [['', 'Sapatilha / sapato / bota'], ['sandal', 'Sandália / chinelo']],
  };
  const DEFAULT_SIZES = { top: ['XS', 'S', 'M', 'L', 'XL'], pants: ['XS', 'S', 'M', 'L', 'XL'], shoes: ['38', '39', '40', '41', '42', '43', '44', '45', '46'] };
  const badge = (map, key) => { const [t, c] = map[key] || [key, '']; return `<span class="badge ${c}">${esc(t)}</span>`; };

  /* ---------- Erros em português ---------- */
  function errText(error) {
    if (!error) return 'Ocorreu um erro inesperado.';
    const code = error.code || '';
    const msg = String(error.message || error.error || '');
    if (code === 'P0001' && msg) return msg;   // mensagens das funções/validações da base de dados
    if (code === '42501' || /row-level security|permission denied|Sem permissão/i.test(msg)) return 'Sem permissão para esta operação.';
    if (code === '23514') return 'Valores inválidos: confirma preços, quantidades, tamanhos e textos.';
    if (code === '23505') return 'Já existe um registo igual (por exemplo, uma variante com a mesma cor e tamanho).';
    if (code === '23503') return 'Referência inválida: a categoria ou o produto não existe.';
    if (['PGRST205', 'PGRST202', '42P01', '42883', 'PGRST200'].includes(code)) return 'A base de dados ainda não tem o painel configurado: executa supabase/admin.sql no Supabase.';
    if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem ligação ao servidor. Verifica a internet e tenta de novo.';
    if (/mime|file type/i.test(msg)) return 'Tipo de ficheiro não permitido.';
    if (/too large|maximum allowed size|exceeded/i.test(msg)) return 'Ficheiro demasiado grande (máximo 5 MB).';
    if (/bucket not found/i.test(msg)) return 'O armazenamento de imagens não está configurado (executa supabase/admin.sql).';
    console.warn('[Admin] Erro sem tradução:', error);
    return msg || 'Ocorreu um erro inesperado.';
  }
  const fail = error => { const e = new Error(errText(error)); e.friendly = true; throw e; };
  const check = ({ data, error }) => { if (error) fail(error); return data; };

  /* ---------- Toast, confirmação, gaveta ---------- */
  let toastTimer;
  function toast(text, bad = false) {
    const t = $('toast');
    t.textContent = text;
    t.classList.toggle('bad', bad);
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3200);
  }

  function confirmDialog({ title, text, confirm = 'Confirmar', danger = false }) {
    return new Promise(resolve => {
      const d = $('confirm');
      $('confirm-title').textContent = title;
      $('confirm-text').textContent = text;
      const ok = $('confirm-ok');
      ok.textContent = confirm;
      ok.className = `btn ${danger ? 'danger' : 'primary'}`;
      const done = value => { d.close(); resolve(value); };
      ok.onclick = () => done(true);
      $('confirm-cancel').onclick = () => done(false);
      d.oncancel = e => { e.preventDefault(); done(false); };
      d.showModal();
      $('confirm-cancel').focus();
    });
  }

  let drawerSubmit = null;
  function openDrawer({ title, body, actions = [], onSubmit, wide = false, onReady }) {
    $('drawer-title').textContent = title;
    $('drawer-body').innerHTML = body;
    $('drawer-actions').innerHTML = actions.map(a =>
      `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" type="submit" value="${esc(a.value)}" ${a.disabled ? 'disabled' : ''} ${a.title ? `title="${esc(a.title)}"` : ''}>${esc(a.label)}</button>`).join('');
    setDrawerStatus('');
    $('drawer').classList.toggle('wide', wide);
    drawerSubmit = onSubmit;
    if (!$('drawer').open) $('drawer').showModal();
    $('drawer-body').scrollTop = 0;
    onReady?.($('drawer-form'));
  }
  const closeDrawer = () => $('drawer').open && $('drawer').close();
  function setDrawerStatus(text, tone = 'error') {
    const s = $('drawer-status');
    s.textContent = text;
    if (text) s.dataset.tone = tone; else delete s.dataset.tone;
  }

  $('drawer-close').addEventListener('click', closeDrawer);
  $('drawer-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!drawerSubmit) return;
    const btn = e.submitter;
    const action = btn?.value || 'save';
    const form = e.currentTarget;
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    const buttons = [...$('drawer-actions').querySelectorAll('button'), ...$('drawer-body').querySelectorAll('button[type=submit]')];
    const original = btn?.innerHTML;
    buttons.forEach(b => { b.dataset.wasDisabled = b.disabled; b.disabled = true; });
    if (btn) btn.innerHTML = `<span class="spinner ${btn.classList.contains('primary') ? '' : 'dark'}" aria-hidden="true"></span>A guardar…`;
    form.setAttribute('aria-busy', 'true');
    setDrawerStatus('');
    try {
      await drawerSubmit(action, form);
    } catch (err) {
      setDrawerStatus(err.friendly ? err.message : errText(err));
    } finally {
      buttons.forEach(b => { if (b.isConnected) b.disabled = b.dataset.wasDisabled === 'true'; });
      if (btn?.isConnected) btn.innerHTML = original;
      form.removeAttribute('aria-busy');
    }
  });
  function invalid(form, name, text) {
    const el = form.elements[name];
    if (el?.setAttribute) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
    const e = new Error(text); e.friendly = true; throw e;
  }

  /* ---------- Estados de conteúdo ---------- */
  const content = () => $('content');
  const loadingHtml = (text = 'A carregar…') => `<div class="panel"><div class="state"><span class="spinner dark" aria-hidden="true"></span>${esc(text)}</div></div>`;
  const emptyHtml = (title, text = '', action = '') => `<div class="state"><strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}${action}</div>`;
  const errorHtml = text => `<div class="panel"><div class="state error"><strong>Não foi possível carregar</strong><span>${esc(text)}</span><button class="btn" type="button" data-retry>Tentar de novo</button></div></div>`;

  function pagerHtml(total, page, size) {
    const pages = Math.max(1, Math.ceil(total / size));
    if (total <= size) return `<div class="pager"><span>${total} ${total === 1 ? 'resultado' : 'resultados'}</span></div>`;
    const from = (page - 1) * size + 1;
    const to = Math.min(total, page * size);
    const nums = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    return `<div class="pager"><span>${from}–${to} de ${total}</span><div class="row-actions">
      <button class="btn small" type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Página anterior">←</button>
      ${nums.map(n => (n === '…' ? '<span>…</span>' : `<button class="btn small" type="button" data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`)).join('')}
      <button class="btn small" type="button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Página seguinte">→</button>
    </div></div>`;
  }

  const selectHtml = (key, options, value, label) =>
    `<select data-filter="${key}" aria-label="${esc(label)}">${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;

  /* ---------- Imagens (Supabase Storage) ---------- */
  const IMAGE_TYPES = { looks: ['image/png', 'image/webp'], catalog: ['image/png', 'image/jpeg', 'image/webp'] };
  const EXT = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' };
  function checkImage(bucket, file) {
    if (!IMAGE_TYPES[bucket].includes(file.type)) {
      return bucket === 'looks' ? 'A imagem do modelo tem de ser PNG ou WebP (com fundo transparente).' : 'Usa imagens PNG, JPEG ou WebP.';
    }
    if (file.size > 5 * 1024 * 1024) return `«${file.name}» tem mais de 5 MB.`;
    return null;
  }
  async function uploadImage(bucket, file, folder) {
    const problem = checkImage(bucket, file);
    if (problem) { const e = new Error(problem); e.friendly = true; throw e; }
    const path = `${folder}/${crypto.randomUUID()}.${EXT[file.type]}`;
    const { error } = await client.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (error) fail(error);
    return path;
  }
  const publicUrl = (bucket, path) => client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  async function hasTransparency(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * scale));
      c.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return true;
      return false;
    } catch { return true; }   // não foi possível analisar: não bloqueia
  }

  /* ---------- Dados partilhados ---------- */
  const cache = { products: null, categories: null };
  async function loadProducts(force = false) {
    if (cache.products && !force) return cache.products;
    cache.products = check(await client.from('products')
      .select('sku, kind, name, color_name, color_hex, style, description, images, price, status, updated_at, product_variants(id, color_name, color_hex, size, stock, active)')
      .order('name'));
    return cache.products;
  }
  async function loadCategories(force = false) {
    if (cache.categories && !force) return cache.categories;
    cache.categories = check(await client.from('categories').select('id, name, description, image_url, position, visible, looks(count)').order('position'));
    return cache.categories;
  }

  /* =========================================================
     Navegação
     ========================================================= */
  const SECTIONS = {
    overview: { title: 'Visão geral', render: renderOverview },
    looks: { title: 'Looks e carrossel', render: renderLooks },
    products: { title: 'Produtos', render: renderProducts },
    categories: { title: 'Categorias', render: renderCategories },
    orders: { title: 'Encomendas', render: renderOrders },
  };
  let current = null;
  function go(name) {
    if (!SECTIONS[name]) name = 'overview';
    current = name;
    document.querySelectorAll('.nav a').forEach(a => { if (a.dataset.section === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('section-title').textContent = SECTIONS[name].title;
    $('section-actions').innerHTML = '';
    document.title = `${SECTIONS[name].title} · FORMA Admin`;
    refresh();
  }
  async function refresh() {
    const name = current;
    try {
      await SECTIONS[name].render();
    } catch (err) {
      if (current === name) content().innerHTML = errorHtml(err.friendly ? err.message : errText(err));
    }
  }
  window.addEventListener('hashchange', () => !$('app').hidden && go(location.hash.slice(1)));
  content().addEventListener('click', e => { if (e.target.closest('[data-retry]')) refresh(); });

  // Pesquisa / filtros / paginação partilhados (cada secção define state + onChange)
  let listCtl = null;
  let searchTimer;
  content().addEventListener('input', e => {
    if (!listCtl || !e.target.matches('[data-q]')) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { listCtl.state.q = e.target.value; listCtl.state.page = 1; listCtl.update(); }, 250);
  });
  content().addEventListener('change', e => {
    if (!listCtl || !e.target.matches('[data-filter]')) return;
    listCtl.state[e.target.dataset.filter] = e.target.value;
    listCtl.state.page = 1;
    listCtl.update();
  });
  content().addEventListener('click', e => {
    const p = e.target.closest('[data-page]');
    if (!p || !listCtl || p.disabled) return;
    listCtl.state.page = Number(p.dataset.page);
    listCtl.update();
  });
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* =========================================================
     1. Visão geral
     ========================================================= */
  async function renderOverview() {
    listCtl = null;
    content().innerHTML = loadingHtml();
    const d = check(await client.rpc('admin_overview'));
    const noSales = Number(d.paid_orders) === 0;
    const card = (label, value, sub = '', attention = false) =>
      `<div class="card ${attention ? 'attention' : ''}"><span class="label">${esc(label)}</span><span class="value">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;

    const lowStock = !Number(d.variants_tracked)
      ? emptyHtml('Ainda não há stock registado', 'Adiciona variantes de cor e tamanho aos produtos para controlar o stock.', '<a class="btn small" href="#products">Ir para Produtos</a>')
      : !d.low_stock.length
        ? emptyHtml('Sem produtos com pouco stock', 'Nenhuma variante ativa com 3 ou menos unidades.')
        : `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Cor</th><th>Tamanho</th><th class="num">Stock</th></tr></thead><tbody>
            ${d.low_stock.map(v => `<tr><td>${esc(v.name)}<br><small class="muted">${esc(v.sku)}</small></td><td>${esc(v.color_name)}</td><td>${esc(v.size)}</td>
              <td class="num">${v.stock === 0 ? '<span class="badge bad">Esgotado</span>' : `<span class="badge warn">${v.stock}</span>`}</td></tr>`).join('')}
          </tbody></table></div>`;

    const recent = !d.recent_orders.length
      ? emptyHtml('Ainda não há encomendas', 'Quando um cliente encomendar, aparece aqui.')
      : `<div class="table-wrap"><table><thead><tr><th>N.º</th><th>Cliente</th><th class="num">Total</th><th>Pagamento</th><th class="hide-sm">Envio</th></tr></thead><tbody>
          ${d.recent_orders.map(o => `<tr><td>${o.number}<br><small class="muted">${fmtDate(o.created_at)}</small></td><td>${esc(o.ship_name)}</td>
            <td class="num">${money(o.total)}</td><td>${badge(PAY, o.payment_status)}</td><td class="hide-sm">${badge(FUL, o.fulfillment_status)}</td></tr>`).join('')}
        </tbody></table></div>`;

    content().innerHTML = `
      ${noSales && Number(d.awaiting_payment) > 0 ? `<div class="note warn">Há ${d.awaiting_payment} encomenda(s) a aguardar pagamento. Os pagamentos só são confirmados pela Stripe (webhook); enquanto a Stripe não estiver configurada, nenhuma encomenda passa a «Pago».</div>` : ''}
      <div class="cards">
        ${card('Vendas confirmadas', noSales ? '—' : money(d.revenue_total), noSales ? 'Ainda sem pagamentos confirmados' : `${d.paid_orders} encomenda(s) paga(s)`)}
        ${card('Vendas este mês', noSales ? '—' : money(d.revenue_month))}
        ${card('Encomendas', Number(d.orders_total) ? d.orders_total : '—', Number(d.orders_total) ? `${d.orders_today} hoje` : 'Ainda sem encomendas')}
        ${card('A aguardar pagamento', d.awaiting_payment, Number(d.awaiting_payment) ? `${money(d.pending_value)} por confirmar` : '', Number(d.awaiting_payment) > 0)}
        ${card('Por preparar / enviar', d.to_fulfill, 'Pagas e ainda não enviadas', Number(d.to_fulfill) > 0)}
        ${card('Looks publicados', d.looks_published, `${d.looks_draft} em rascunho`)}
        ${card('Produtos publicados', d.products_published, `${d.products_total} no catálogo`)}
      </div>
      <div class="split">
        <section class="panel"><h2>Stock baixo <a class="small muted" href="#products">Produtos →</a></h2>${lowStock}</section>
        <section class="panel"><h2>Últimas encomendas <a class="small muted" href="#orders">Ver todas →</a></h2>${recent}</section>
      </div>`;
  }

  /* =========================================================
     2. Produtos
     ========================================================= */
  const productState = { q: '', status: 'active', kind: '', page: 1 };
  const PRODUCT_PAGE = 15;

  async function renderProducts() {
    $('section-actions').innerHTML = '<button class="btn primary" type="button" id="new-product">+ Novo produto</button>';
    $('new-product').onclick = () => productForm(null);
    content().innerHTML = loadingHtml();
    await loadProducts(true);
    const s = productState;
    content().innerHTML = `<section class="panel">
      <div class="toolbar">
        <input type="search" data-q placeholder="Pesquisar por nome, cor ou SKU" value="${esc(s.q)}" aria-label="Pesquisar produtos">
        ${selectHtml('status', [['active', 'Ativos'], ['published', 'Publicados'], ['draft', 'Rascunhos'], ['archived', 'Arquivados'], ['all', 'Todos']], s.status, 'Estado')}
        ${selectHtml('kind', [['', 'Todos os tipos'], ['top', KIND.top], ['pants', KIND.pants], ['shoes', KIND.shoes]], s.kind, 'Tipo')}
      </div>
      <div id="list"></div></section>`;
    listCtl = { state: s, update: drawProducts };
    drawProducts();
  }

  function stockOf(p) {
    const vs = (p.product_variants || []).filter(v => v.active);
    return vs.length ? vs.reduce((t, v) => t + v.stock, 0) : null;
  }

  function drawProducts() {
    const s = productState;
    const q = norm(s.q);
    const rows = cache.products.filter(p =>
      (s.status === 'all' || (s.status === 'active' ? p.status !== 'archived' : p.status === s.status))
      && (!s.kind || p.kind === s.kind)
      && (!q || norm(`${p.name} ${p.color_name} ${p.sku}`).includes(q)));
    const page = Math.min(s.page, Math.max(1, Math.ceil(rows.length / PRODUCT_PAGE)));
    s.page = page;
    const slice = rows.slice((page - 1) * PRODUCT_PAGE, page * PRODUCT_PAGE);
    $('list').innerHTML = !rows.length
      ? emptyHtml(cache.products.length ? 'Nenhum produto corresponde à pesquisa' : 'Ainda não há produtos', cache.products.length ? 'Muda a pesquisa ou os filtros.' : 'Cria o primeiro produto.')
      : `<div class="table-wrap"><table><thead><tr><th>Produto</th><th class="hide-sm">Tipo</th><th class="hide-sm">Cor</th><th class="num">Preço</th><th class="num">Stock</th><th>Estado</th><th></th></tr></thead><tbody>
        ${slice.map(p => {
          const st = stockOf(p);
          return `<tr>
            <td><div class="cell-main">${p.images?.[0] ? `<img class="thumb" src="${esc(p.images[0])}" alt="">` : `<span class="thumb"><span class="dot" style="background:${esc(p.color_hex || '#ccc')};margin:0"></span></span>`}
              <span>${esc(p.name)}<small>${esc(p.sku)}</small></span></div></td>
            <td class="hide-sm">${esc(KIND[p.kind])}</td>
            <td class="hide-sm"><span class="dot" style="background:${esc(p.color_hex || '#ccc')}"></span>${esc(p.color_name)}</td>
            <td class="num">${money(p.price)}</td>
            <td class="num">${st === null ? '<span class="muted small">Sem controlo</span>' : st === 0 ? '<span class="badge bad">Esgotado</span>' : st}</td>
            <td>${badge(PUB, p.status)}</td>
            <td class="actions">
              <button class="btn small" type="button" data-edit="${esc(p.sku)}">Editar</button>
              ${p.status === 'draft' ? `<button class="btn small" type="button" data-publish="${esc(p.sku)}">Publicar</button>` : ''}
              ${p.status === 'archived' ? `<button class="btn small" type="button" data-restore="${esc(p.sku)}">Restaurar</button>`
                : `<button class="btn small danger" type="button" data-archive="${esc(p.sku)}">Arquivar</button>`}
            </td></tr>`;
        }).join('')}</tbody></table></div>${pagerHtml(rows.length, page, PRODUCT_PAGE)}`;
  }

  content().addEventListener('click', async e => {
    if (current !== 'products') return;
    const edit = e.target.closest('[data-edit]');
    if (edit) return productForm(cache.products.find(p => p.sku === edit.dataset.edit));
    const btn = e.target.closest('[data-publish],[data-archive],[data-restore]');
    if (!btn) return;
    const sku = btn.dataset.publish || btn.dataset.archive || btn.dataset.restore;
    const p = cache.products.find(x => x.sku === sku);
    let status = 'published';
    if (btn.dataset.archive) {
      const ok = await confirmDialog({
        title: 'Arquivar produto?',
        text: `«${p.name}» deixa de aparecer na loja e não pode ser encomendado. As encomendas já feitas mantêm-se intactas. Looks publicados que o usem deixam de o mostrar.`,
        confirm: 'Arquivar', danger: true,
      });
      if (!ok) return;
      status = 'archived';
    } else if (btn.dataset.restore) status = 'draft';
    btn.disabled = true;
    const { error } = await client.from('products').update({ status }).eq('sku', sku);
    if (error) { toast(errText(error), true); btn.disabled = false; return; }
    toast(status === 'archived' ? 'Produto arquivado.' : status === 'published' ? 'Produto publicado.' : 'Produto restaurado como rascunho.');
    refresh();
  });

  function styleOptions(kind, value) {
    return STYLES[kind].map(([v, t]) => `<option value="${v}" ${v === (value ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
  }
  function variantRow(v = {}, kind = 'top', color = {}) {
    return `<div class="variant-row ${v.active === false ? 'inactive' : ''}" data-variant="${v.id ?? ''}">
      <input type="text" name="v_color" value="${esc(v.color_name ?? color.name ?? '')}" maxlength="40" aria-label="Cor" placeholder="Cor">
      <input type="color" name="v_hex" value="${esc(v.color_hex || color.hex || '#9aa0a6')}" aria-label="Amostra da cor">
      <input type="text" name="v_size" value="${esc(v.size ?? '')}" maxlength="6" aria-label="Tamanho" placeholder="${kind === 'shoes' ? '42' : 'M'}">
      <input type="number" name="v_stock" value="${v.stock ?? 0}" min="0" max="100000" step="1" inputmode="numeric" aria-label="Stock">
      <label class="check" title="Ativa"><input type="checkbox" name="v_active" ${v.active === false ? '' : 'checked'}> <span class="hide-sm">Ativa</span></label>
    </div>`;
  }

  function productForm(p) {
    const isNew = !p;
    const kind = p?.kind || 'top';
    let images = [...(p?.images || [])];
    let newFiles = [];
    const body = `
      <div class="grid-2">
        <label>Nome <input type="text" name="name" value="${esc(p?.name)}" maxlength="80" required></label>
        <label>Tipo <select name="kind" ${isNew ? '' : 'disabled'}>${Object.entries(KIND).map(([k, t]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <label>Descrição <textarea name="description" maxlength="1000">${esc(p?.description)}</textarea></label>
      <div class="grid-3">
        <label>Cor principal <input type="text" name="color_name" value="${esc(p?.color_name)}" maxlength="40" required></label>
        <label>Amostra <input type="color" name="color_hex" value="${esc(p?.color_hex || '#9aa0a6')}"></label>
        <label>Forma (ícone) <select name="style">${styleOptions(kind, p?.style)}</select></label>
      </div>
      <div class="grid-2">
        <label>Preço (€) <input type="text" name="price" value="${p ? Number(p.price).toFixed(2).replace('.', ',') : ''}" inputmode="decimal" placeholder="49,90" required>
          <span class="field-hint">Entre 0,01 € e 10 000 €. Encomendas já feitas mantêm o preço da altura.</span></label>
        <label>Estado <select name="status">
          ${[['draft', 'Rascunho (não aparece na loja)'], ['published', 'Publicado'], ...(p?.status === 'archived' ? [['archived', 'Arquivado']] : [])]
            .map(([v, t]) => `<option value="${v}" ${v === (p?.status || 'draft') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <fieldset><legend>Fotografias</legend>
        <div class="images" id="images"></div>
        <label>Acrescentar fotografias <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple>
          <span class="field-hint">PNG, JPEG ou WebP até 5 MB. A primeira é a principal. Máximo 8.</span></label>
      </fieldset>
      <fieldset><legend>Variantes de cor e tamanho</legend>
        <p class="field-hint">Cada variante tem stock próprio. Sem variantes, o produto vende-se nos tamanhos padrão sem controlo de stock. Variantes não se apagam: desativa-as.</p>
        <div class="variant-row variant-head"><span>Cor</span><span></span><span>Tamanho</span><span>Stock</span><span></span></div>
        <div class="variants" id="variants">${(p?.product_variants || []).sort((a, b) => a.id - b.id).map(v => variantRow(v, kind)).join('')}</div>
        <div class="row-actions">
          <button class="btn small" type="button" id="add-variant">+ Variante</button>
          <button class="btn small" type="button" id="add-sizes">+ Todos os tamanhos da cor principal</button>
        </div>
      </fieldset>`;

    openDrawer({
      title: isNew ? 'Novo produto' : `Editar · ${p.name}`,
      body,
      actions: [{ label: isNew ? 'Criar produto' : 'Guardar alterações', value: 'save', primary: true }],
      onReady: form => {
        const drawImages = () => {
          $('images').innerHTML = images.map((url, i) => `<div class="image-tile"><img src="${esc(url)}" alt="">${i === 0 ? '<span class="tag">Principal</span>' : ''}
              <button class="icon-btn" type="button" data-rm-img="${i}" aria-label="Remover fotografia">✕</button></div>`).join('')
            + newFiles.map((f, i) => `<div class="image-tile new"><img src="${URL.createObjectURL(f)}" alt=""><span class="tag">Nova</span>
              <button class="icon-btn" type="button" data-rm-new="${i}" aria-label="Remover fotografia">✕</button></div>`).join('')
            || '<span class="muted small">Sem fotografias.</span>';
        };
        drawImages();
        $('images').onclick = e => {
          const a = e.target.closest('[data-rm-img]'); const b = e.target.closest('[data-rm-new]');
          if (a) images.splice(Number(a.dataset.rmImg), 1);
          if (b) newFiles.splice(Number(b.dataset.rmNew), 1);
          if (a || b) drawImages();
        };
        form.elements.photos.onchange = e => {
          const files = [...e.target.files];
          const bad = files.map(f => checkImage('catalog', f)).find(Boolean);
          if (bad) setDrawerStatus(bad); else setDrawerStatus('');
          newFiles.push(...files.filter(f => !checkImage('catalog', f)));
          e.target.value = '';
          drawImages();
        };
        form.elements.kind.onchange = e => { form.elements.style.innerHTML = styleOptions(e.target.value, null); };
        $('add-variant').onclick = () => {
          $('variants').insertAdjacentHTML('beforeend', variantRow({}, form.elements.kind.value, { name: form.elements.color_name.value, hex: form.elements.color_hex.value }));
          $('variants').lastElementChild.querySelector('[name=v_size]').focus();
        };
        $('add-sizes').onclick = () => {
          const color = form.elements.color_name.value.trim();
          if (!color) { invalidSoft(form, 'color_name', 'Indica primeiro a cor principal.'); return; }
          const existing = new Set([...$('variants').children].map(r => `${norm(r.querySelector('[name=v_color]').value)}|${r.querySelector('[name=v_size]').value.trim().toUpperCase()}`));
          DEFAULT_SIZES[form.elements.kind.value].forEach(size => {
            if (!existing.has(`${norm(color)}|${size}`)) $('variants').insertAdjacentHTML('beforeend', variantRow({ size, stock: 0 }, form.elements.kind.value, { name: color, hex: form.elements.color_hex.value }));
          });
        };
        $('variants').onchange = e => { const r = e.target.closest('.variant-row'); if (r && e.target.name === 'v_active') r.classList.toggle('inactive', !e.target.checked); };
      },
      onSubmit: async (_, form) => {
        const f = form.elements;
        const name = f.name.value.trim().replace(/\s+/g, ' ');
        const colorName = f.color_name.value.trim();
        const priceText = f.price.value.trim().replace(/\s|€/g, '').replace(',', '.');
        if (!name) invalid(form, 'name', 'Indica o nome do produto.');
        if (!colorName) invalid(form, 'color_name', 'Indica a cor principal.');
        if (!/^\d{1,5}(\.\d{1,2})?$/.test(priceText) || Number(priceText) <= 0 || Number(priceText) > 10000) {
          invalid(form, 'price', 'Preço inválido: usa um valor entre 0,01 € e 10 000 €, com no máximo 2 casas decimais.');
        }
        if (images.length + newFiles.length > 8) throw Object.assign(new Error('Máximo de 8 fotografias por produto.'), { friendly: true });

        // Variantes
        const seen = new Set();
        const variants = [...$('variants').children].map(row => {
          const v = {
            id: row.dataset.variant ? Number(row.dataset.variant) : null,
            color_name: row.querySelector('[name=v_color]').value.trim(),
            color_hex: row.querySelector('[name=v_hex]').value,
            size: row.querySelector('[name=v_size]').value.trim().toUpperCase(),
            stockText: row.querySelector('[name=v_stock]').value.trim(),
            active: row.querySelector('[name=v_active]').checked,
            row,
          };
          return v;
        }).filter(v => v.id || v.color_name || v.size);
        for (const v of variants) {
          const mark = sel => { const el = v.row.querySelector(sel); el.setAttribute('aria-invalid', 'true'); el.focus(); };
          if (!v.color_name) { mark('[name=v_color]'); throw Object.assign(new Error('Cada variante precisa de uma cor.'), { friendly: true }); }
          if (!/^[A-Z0-9]{1,6}$/.test(v.size)) { mark('[name=v_size]'); throw Object.assign(new Error(`Tamanho inválido «${v.size}»: usa até 6 letras ou números (ex.: M, XL, 42).`), { friendly: true }); }
          if (!/^\d{1,6}$/.test(v.stockText) || Number(v.stockText) > 100000) { mark('[name=v_stock]'); throw Object.assign(new Error('O stock tem de ser um número inteiro entre 0 e 100 000.'), { friendly: true }); }
          const key = `${norm(v.color_name)}|${v.size}`;
          if (seen.has(key)) { mark('[name=v_size]'); throw Object.assign(new Error(`Variante repetida: ${v.color_name} / ${v.size}.`), { friendly: true }); }
          seen.add(key);
          v.stock = Number(v.stockText);
        }

        // Fotografias novas
        for (const file of newFiles) {
          setDrawerStatus(`A carregar «${file.name}»…`, 'warn');
          images.push(publicUrl('catalog', await uploadImage('catalog', file, 'products')));
        }
        newFiles = [];
        setDrawerStatus('');

        const fields = {
          name, color_name: colorName, color_hex: f.color_hex.value, style: f.style.value || null,
          description: f.description.value.trim(), images, price: Number(priceText), status: f.status.value,
        };
        let sku = p?.sku;
        if (isNew) {
          const kindValue = f.kind.value;
          const slug = norm(name).replace(/[^a-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).slice(0, 24) || 'produto';
          sku = `${kindValue}:${slug}${Date.now().toString(36).slice(-4)}`;
          check(await client.from('products').insert({ sku, kind: kindValue, ...fields }));
          p = { sku, product_variants: [] };   // se as variantes falharem, já existe o produto
        } else {
          check(await client.from('products').update(fields).eq('sku', sku));
        }

        const before = new Map((p.product_variants || []).map(v => [v.id, v]));
        for (const v of variants) {
          const data = { color_name: v.color_name, color_hex: v.color_hex, size: v.size, stock: v.stock, active: v.active };
          if (v.id) {
            const o = before.get(v.id);
            if (o && o.color_name === data.color_name && o.color_hex === data.color_hex && o.size === data.size && o.stock === data.stock && o.active === data.active) continue;
            check(await client.from('product_variants').update(data).eq('id', v.id));
          } else {
            check(await client.from('product_variants').insert({ product_sku: sku, ...data }));
          }
        }
        closeDrawer();
        toast(isNew ? 'Produto criado.' : 'Produto guardado.');
        refresh();
      },
    });
  }
  function invalidSoft(form, name, text) {
    form.elements[name].setAttribute('aria-invalid', 'true');
    form.elements[name].focus();
    setDrawerStatus(text);
  }

  /* =========================================================
     3. Categorias
     ========================================================= */
  const catState = { q: '', page: 1 };
  async function renderCategories() {
    $('section-actions').innerHTML = '<button class="btn primary" type="button" id="new-category">+ Nova categoria</button>';
    $('new-category').onclick = () => categoryForm(null);
    content().innerHTML = loadingHtml();
    await loadCategories(true);
    content().innerHTML = `<section class="panel">
      <div class="toolbar"><input type="search" data-q placeholder="Pesquisar categorias" value="${esc(catState.q)}" aria-label="Pesquisar categorias"></div>
      <div id="list"></div>
      <p class="field-hint">A ordem define a posição dos separadores no topo da loja. Categorias escondidas não aparecem na loja (os looks continuam em «Tudo»).</p></section>`;
    listCtl = { state: catState, update: drawCategories };
    drawCategories();
  }
  function drawCategories() {
    const q = norm(catState.q);
    const all = cache.categories;
    const rows = all.filter(c => !q || norm(`${c.name} ${c.id} ${c.description}`).includes(q));
    const size = 15;
    const page = Math.min(catState.page, Math.max(1, Math.ceil(rows.length / size)));
    catState.page = page;
    $('list').innerHTML = !rows.length ? emptyHtml(all.length ? 'Nenhuma categoria corresponde à pesquisa' : 'Ainda não há categorias')
      : `<div class="table-wrap"><table><thead><tr><th>Categoria</th><th class="hide-sm">Descrição</th><th class="num">Looks do painel</th><th>Ordem</th><th>Loja</th><th></th></tr></thead><tbody>
        ${rows.slice((page - 1) * size, page * size).map(c => {
          const i = all.indexOf(c);
          return `<tr>
          <td><div class="cell-main">${c.image_url ? `<img class="thumb" src="${esc(c.image_url)}" alt="">` : '<span class="thumb"></span>'}<span>${esc(c.name)}<small>${esc(c.id)}</small></span></div></td>
          <td class="hide-sm">${esc(c.description) || '<span class="muted">—</span>'}</td>
          <td class="num">${c.looks?.[0]?.count ?? 0}</td>
          <td><span class="order-cell"><button class="icon-btn" type="button" data-cat-move="${esc(c.id)}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button class="icon-btn" type="button" data-cat-move="${esc(c.id)}" data-dir="1" ${i === all.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button></span></td>
          <td>${c.visible ? '<span class="badge ok">Visível</span>' : '<span class="badge">Escondida</span>'}</td>
          <td class="actions"><button class="btn small" type="button" data-cat-edit="${esc(c.id)}">Editar</button>
            <button class="btn small" type="button" data-cat-toggle="${esc(c.id)}">${c.visible ? 'Esconder' : 'Mostrar'}</button></td></tr>`;
        }).join('')}</tbody></table></div>${pagerHtml(rows.length, page, size)}`;
  }
  // Reordenar: atribui posições 1..n pela nova ordem
  async function saveOrder(table, key, list) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].position !== i + 1) check(await client.from(table).update({ position: i + 1 }).eq(key, list[i][key]));
    }
  }
  content().addEventListener('click', async e => {
    if (current !== 'categories') return;
    const edit = e.target.closest('[data-cat-edit]');
    if (edit) return categoryForm(cache.categories.find(c => c.id === edit.dataset.catEdit));
    const tog = e.target.closest('[data-cat-toggle]');
    if (tog) {
      const c = cache.categories.find(x => x.id === tog.dataset.catToggle);
      if (c.visible && !(await confirmDialog({ title: 'Esconder categoria?', text: `O separador «${c.name}» deixa de aparecer na loja. Podes voltar a mostrá-lo a qualquer momento.`, confirm: 'Esconder' }))) return;
      tog.disabled = true;
      const { error } = await client.from('categories').update({ visible: !c.visible }).eq('id', c.id);
      if (error) { toast(errText(error), true); tog.disabled = false; return; }
      toast(c.visible ? 'Categoria escondida.' : 'Categoria visível na loja.');
      return refresh();
    }
    const mv = e.target.closest('[data-cat-move]');
    if (mv) {
      const list = [...cache.categories];
      const i = list.findIndex(c => c.id === mv.dataset.catMove);
      const j = i + Number(mv.dataset.dir);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      mv.disabled = true;
      try { await saveOrder('categories', 'id', list); toast('Ordem atualizada.'); } catch (err) { toast(err.message, true); }
      refresh();
    }
  });

  function categoryForm(c) {
    const isNew = !c;
    let imageUrl = c?.image_url || null;
    let newFile = null;
    openDrawer({
      title: isNew ? 'Nova categoria' : `Editar · ${c.name}`,
      body: `
        <label>Nome <input type="text" name="name" value="${esc(c?.name)}" maxlength="40" required></label>
        <label>Identificador (URL) <input type="text" name="id" value="${esc(c?.id)}" maxlength="40" ${isNew ? '' : 'readonly'} placeholder="date-night">
          <span class="field-hint">${isNew ? 'Letras minúsculas, números e hífens. Usado no link da loja (index.html#…). Não pode ser alterado depois.' : 'Não pode ser alterado (é usado nos links e nos looks).'}</span></label>
        <label>Descrição na loja <input type="text" name="description" value="${esc(c?.description)}" maxlength="200" placeholder="conjuntos para uma noite especial.">
          <span class="field-hint">Aparece depois do número de looks: «6 conjuntos para…».</span></label>
        <div class="grid-2">
          <label>Ordem <input type="number" name="position" value="${c?.position ?? (cache.categories?.length || 0) + 1}" min="0" max="9999" step="1"></label>
          <label class="check" style="align-self:end"><input type="checkbox" name="visible" ${c?.visible === false ? '' : 'checked'}> Visível na loja</label>
        </div>
        <fieldset><legend>Imagem</legend><div class="images" id="cat-image"></div>
          <label>Escolher imagem <input type="file" name="image" accept="image/png,image/jpeg,image/webp"></label></fieldset>`,
      actions: [{ label: isNew ? 'Criar categoria' : 'Guardar', value: 'save', primary: true }],
      onReady: form => {
        const draw = () => {
          const src = newFile ? URL.createObjectURL(newFile) : imageUrl;
          $('cat-image').innerHTML = src ? `<div class="image-tile ${newFile ? 'new' : ''}"><img src="${esc(src)}" alt=""><button class="icon-btn" type="button" id="rm-cat-img" aria-label="Remover imagem">✕</button></div>` : '<span class="muted small">Sem imagem.</span>';
          if (src) $('rm-cat-img').onclick = () => { newFile = null; imageUrl = null; draw(); };
        };
        draw();
        form.elements.image.onchange = e => {
          const file = e.target.files[0];
          e.target.value = '';
          if (!file) return;
          const bad = checkImage('catalog', file);
          if (bad) { setDrawerStatus(bad); return; }
          setDrawerStatus('');
          newFile = file; draw();
        };
        if (isNew) form.elements.name.oninput = e => {
          if (!form.elements.id.dataset.touched) form.elements.id.value = norm(e.target.value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        };
        if (isNew) form.elements.id.oninput = e => { e.target.dataset.touched = '1'; };
      },
      onSubmit: async (_, form) => {
        const f = form.elements;
        const name = f.name.value.trim();
        const id = f.id.value.trim();
        const position = Number(f.position.value);
        if (!name) invalid(form, 'name', 'Indica o nome da categoria.');
        if (isNew && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) invalid(form, 'id', 'Identificador inválido: usa letras minúsculas, números e hífens (ex.: date-night).');
        if (!Number.isInteger(position) || position < 0 || position > 9999) invalid(form, 'position', 'A ordem tem de ser um número inteiro entre 0 e 9999.');
        if (newFile) imageUrl = publicUrl('catalog', await uploadImage('catalog', newFile, 'categories'));
        const data = { name, description: f.description.value.trim(), position, visible: f.visible.checked, image_url: imageUrl };
        if (isNew) {
          const { error } = await client.from('categories').insert({ id, ...data });
          if (error?.code === '23505') invalid(form, 'id', 'Já existe uma categoria com esse identificador.');
          if (error) fail(error);
        } else {
          check(await client.from('categories').update(data).eq('id', c.id));
        }
        closeDrawer();
        toast(isNew ? 'Categoria criada.' : 'Categoria guardada.');
        refresh();
      },
    });
  }

  /* =========================================================
     4. Looks e carrossel
     ========================================================= */
  const lookState = { q: '', status: 'active', cat: '', page: 1 };
  let looksData = [];
  const LOOK_FIELDS = 'id, name, description, category_id, image_path, status, position, updated_at, published_at, look_products(product_sku, position)';

  async function renderLooks() {
    $('section-actions').innerHTML = '<button class="btn primary" type="button" id="new-look">+ Novo look</button>';
    $('new-look').onclick = () => lookForm(null);
    content().innerHTML = loadingHtml();
    const [looks] = await Promise.all([
      client.from('looks').select(LOOK_FIELDS).order('category_id').order('position'),
      loadProducts(true), loadCategories(true),
    ]);
    looksData = check(looks);
    const s = lookState;
    content().innerHTML = `<section class="panel">
      <div class="toolbar">
        <input type="search" data-q placeholder="Pesquisar looks" value="${esc(s.q)}" aria-label="Pesquisar looks">
        ${selectHtml('status', [['active', 'Ativos'], ['published', 'Publicados'], ['draft', 'Rascunhos'], ['archived', 'Arquivados'], ['all', 'Todos']], s.status, 'Estado')}
        ${selectHtml('cat', [['', 'Todas as categorias'], ...cache.categories.map(c => [c.id, c.name])], s.cat, 'Categoria')}
      </div>
      <div id="list"></div>
      <p class="field-hint">Os looks publicados aparecem no carrossel da loja, à frente da coleção original, pela ordem definida aqui (dentro de cada categoria).</p></section>`;
    listCtl = { state: s, update: drawLooks };
    drawLooks();
  }

  const productBySku = sku => cache.products.find(p => p.sku === sku);
  const lookPieces = l => (l.look_products || []).slice().sort((a, b) => a.position - b.position).map(lp => productBySku(lp.product_sku)).filter(Boolean);
  const lookPrice = pieces => pieces.reduce((t, p) => t + Number(p.price), 0);
  const catName = id => cache.categories.find(c => c.id === id)?.name || id;
  const sameCatActive = l => looksData.filter(x => x.category_id === l.category_id && x.status !== 'archived').sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  function drawLooks() {
    const s = lookState;
    const q = norm(s.q);
    const rows = looksData.filter(l =>
      (s.status === 'all' || (s.status === 'active' ? l.status !== 'archived' : l.status === s.status))
      && (!s.cat || l.category_id === s.cat)
      && (!q || norm(`${l.name} ${l.description} ${catName(l.category_id)}`).includes(q)));
    const size = 12;
    const page = Math.min(s.page, Math.max(1, Math.ceil(rows.length / size)));
    s.page = page;
    $('list').innerHTML = !rows.length
      ? emptyHtml(looksData.length ? 'Nenhum look corresponde à pesquisa' : 'Ainda não há looks criados no painel', looksData.length ? 'Muda a pesquisa ou os filtros.' : 'A loja mostra a coleção original. Cria um look para o juntar ao carrossel.')
      : `<div class="table-wrap"><table><thead><tr><th>Look</th><th class="hide-sm">Categoria</th><th class="num">Peças</th><th class="num">Conjunto</th><th>Ordem</th><th>Estado</th><th></th></tr></thead><tbody>
        ${rows.slice((page - 1) * size, page * size).map(l => {
          const pieces = lookPieces(l);
          const hidden = pieces.filter(p => p.status !== 'published').length;
          const group = sameCatActive(l);
          const idx = group.indexOf(l);
          return `<tr>
            <td><div class="cell-main">${l.image_path ? `<img class="thumb model" src="${esc(publicUrl('looks', l.image_path))}" alt="">` : '<span class="thumb model"></span>'}
              <span>${esc(l.name)}<small>${esc(l.description) || '&nbsp;'}</small></span></div></td>
            <td class="hide-sm">${esc(catName(l.category_id))}</td>
            <td class="num">${pieces.length}${hidden ? `<br><small class="muted">${hidden} não publicada(s)</small>` : ''}</td>
            <td class="num">${pieces.length ? money(lookPrice(pieces)) : '—'}</td>
            <td>${l.status === 'archived' ? '<span class="muted">—</span>' : `<span class="order-cell">
              <button class="icon-btn" type="button" data-look-move="${l.id}" data-dir="-1" ${idx <= 0 ? 'disabled' : ''} aria-label="Mais à frente no carrossel">↑</button>
              <span>${idx + 1}</span>
              <button class="icon-btn" type="button" data-look-move="${l.id}" data-dir="1" ${idx === group.length - 1 ? 'disabled' : ''} aria-label="Mais atrás no carrossel">↓</button></span>`}</td>
            <td>${badge(PUB, l.status)}</td>
            <td class="actions">
              <button class="btn small" type="button" data-look-edit="${l.id}">Editar</button>
              <a class="btn small" href="../index.html?preview=${l.id}" target="_blank" rel="noopener">Pré-visualizar</a>
              ${l.status === 'draft' ? `<button class="btn small" type="button" data-look-status="published" data-id="${l.id}">Publicar</button>` : ''}
              ${l.status === 'published' ? `<button class="btn small" type="button" data-look-status="draft" data-id="${l.id}">Despublicar</button>` : ''}
              ${l.status === 'archived' ? `<button class="btn small" type="button" data-look-status="draft" data-id="${l.id}">Restaurar</button>`
                : `<button class="btn small danger" type="button" data-look-status="archived" data-id="${l.id}">Arquivar</button>`}
            </td></tr>`;
        }).join('')}</tbody></table></div>${pagerHtml(rows.length, page, size)}`;
  }

  content().addEventListener('click', async e => {
    if (current !== 'looks') return;
    const edit = e.target.closest('[data-look-edit]');
    if (edit) return lookForm(looksData.find(l => l.id === edit.dataset.lookEdit));
    const st = e.target.closest('[data-look-status]');
    if (st) {
      const l = looksData.find(x => x.id === st.dataset.id);
      const status = st.dataset.lookStatus;
      if (status === 'archived' && !(await confirmDialog({ title: 'Arquivar look?', text: `«${l.name}» sai do carrossel da loja e fica guardado em «Arquivados». Clientes com este look no cesto deixam de o ver.`, confirm: 'Arquivar', danger: true }))) return;
      if (status === 'draft' && l.status === 'published' && !(await confirmDialog({ title: 'Despublicar look?', text: `«${l.name}» deixa de aparecer na loja até voltares a publicá-lo.`, confirm: 'Despublicar' }))) return;
      st.disabled = true;
      const { error } = await client.from('looks').update({ status }).eq('id', l.id);
      if (error) { toast(errText(error), true); st.disabled = false; return; }
      toast({ published: 'Look publicado na loja.', draft: l.status === 'archived' ? 'Look restaurado como rascunho.' : 'Look retirado da loja.', archived: 'Look arquivado.' }[status]);
      return refresh();
    }
    const mv = e.target.closest('[data-look-move]');
    if (mv) {
      const l = looksData.find(x => x.id === mv.dataset.lookMove);
      const list = sameCatActive(l);
      const i = list.indexOf(l);
      const j = i + Number(mv.dataset.dir);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      mv.disabled = true;
      try { await saveOrder('looks', 'id', list); toast('Ordem do carrossel atualizada.'); } catch (err) { toast(err.message, true); }
      refresh();
    }
  });

  function lookForm(l) {
    const isNew = !l;
    let picked = l ? lookPieces(l).map(p => p.sku) : [];
    let newFile = null;
    let transparencyWarning = '';
    const imageSrc = () => (newFile ? URL.createObjectURL(newFile) : l?.image_path ? publicUrl('looks', l.image_path) : null);
    const cats = cache.categories;
    const defaultCat = lookState.cat || cats[0]?.id || '';

    openDrawer({
      wide: true,
      title: isNew ? 'Novo look' : `Editar · ${l.name}`,
      body: `<div class="drawer-cols"><div class="form">
        <div class="grid-2">
          <label>Nome <input type="text" name="name" value="${esc(l?.name)}" maxlength="60" required></label>
          <label>Categoria <select name="category_id">${cats.map(c => `<option value="${esc(c.id)}" ${c.id === (l?.category_id || defaultCat) ? 'selected' : ''}>${esc(c.name)}${c.visible ? '' : ' (escondida)'}</option>`).join('')}</select></label>
        </div>
        <label>Descrição curta <input type="text" name="description" value="${esc(l?.description)}" maxlength="200" placeholder="Malha macia, tons de terra."></label>
        <fieldset><legend>Imagem do modelo</legend>
          <label>Escolher imagem <input type="file" name="image" accept="image/png,image/webp">
            <span class="field-hint">PNG ou WebP com fundo transparente, corpo inteiro, proporção ~2:5, até 5 MB.</span></label>
          <p class="form-status" id="image-warning"></p>
        </fieldset>
        <fieldset><legend>Produtos do look</legend>
          <div class="picked" id="picked"></div>
          <div class="look-total"><span>Preço do conjunto</span><strong id="look-total">—</strong></div>
          <label>Acrescentar produto <input type="search" id="picker-q" placeholder="Pesquisar no catálogo" autocomplete="off"></label>
          <div class="picker-results" id="picker-results"></div>
        </fieldset>
      </div>
      <aside class="preview" aria-label="Pré-visualização">
        <div class="preview-stage" id="preview-stage"></div>
        <div class="preview-info">
          <span class="muted small" id="preview-cat"></span>
          <h3 id="preview-name"></h3>
          <span class="muted" id="preview-desc"></span>
          <strong id="preview-total"></strong>
          <ul class="checklist" id="preview-check"></ul>
          ${isNew ? '' : `<a class="btn small" href="../index.html?preview=${l.id}" target="_blank" rel="noopener">Ver na loja (pré-visualização) ↗</a>`}
        </div>
      </aside></div>`,
      actions: l?.status === 'published'
        ? [{ label: 'Guardar alterações', value: 'keep', primary: true }]
        : [{ label: 'Guardar rascunho', value: 'draft' }, { label: 'Guardar e publicar', value: 'publish', primary: true }],
      onReady: form => {
        const products = () => cache.products.filter(p => p.status !== 'archived');
        const draw = () => {
          const pieces = picked.map(productBySku).filter(Boolean);
          $('picked').innerHTML = pieces.length ? pieces.map((p, i) => `<div class="picked-item">
              ${p.images?.[0] ? `<img class="thumb" src="${esc(p.images[0])}" alt="" style="width:32px;height:38px">` : `<span class="dot" style="background:${esc(p.color_hex || '#ccc')}"></span>`}
              <span class="grow">${esc(p.name)}<small>${esc(KIND[p.kind])} · ${esc(p.color_name)} · ${money(p.price)}${p.status !== 'published' ? ' · <b>não publicado</b>' : ''}</small></span>
              <button class="icon-btn" type="button" data-pick-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
              <button class="icon-btn" type="button" data-pick-move="${i}" data-dir="1" ${i === pieces.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>
              <button class="icon-btn" type="button" data-unpick="${esc(p.sku)}" aria-label="Retirar ${esc(p.name)}">✕</button></div>`).join('')
            : '<span class="muted small">Ainda sem produtos. Pesquisa abaixo para acrescentar.</span>';
          const total = lookPrice(pieces);
          $('look-total').textContent = pieces.length ? money(total) : '—';
          // pré-visualização
          const src = imageSrc();
          $('preview-stage').innerHTML = src ? `<img src="${esc(src)}" alt="">` : emptyHtml('Sem imagem', 'Carrega a imagem do modelo.');
          $('preview-cat').textContent = catName(form.elements.category_id.value);
          $('preview-name').textContent = form.elements.name.value.trim() || 'Sem nome';
          $('preview-desc').textContent = form.elements.description.value.trim();
          $('preview-total').textContent = pieces.length ? `Conjunto completo · ${money(total)}` : '';
          const publishedPieces = pieces.filter(p => p.status === 'published').length;
          $('preview-check').innerHTML = `<li class="${src ? 'ok' : ''}">Imagem do modelo</li>
            <li class="${publishedPieces ? 'ok' : ''}">Pelo menos um produto publicado</li>
            ${pieces.length > publishedPieces ? `<li>${pieces.length - publishedPieces} produto(s) em rascunho não aparecem na loja</li>` : ''}`;
          drawResults();
        };
        const drawResults = () => {
          const q = norm($('picker-q').value);
          const list = products().filter(p => !picked.includes(p.sku) && (!q || norm(`${p.name} ${p.color_name} ${p.sku}`).includes(q))).slice(0, 8);
          $('picker-results').innerHTML = !q && !list.length ? '' : list.length ? list.map(p => `<div class="picker-item">
              <span class="dot" style="background:${esc(p.color_hex || '#ccc')}"></span>
              <span class="grow">${esc(p.name)}<small>${esc(p.color_name)} · ${money(p.price)}${p.status !== 'published' ? ' · rascunho' : ''}</small></span>
              <button class="btn small" type="button" data-pick="${esc(p.sku)}">Acrescentar</button></div>`).join('')
            : '<span class="muted small">Nenhum produto encontrado.</span>';
        };
        draw();
        $('picker-q').oninput = drawResults;
        $('picker-q').onkeydown = e => { if (e.key === 'Enter') e.preventDefault(); };
        form.oninput = e => { if (['name', 'description'].includes(e.target.name)) draw(); };
        form.elements.category_id.onchange = draw;
        $('drawer-body').onclick = e => {
          const add = e.target.closest('[data-pick]');
          const rm = e.target.closest('[data-unpick]');
          const mv = e.target.closest('[data-pick-move]');
          if (add) { if (picked.length >= 20) { setDrawerStatus('Máximo de 20 produtos por look.'); return; } picked.push(add.dataset.pick); }
          if (rm) picked = picked.filter(s => s !== rm.dataset.unpick);
          if (mv) { const i = Number(mv.dataset.pickMove); const j = i + Number(mv.dataset.dir); [picked[i], picked[j]] = [picked[j], picked[i]]; }
          if (add || rm || mv) draw();
        };
        form.elements.image.onchange = async e => {
          const file = e.target.files[0];
          e.target.value = '';
          if (!file) return;
          const bad = checkImage('looks', file);
          const warn = $('image-warning');
          if (bad) { warn.textContent = bad; warn.dataset.tone = 'error'; return; }
          newFile = file;
          transparencyWarning = (await hasTransparency(file)) ? '' : 'Esta imagem não parece ter fundo transparente: no carrossel vai aparecer um retângulo à volta do modelo.';
          warn.textContent = transparencyWarning;
          warn.dataset.tone = 'warn';
          draw();
        };
      },
      onSubmit: async (action, form) => {
        const f = form.elements;
        const name = f.name.value.trim().replace(/\s+/g, ' ');
        if (!name) invalid(form, 'name', 'Indica o nome do look.');
        if (!f.category_id.value) invalid(form, 'category_id', 'Escolhe uma categoria.');
        const wantsPublished = action === 'publish' || (action === 'keep' && l?.status === 'published');
        if (wantsPublished) {
          if (!newFile && !l?.image_path) throw Object.assign(new Error('Para publicar, carrega a imagem do modelo.'), { friendly: true });
          if (!picked.some(sku => productBySku(sku)?.status === 'published')) throw Object.assign(new Error('Para publicar, associa pelo menos um produto publicado.'), { friendly: true });
        }
        let imagePath = l?.image_path || null;
        if (newFile) {
          setDrawerStatus('A carregar a imagem…', 'warn');
          imagePath = await uploadImage('looks', newFile, 'models');
          newFile = null;
          setDrawerStatus('');
        }
        const data = { name, description: f.description.value.trim(), category_id: f.category_id.value, image_path: imagePath };
        let id = l?.id;
        if (!id) {
          const last = looksData.filter(x => x.category_id === data.category_id && x.status !== 'archived').reduce((m, x) => Math.max(m, x.position), 0);
          const row = check(await client.from('looks').insert({ ...data, status: 'draft', position: last + 1 }).select(LOOK_FIELDS).single());
          id = row.id;
          l = row;            // a partir daqui o formulário edita este look
          looksData.push(row);
        } else {
          check(await client.from('looks').update(data).eq('id', id));
        }
        // Produtos: primeiro acrescenta/reordena, depois retira (um look publicado nunca fica vazio)
        if (picked.length) {
          check(await client.from('look_products').upsert(picked.map((sku, i) => ({ look_id: id, product_sku: sku, position: i })), { onConflict: 'look_id,product_sku' }));
          check(await client.from('look_products').delete().eq('look_id', id).not('product_sku', 'in', `(${picked.map(s => `"${s}"`).join(',')})`));
        } else {
          check(await client.from('look_products').delete().eq('look_id', id));
        }
        if (action === 'publish') check(await client.from('looks').update({ status: 'published' }).eq('id', id));
        closeDrawer();
        toast(action === 'publish' ? 'Look publicado na loja.' : 'Look guardado.');
        refresh();
      },
    });
  }

  /* =========================================================
     5. Encomendas
     ========================================================= */
  const orderState = { q: '', payment: '', fulfillment: '', page: 1 };
  const ORDER_PAGE = 20;

  async function renderOrders() {
    const s = orderState;
    content().innerHTML = `
      <div class="note">O <strong>pagamento</strong> só é confirmado pela Stripe (webhook); não pode ser marcado como pago neste painel. Aqui geres a <strong>preparação e o envio</strong>. Só é possível enviar encomendas com pagamento confirmado.</div>
      <section class="panel">
        <div class="toolbar">
          <input type="search" data-q placeholder="N.º, nome ou email do cliente" value="${esc(s.q)}" aria-label="Pesquisar encomendas">
          ${selectHtml('payment', [['', 'Pagamento: todos'], ...Object.entries(PAY).map(([k, [t]]) => [k, t])], s.payment, 'Estado do pagamento')}
          ${selectHtml('fulfillment', [['', 'Envio: todos'], ...Object.entries(FUL).map(([k, [t]]) => [k, t])], s.fulfillment, 'Estado do envio')}
        </div>
        <div id="list">${loadingHtml().replace('class="panel"', '')}</div>
      </section>`;
    listCtl = { state: s, update: drawOrders };
    await drawOrders();
  }

  let orderRequest = 0;
  async function drawOrders() {
    const s = orderState;
    const req = ++orderRequest;
    const { data, error } = await client.rpc('admin_list_orders', {
      p_search: s.q, p_payment: s.payment, p_fulfillment: s.fulfillment,
      p_limit: ORDER_PAGE, p_offset: (s.page - 1) * ORDER_PAGE,
    });
    if (req !== orderRequest || current !== 'orders') return;
    if (error) { $('list').innerHTML = `<div class="state error"><strong>Não foi possível carregar</strong><span>${esc(errText(error))}</span><button class="btn" type="button" data-retry>Tentar de novo</button></div>`; return; }
    const filtered = s.q || s.payment || s.fulfillment;
    $('list').innerHTML = !data.rows.length
      ? emptyHtml(filtered ? 'Nenhuma encomenda corresponde à pesquisa' : 'Ainda não há encomendas', filtered ? 'Muda a pesquisa ou os filtros.' : 'Quando um cliente encomendar, aparece aqui.')
      : `<div class="table-wrap"><table><thead><tr><th>N.º</th><th>Cliente</th><th class="num hide-sm">Artigos</th><th class="num">Total</th><th>Pagamento</th><th>Envio</th><th></th></tr></thead><tbody>
        ${data.rows.map(o => `<tr>
          <td><strong>${o.number}</strong><br><small class="muted">${fmtDate(o.created_at)}</small></td>
          <td>${esc(o.customer)}<br><small class="muted">${esc(o.email || '—')}</small></td>
          <td class="num hide-sm">${o.items_count}</td>
          <td class="num">${money(o.total)}</td>
          <td>${badge(PAY, o.payment_status)}</td>
          <td>${badge(FUL, o.fulfillment_status)}</td>
          <td class="actions"><button class="btn small" type="button" data-order="${o.id}">Ver</button></td></tr>`).join('')}
        </tbody></table></div>${pagerHtml(data.total, s.page, ORDER_PAGE)}`;
  }

  content().addEventListener('click', e => {
    if (current !== 'orders') return;
    const b = e.target.closest('[data-order]');
    if (b) orderDetail(b.dataset.order);
  });

  const NEXT = {
    unfulfilled: [['preparing', 'Iniciar preparação'], ['shipped', 'Marcar como enviada'], ['cancelled', 'Cancelar encomenda']],
    preparing: [['unfulfilled', 'Voltar a «por preparar»'], ['shipped', 'Marcar como enviada'], ['cancelled', 'Cancelar encomenda']],
    shipped: [['delivered', 'Marcar como entregue']],
    delivered: [],
    cancelled: [],
  };

  async function orderDetail(id) {
    openDrawer({ title: 'Encomenda', body: loadingHtml().replace('class="panel"', ''), actions: [] });
    const { data: o, error } = await client.rpc('admin_order_detail', { p_order: id });
    if (error) { $('drawer-body').innerHTML = `<div class="state error"><strong>Não foi possível carregar</strong><span>${esc(errText(error))}</span></div>`; return; }
    const paid = o.payment_status === 'paid';
    const actions = NEXT[o.fulfillment_status].map(([status, label]) => ({
      value: status, label, danger: status === 'cancelled', primary: status !== 'cancelled' && status !== 'unfulfilled',
      disabled: ['shipped', 'delivered'].includes(status) && !paid,
      title: ['shipped', 'delivered'].includes(status) && !paid ? 'Só depois de a Stripe confirmar o pagamento' : '',
    }));
    openDrawer({
      title: `Encomenda n.º ${o.number}`,
      body: `
        <div class="row-actions">${badge(PAY, o.payment_status)} ${badge(FUL, o.fulfillment_status)} <span class="muted small">${fmtDateTime(o.created_at)}</span></div>
        <div class="detail-grid">
          <dl><dt>Cliente</dt><dd>${esc(o.customer || o.ship_name)}</dd><dt>Email</dt><dd>${esc(o.email || '—')}</dd><dt>Telefone</dt><dd>${esc(o.ship_phone)}</dd></dl>
          <dl><dt>Entrega</dt><dd>${esc(o.ship_name)}<br>${esc(o.ship_address)}<br>${esc(o.ship_postal)} ${esc(o.ship_city)}<br>${esc(o.ship_country)}</dd>
            ${o.notes ? `<dt>Notas</dt><dd>${esc(o.notes)}</dd>` : ''}</dl>
        </div>
        <div><h3 style="font-size:14px;margin-bottom:8px">Artigos <span class="muted small">(preços e dados no momento da compra)</span></h3>
        <div class="table-wrap"><table><thead><tr><th>Artigo</th><th>Variante</th><th class="num">Qtd.</th><th class="num">Preço</th><th class="num">Subtotal</th></tr></thead><tbody>
          ${o.items.map(i => `<tr><td>${esc(i.name)}<br><small class="muted">${esc(i.sku)}</small></td><td>${esc(i.color_name)} · ${esc(i.size)}</td>
            <td class="num">${i.qty}</td><td class="num">${money(i.unit_price)}</td><td class="num">${money(i.unit_price * i.qty)}</td></tr>`).join('')}
        </tbody></table></div>
        <dl class="detail-grid" style="margin-top:10px"><div></div><div style="display:grid;gap:4px;font-size:13px">
          <span style="display:flex;justify-content:space-between"><span class="muted">Subtotal</span>${money(o.subtotal)}</span>
          <span style="display:flex;justify-content:space-between"><span class="muted">Portes</span>${Number(o.shipping_cost) ? money(o.shipping_cost) : 'Grátis'}</span>
          <strong style="display:flex;justify-content:space-between"><span>Total</span>${money(o.total)}</strong></div></dl></div>
        <div class="note ${paid ? '' : 'warn'}">${paid
          ? `Pagamento confirmado pela Stripe${o.paid_at ? ` em ${fmtDateTime(o.paid_at)}` : ''}.${o.stripe_payment_intent ? ` Referência: ${esc(o.stripe_payment_intent)}.` : ''}`
          : 'Pagamento ainda não confirmado pela Stripe. Não é possível marcá-lo como pago neste painel; a encomenda não pode ser enviada até a Stripe confirmar. Se a integração da Stripe ainda não estiver configurada, nenhuma encomenda passa a paga.'}</div>
        ${o.fulfillment_status === 'cancelled' ? `<div class="note">Cancelada em ${fmtDateTime(o.cancelled_at)}. O stock das variantes foi reposto.${paid ? ' O reembolso ao cliente faz-se no painel da Stripe.' : ''}</div>` : ''}
        ${o.fulfillment_status === 'delivered' ? `<div class="note">Entregue em ${fmtDateTime(o.delivered_at)}.</div>` : ''}`,
      actions,
      onSubmit: async action => {
        if (action === 'cancelled') {
          const ok = await confirmDialog({
            title: `Cancelar a encomenda n.º ${o.number}?`,
            text: `O stock das variantes compradas é reposto e a encomenda não pode ser reaberta.${paid ? ' O pagamento NÃO é reembolsado automaticamente: faz o reembolso no painel da Stripe.' : ''}`,
            confirm: 'Cancelar encomenda', danger: true,
          });
          if (!ok) return;
        } else if (['shipped', 'delivered'].includes(action)) {
          const ok = await confirmDialog({ title: action === 'shipped' ? 'Marcar como enviada?' : 'Marcar como entregue?', text: 'O cliente vê o novo estado em «As minhas encomendas». Esta alteração não pode ser desfeita.', confirm: 'Confirmar' });
          if (!ok) return;
        }
        check(await client.rpc('admin_set_fulfillment', { p_order: o.id, p_status: action }));
        toast(`Encomenda n.º ${o.number}: ${FUL[action][0].toLowerCase()}.`);
        drawOrders();
        orderDetail(o.id);
      },
    });
  }

  /* =========================================================
     Acesso
     ========================================================= */
  function showGate(view) {
    $('app').hidden = true;
    $('gate').hidden = false;
    ['loading', 'login', 'denied', 'error'].forEach(v => { $(`gate-${v}`).hidden = v !== view; });
  }
  function gateError(text) { $('gate-error-text').textContent = text; showGate('error'); }

  function keyProblem(key) {
    if (/^sb_secret_/i.test(key)) return true;
    const parts = key.split('.');
    if (parts.length === 3) {
      try { return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch { /* não é JWT */ }
    }
    return false;
  }

  // Formulário único: o painel não tem login próprio
  function goToLogin() {
    showGate('login');
    window.location.replace('../index.html?login=admin');
  }

  async function checkAccess() {
    showGate('loading');
    const { data, error } = await client.rpc('is_admin');
    if (error) { gateError(errText(error)); return; }
    if (data !== true) { $('denied-email').textContent = session.user.email; showGate('denied'); return; }
    $('gate').hidden = true;
    $('app').hidden = false;
    $('user-email').textContent = session.user.email;
    go(location.hash.slice(1));
  }

  async function start() {
    if (location.protocol === 'file:') return gateError('Abre o painel através de um servidor (ex.: http://localhost:5500/admin/), não como ficheiro.');
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey || /O-TEU-PROJETO|COLOCA_AQUI/.test(cfg.supabaseUrl + cfg.supabasePublishableKey)) {
      return gateError('Falta o ficheiro config.js com o URL do projeto e a chave publicável do Supabase.');
    }
    if (keyProblem(cfg.supabasePublishableKey)) return gateError('Configuração insegura: o config.js tem uma chave secreta. Usa apenas a chave publicável.');
    if (!window.supabase?.createClient) return gateError('Não foi possível carregar o serviço de autenticação. Verifica a ligação à internet.');

    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
    client.auth.onAuthStateChange((event, s) => {
      session = s;
      if (event === 'SIGNED_OUT') { closeDrawer(); goToLogin(); }
    });
    const { data } = await client.auth.getSession();
    session = data.session;
    if (!session) { goToLogin(); return; }
    await checkAccess();
  }

  const signOut = async () => { await client.auth.signOut(); window.location.assign('../index.html'); };
  $('signout').addEventListener('click', signOut);
  $('denied-signout').addEventListener('click', signOut);

  start().catch(err => { console.error(err); gateError('Não foi possível iniciar o painel. Recarrega a página.'); });
})();
