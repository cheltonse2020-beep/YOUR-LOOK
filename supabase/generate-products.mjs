// Gera supabase/products.sql a partir do catálogo em app.js (TOPS, PANTS, SHOES).
// Correr sempre que mudares peças ou preços em app.js:
//   node supabase/generate-products.mjs
// e depois executar products.sql no SQL Editor do Supabase.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'app.js'), 'utf8');
const dataEnd = src.indexOf('const SIZES');
if (dataEnd === -1) throw new Error('Não encontrei o fim dos dados em app.js (const SIZES).');

const { TOPS, PANTS, SHOES } = vm.runInNewContext(`${src.slice(0, dataEnd)}\n;({ TOPS, PANTS, SHOES })`, {});

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const rows = [];
for (const [kind, catalog] of [['top', TOPS], ['pants', PANTS], ['shoes', SHOES]]) {
  for (const [key, p] of Object.entries(catalog)) {
    if (!/^[A-Za-z0-9]+$/.test(key)) throw new Error(`Chave inválida: ${key}`);
    rows.push(`  (${q(`${kind}:${key}`)}, ${q(kind)}, ${q(p.name)}, ${q(p.colorName)}, ${Number(p.price).toFixed(2)}, true)`);
  }
}

const sql = `-- =====================================================================
-- FORMA — catálogo de produtos (GERADO por supabase/generate-products.mjs)
-- Não editar à mão: altera app.js e volta a gerar.
-- Executar no SQL Editor depois de orders.sql. Pode ser executado várias vezes.
-- =====================================================================
insert into public.products (sku, kind, name, color_name, price, active) values
${rows.join(',\n')}
on conflict (sku) do update
  set kind = excluded.kind, name = excluded.name, color_name = excluded.color_name,
      price = excluded.price, active = true;

-- Peças que deixaram de existir em app.js ficam inativas (as encomendas antigas mantêm-se).
update public.products set active = false
 where sku not in (${rows.map(r => r.match(/^\s*\('([^']+)'/)[1]).map(q).join(', ')});
`;

writeFileSync(join(here, 'products.sql'), sql);
console.log(`products.sql gerado com ${rows.length} produtos.`);
