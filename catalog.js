'use strict';

/* =========================================================
   YOUR LOOK — catálogo vindo do Supabase (painel de administração)
   Lê as categorias e os looks PUBLICADOS e junta-os ao carrossel.
   ?preview=<id> mostra um look em rascunho — só funciona com sessão de
   administrador, porque o RLS esconde rascunhos a toda a gente.
   Se o Supabase não estiver configurado ou falhar, a loja continua igual.
   ========================================================= */
(async () => {
  const auth = window.FORMA_AUTH;
  const cfg = window.FORMA_CONFIG;
  const store = window.FORMA_STORE;
  if (!store) return;
  if (!auth?.client || !cfg?.supabaseUrl) { store.applyRemote(); return; }   // sem Supabase: loja vazia
  const client = auth.client;

  const base = cfg.supabaseUrl.replace(/\/$/, '');
  const publicUrl = path => `${base}/storage/v1/object/public/looks/${path.split('/').map(encodeURIComponent).join('/')}`;
  const params = new URLSearchParams(location.search);
  const previewId = /^[0-9a-f-]{36}$/i.test(params.get('preview') || '') ? params.get('preview') : null;

  const LOOK_FIELDS = 'id, name, description, category_id, image_path, position, status, ' +
    'look_products(position, products(sku, kind, style, name, color_name, color_hex, price, images, status))';

  const toPiece = p => ({
    sku: p.sku,
    kind: p.kind,
    style: p.style,
    name: p.name,
    colorName: p.color_name,
    color: p.color_hex || '#9aa0a6',
    price: Number(p.price),
    image: (p.images || [])[0] || null,
  });

  const toLook = (row, preview = false) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category_id: row.category_id,
    position: row.position,
    preview,
    image: row.image_path ? publicUrl(row.image_path) : null,
    pieces: (row.look_products || [])
      .filter(lp => lp.products && (preview || lp.products.status === 'published'))
      .sort((a, b) => a.position - b.position)
      .map(lp => toPiece(lp.products)),
  });

  try {
    await client.auth.getSession();   // garante que a sessão (se houver) já foi restaurada
    const [cats, looks] = await Promise.all([
      client.from('categories').select('id, name, description, position, visible').order('position'),
      client.from('looks').select(LOOK_FIELDS).eq('status', 'published').order('position'),
    ]);
    if (cats.error) throw cats.error;
    if (looks.error) throw looks.error;

    let rows = looks.data.map(r => toLook(r));
    let previewName = null;
    if (previewId) {
      const { data } = await client.from('looks').select(LOOK_FIELDS).eq('id', previewId).maybeSingle();
      if (data) {
        rows = rows.filter(r => r.id !== previewId);
        const look = toLook(data, true);
        if (look.image && look.pieces.length) {
          rows.push(look);
          previewName = data.status === 'published' ? null : data.name;
        }
      } else {
        console.warn('[FORMA] Pré-visualização indisponível: inicia sessão como administrador.');
      }
    }

    store.applyRemote({
      categories: cats.data,
      looks: rows.filter(r => r.image && r.pieces.length),
      preview: previewName,
    });
  } catch (err) {
    // Tabelas ainda não criadas (admin.sql por executar) ou sem ligação
    console.warn('[FORMA] Catálogo do Supabase indisponível.', err?.message || err);
    store.applyRemote();
  }
})();
