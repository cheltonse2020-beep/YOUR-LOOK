// =====================================================================
// FORMA — verificação real do isolamento de perfis entre 2 utilizadores
// Usa a API pública do teu projeto (a mesma que o site usa), com a chave
// publicável. Não usa chaves secretas.
//
// Pré-requisitos: schema.sql executado; duas contas de teste JÁ CONFIRMADAS.
// Uso (PowerShell):
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
//   $env:USER_A_EMAIL="..."; $env:USER_A_PASSWORD="..."
//   $env:USER_B_EMAIL="..."; $env:USER_B_PASSWORD="..."
//   node supabase/verify-auth.mjs
// Requer Node 18+ (fetch nativo).
// =====================================================================
const env = name => {
  const v = process.env[name];
  if (!v) { console.error(`Falta a variável de ambiente ${name}`); process.exit(2); }
  return v;
};
const URL_BASE = env('SUPABASE_URL').replace(/\/$/, '');
const KEY = env('SUPABASE_PUBLISHABLE_KEY');
if (/^sb_secret_/.test(KEY)) { console.error('Usa a chave PUBLICÁVEL, não a secreta.'); process.exit(2); }

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✔' : '✘'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function api(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

async function login(email, password) {
  const r = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`Login falhou para ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  return { token: r.json.access_token, id: r.json.user.id, email };
}

const profiles = (token, query = 'select=id,full_name,is_admin') => api(`/rest/v1/profiles?${query}`, { token });

(async () => {
  // 0. Visitante sem sessão
  const anon = await profiles(null);
  check(anon.status >= 400 || (Array.isArray(anon.json) && anon.json.length === 0),
    'Visitante sem sessão não lê perfis', `HTTP ${anon.status}`);

  const A = await login(env('USER_A_EMAIL'), env('USER_A_PASSWORD'));
  const B = await login(env('USER_B_EMAIL'), env('USER_B_PASSWORD'));
  check(A.id !== B.id, 'Duas contas diferentes autenticadas');

  // 1. Cada um vê só o seu perfil
  const aList = await profiles(A.token);
  check(Array.isArray(aList.json) && aList.json.length === 1 && aList.json[0].id === A.id,
    'A vê apenas o próprio perfil', `${aList.json?.length ?? '?'} linha(s)`);
  const bList = await profiles(B.token);
  check(Array.isArray(bList.json) && bList.json.length === 1 && bList.json[0].id === B.id,
    'B vê apenas o próprio perfil', `${bList.json?.length ?? '?'} linha(s)`);
  const bName = bList.json?.[0]?.full_name;
  const aName = aList.json?.[0]?.full_name;

  // 2. A tenta ler o perfil de B pelo id
  const aReadsB = await profiles(A.token, `select=id&id=eq.${B.id}`);
  check(Array.isArray(aReadsB.json) && aReadsB.json.length === 0, 'A não lê o perfil de B pelo id');

  // 3. A tenta alterar o nome de B
  const aEditsB = await api(`/rest/v1/profiles?id=eq.${B.id}`, {
    method: 'PATCH', token: A.token, body: { full_name: 'Alterado por A' }, prefer: 'return=representation',
  });
  check(Array.isArray(aEditsB.json) && aEditsB.json.length === 0, 'A não altera o perfil de B', `HTTP ${aEditsB.status}`);
  const bAfter = await profiles(B.token);
  check(bAfter.json?.[0]?.full_name === bName, 'Nome de B continua intacto');

  // 4. A tenta tornar-se administradora
  const aAdmin = await api(`/rest/v1/profiles?id=eq.${A.id}`, {
    method: 'PATCH', token: A.token, body: { is_admin: true }, prefer: 'return=representation',
  });
  check(aAdmin.status >= 400, 'A não consegue definir is_admin', `HTTP ${aAdmin.status}`);
  const aAfterAdmin = await profiles(A.token);
  check(aAfterAdmin.json?.[0]?.is_admin === false, 'is_admin de A continua false');

  // 5. A edita o próprio nome (e repõe)
  const aEditSelf = await api(`/rest/v1/profiles?id=eq.${A.id}`, {
    method: 'PATCH', token: A.token, body: { full_name: 'Teste de edição' }, prefer: 'return=representation',
  });
  check(aEditSelf.json?.[0]?.full_name === 'Teste de edição', 'A edita o próprio nome');
  await api(`/rest/v1/profiles?id=eq.${A.id}`, { method: 'PATCH', token: A.token, body: { full_name: aName } });

  // 6. Inserir e apagar perfis não é permitido
  const ins = await api('/rest/v1/profiles', { method: 'POST', token: A.token, body: { id: B.id, full_name: 'x' } });
  check(ins.status >= 400, 'A não insere perfis', `HTTP ${ins.status}`);
  const del = await api(`/rest/v1/profiles?id=eq.${B.id}`, { method: 'DELETE', token: A.token, prefer: 'return=representation' });
  check(del.status >= 400 || (Array.isArray(del.json) && del.json.length === 0), 'A não apaga o perfil de B', `HTTP ${del.status}`);

  console.log(failures ? `\n${failures} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
  process.exit(failures ? 1 : 0);
})().catch(err => { console.error(err.message); process.exit(1); });
