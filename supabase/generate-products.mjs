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
const looks = [];
for (const [kind, catalog] of [['top', TOPS], ['pants', PANTS], ['shoes', SHOES]]) {
  for (const [key, p] of Object.entries(catalog)) {
    if (!/^[A-Za-z0-9]+$/.test(key)) throw new Error(`Chave inválida: ${key}`);
    const sku = `${kind}:${key}`;
    rows.push(`  (${q(sku)}, ${q(kind)}, ${q(p.name)}, ${q(p.colorName)}, ${Number(p.price).toFixed(2)}, true)`);
    looks.push(`      (${q(sku)}, ${q(p.color)}, ${p.style ? q(p.style) : 'null'})`);
  }
}

const sql = `-- =====================================================================
-- FORMA — catálogo inicial de produtos (GERADO por supabase/generate-products.mjs)
-- Não editar à mão. Executar no SQL Editor depois de orders.sql (e de novo após admin.sql).
-- Só ACRESCENTA produtos que ainda não existem: nunca altera preços, nomes ou
-- estados definidos no painel de administração.
-- =====================================================================
insert into public.products (sku, kind, name, color_name, price, active) values
${rows.join(',\n')}
on conflict (sku) do nothing;

-- Cor e forma usadas nos ícones da loja (só preenche se estiverem vazias; requer admin.sql)
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'products' and column_name = 'color_hex') then
    update public.products p
       set color_hex = coalesce(p.color_hex, v.color_hex),
           style = coalesce(p.style, v.style)
      from (values
${looks.join(',\n')}
      ) as v(sku, color_hex, style)
     where p.sku = v.sku and (p.color_hex is null or p.style is null);
  end if;
end $$;
`;

writeFileSync(join(here, 'products.sql'), sql);
console.log(`products.sql gerado com ${rows.length} produtos.`);
