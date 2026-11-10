'use strict';

/* =========================================================
   FORMA — autenticação com Supabase Auth
   - Registo (nome, email, palavra-passe) + confirmação por email
   - Entrar com email/palavra-passe ou Google
   - Recuperar / redefinir palavra-passe
   - Terminar sessão, restauro da sessão ao recarregar
   - "A minha conta": consultar e editar o nome (tabela profiles, RLS)
   O resto do site (categorias, carrossel, produtos) funciona sem sessão.
   ========================================================= */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.FORMA_CONFIG || {};
  const MIN_PASSWORD = 8;

  // URL capturado antes de o Supabase limpar ?code= / #error=
  const startUrl = new URL(window.location.href);
  const cameFromAuthRedirect = startUrl.searchParams.has('code');
  // ?login=1 (ou =admin): abrir o formulário de entrada (o painel /admin/ envia para aqui)
  const loginRequested = startUrl.searchParams.has('login');
  let loginFromCheckout = false;   // entrar para concluir uma encomenda: fica na loja

  /* ---------- Estado ---------- */
  let client = null;
  let session = null;
  let profile = null;
  let setupProblem = null;   // texto a mostrar se a autenticação não puder arrancar

  /* ---------- Configuração e segurança da chave ---------- */
  function isForbiddenKey(key) {
    if (/^sb_secret_/i.test(key)) return true;
    // Chaves antigas (JWT): recusar a service_role
    const parts = key.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.role === 'service_role') return true;
      } catch { /* não é JWT legível */ }
    }
    return false;
  }

  function redirectUrl() {
    if (cfg.redirectUrl) return cfg.redirectUrl;
    return window.location.origin + window.location.pathname;
  }

  function createAuthClient() {
    if (window.location.protocol === 'file:') {
      return 'Para iniciar sessão, abre o site através de um servidor local (ex.: http://localhost:5500), não diretamente como ficheiro.';
    }
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey || /O-TEU-PROJETO|COLOCA_AQUI/.test(cfg.supabaseUrl + cfg.supabasePublishableKey)) {
      return 'O início de sessão ainda não está configurado. Falta o ficheiro config.js com o URL do projeto e a chave publicável do Supabase (ver config.example.js).';
    }
    if (isForbiddenKey(cfg.supabasePublishableKey)) {
      console.error('[FORMA] config.js contém uma chave SECRETA. Usa apenas a chave publicável (sb_publishable_...). Roda a chave secreta no painel do Supabase.');
      return 'Configuração insegura: foi indicada uma chave secreta. Usa apenas a chave publicável.';
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      return 'Não foi possível carregar o serviço de autenticação. Verifica a ligação à internet e recarrega a página.';
    }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth: {
        flowType: 'pkce',          // códigos trocados no próprio browser (mais seguro que tokens no URL)
        detectSessionInUrl: true,  // troca automaticamente ?code= após confirmação / Google / recuperação
        persistSession: true,      // restaura a sessão ao recarregar
        autoRefreshToken: true,
      },
    });
    return null;
  }

  /* ---------- Mensagens de erro em português ---------- */
  const ERROR_TEXT = {
    invalid_credentials: 'Email ou palavra-passe incorretos.',
    email_not_confirmed: 'Ainda não confirmaste o teu email. Abre o link que te enviámos (verifica também o spam).',
    user_already_exists: 'Já existe uma conta com este email. Entra ou recupera a palavra-passe.',
    email_exists: 'Já existe uma conta com este email. Entra ou recupera a palavra-passe.',
    weak_password: `A palavra-passe é demasiado fraca. Usa pelo menos ${MIN_PASSWORD} caracteres, misturando letras e números.`,
    same_password: 'A nova palavra-passe tem de ser diferente da atual.',
    over_email_send_rate_limit: 'Enviámos demasiados emails para este endereço. Espera alguns minutos e tenta de novo.',
    over_request_rate_limit: 'Demasiadas tentativas seguidas. Espera um pouco e tenta de novo.',
    email_address_invalid: 'Este endereço de email não é aceite. Usa outro email.',
    signup_disabled: 'O registo de novas contas está desativado.',
    email_provider_disabled: 'O registo com email está desativado.',
    otp_expired: 'O link expirou ou já foi usado. Pede um novo.',
    flow_state_expired: 'O link expirou. Volta a tentar.',
    flow_state_not_found: 'Não foi possível concluir o início de sessão neste browser. Abre o link no mesmo browser onde o pediste, ou entra novamente.',
    bad_code_verifier: 'Não foi possível concluir o início de sessão neste browser. Abre o link no mesmo browser onde o pediste, ou entra novamente.',
    session_not_found: 'A tua sessão terminou. Entra novamente.',
    refresh_token_not_found: 'A tua sessão terminou. Entra novamente.',
    provider_disabled: 'Este método de início de sessão não está ativo.',
    validation_failed: 'Verifica os dados introduzidos.',
  };

  function ptError(error) {
    if (!error) return 'Ocorreu um erro inesperado. Tenta de novo.';
    if (error.code && ERROR_TEXT[error.code]) return ERROR_TEXT[error.code];
    const msg = String(error.message || '');
    if (error.status === 429) return ERROR_TEXT.over_request_rate_limit;
    if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem ligação ao servidor. Verifica a internet e tenta de novo.';
    if (/invalid login credentials/i.test(msg)) return ERROR_TEXT.invalid_credentials;
    if (/email not confirmed/i.test(msg)) return ERROR_TEXT.email_not_confirmed;
    if (/already registered/i.test(msg)) return ERROR_TEXT.user_already_exists;
    if (/password should be/i.test(msg)) return ERROR_TEXT.weak_password;
    if (/row-level security|permission denied/i.test(msg)) return 'Não tens permissão para esta operação.';
    console.warn('[FORMA] Erro de autenticação sem tradução:', error);
    return 'Ocorreu um erro. Tenta de novo dentro de momentos.';
  }

  /* ---------- Diálogo: vistas, estados de carregamento ---------- */
  const dialog = $('auth');
  const VIEWS = ['login', 'signup', 'forgot', 'reset', 'account', 'notice'];

  function showView(view) {
    VIEWS.forEach(v => { $(`auth-${v}`).hidden = v !== view; });
    dialog.dataset.view = view;
    clearStatus();
    if (!dialog.open) dialog.showModal();
    const first = $(`auth-${view}`).querySelector('input:not([readonly]), button.primary');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }

  function notice(title, text, { tone = 'info', action = null } = {}) {
    $('auth-notice-title').textContent = title;
    $('auth-notice-text').textContent = text;
    $('auth-notice').dataset.tone = tone;
    const btn = $('auth-notice-action');
    btn.hidden = !action;
    if (action) {
      btn.textContent = action.label;
      btn.onclick = action.run;
    }
    showView('notice');
  }

  function setStatus(form, text, tone = 'error') {
    const el = form.querySelector('.form-status');
    el.textContent = text;
    el.dataset.tone = tone;
  }
  function clearStatus() {
    dialog.querySelectorAll('.form-status').forEach(el => { el.textContent = ''; delete el.dataset.tone; });
    dialog.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  }

  async function withLoading(button, label, task) {
    const form = button.closest('form') || dialog;
    const original = button.innerHTML;
    const controls = form.querySelectorAll('input, button');
    controls.forEach(c => { c.disabled = true; });
    button.classList.add('loading');
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label}`;
    form.setAttribute('aria-busy', 'true');
    try {
      return await task();
    } finally {
      controls.forEach(c => { c.disabled = false; });
      button.classList.remove('loading');
      button.innerHTML = original;
      form.removeAttribute('aria-busy');
    }
  }

  function invalid(form, input, text) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    setStatus(form, text);
    return false;
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------- Cabeçalho: "Entrar" / nome + menu ---------- */
  function displayName() {
    if (!session) return '';
    const meta = session.user.user_metadata || {};
    return (profile?.full_name || meta.full_name || meta.name || session.user.email.split('@')[0] || '').trim();
  }

  function renderHeader() {
    const signedIn = Boolean(session);
    $('auth-open').hidden = signedIn;
    $('user-menu').hidden = !signedIn;
    document.body.classList.remove('auth-pending');
    if (signedIn) {
      const name = displayName();
      $('user-name').textContent = name;
      $('user-initial').textContent = (name[0] || '?').toUpperCase();
      $('user-button').setAttribute('aria-label', `Conta de ${name}`);
      $('menu-admin').hidden = profile?.is_admin !== true;
    } else {
      closeMenu();
    }
  }

  function openMenu() {
    $('user-dropdown').hidden = false;
    $('user-button').setAttribute('aria-expanded', 'true');
    $('user-dropdown').querySelector('[role="menuitem"]').focus();
  }
  function closeMenu() {
    $('user-dropdown').hidden = true;
    $('user-button').setAttribute('aria-expanded', 'false');
  }

  /* ---------- Perfil (tabela profiles, protegida por RLS) ---------- */
  async function loadProfile() {
    if (!client || !session) { profile = null; return null; }
    const { data, error } = await client
      .from('profiles')
      .select('full_name, created_at, is_admin')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) {
      console.warn('[FORMA] Não foi possível ler o perfil:', error);
      profile = null;
      return { error };
    }
    profile = data;   // null se o SQL ainda não foi executado
    renderHeader();
    return { data };
  }

  async function openAccount() {
    closeMenu();
    if (!session) { showView('login'); return; }
    $('account-email').value = session.user.email;
    $('account-name').value = displayName();
    $('account-since').textContent = new Date(session.user.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
    $('account-google').hidden = !(session.user.app_metadata?.providers || []).includes('google');
    showView('account');
    const form = $('auth-account');
    form.setAttribute('aria-busy', 'true');
    const result = await loadProfile();
    form.removeAttribute('aria-busy');
    if (result?.error) {
      setStatus(form, 'Não foi possível carregar o teu perfil. Tenta de novo mais tarde.');
    } else if (!result?.data) {
      setStatus(form, 'O teu perfil ainda não existe na base de dados (falta executar supabase/schema.sql).');
    } else {
      $('account-name').value = profile.full_name || displayName();
    }
  }

  /* ---------- Ações ---------- */
  async function signIn(e) {
    e.preventDefault();
    const form = e.currentTarget;
    clearStatus();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!EMAIL_RE.test(email)) return invalid(form, form.email, 'Indica um email válido.');
    if (!password) return invalid(form, form.password, 'Indica a palavra-passe.');

    await withLoading(form.querySelector('button.primary'), 'A entrar…', async () => {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(form, ptError(error));
        if (error.code === 'email_not_confirmed') showResend(form, email);
        return;
      }
      form.reset();
      dialog.close();
      await routeAfterLogin();
    });
  }

  /* ---------- Depois de entrar: administrador → /admin/, cliente → loja ----------
     A decisão é do servidor: is_admin() lê profiles.is_admin pelo ID do utilizador
     autenticado (campo que o cliente não pode alterar). Não se compara o email aqui.
     Isto é só encaminhamento; o painel e os dados estão protegidos por RLS. */
  async function routeAfterLogin() {
    let fromCheckout = loginFromCheckout;
    loginFromCheckout = false;
    try { fromCheckout = fromCheckout || sessionStorage.getItem('forma-resume-checkout') === '1'; } catch { /* ignorar */ }
    if (fromCheckout || !client) return false;   // a meio de uma encomenda: continua na loja
    const { data, error } = await client.rpc('is_admin');
    if (!error && data === true) {
      toast('Sessão iniciada. A abrir o painel de administração…');
      window.location.assign(new URL('admin/', window.location.href).href);
      return true;
    }
    return false;   // cliente (ou painel ainda não configurado): área normal da loja
  }

  function showResend(form, email) {
    const status = form.querySelector('.form-status');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'link-inline';
    btn.textContent = 'Reenviar email de confirmação';
    btn.onclick = async () => {
      btn.disabled = true;
      const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectUrl() } });
      setStatus(form, error ? ptError(error) : `Enviámos um novo email de confirmação para ${email}.`, error ? 'error' : 'ok');
    };
    status.append(' ', btn);
  }

  async function signUp(e) {
    e.preventDefault();
    const form = e.currentTarget;
    clearStatus();
    const name = form.elements.fullname.value.trim().replace(/\s+/g, ' ');
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.confirm.value;
    if (name.length < 2) return invalid(form, form.elements.fullname, 'Indica o teu nome (pelo menos 2 caracteres).');
    if (name.length > 80) return invalid(form, form.elements.fullname, 'O nome pode ter no máximo 80 caracteres.');
    if (!EMAIL_RE.test(email)) return invalid(form, form.email, 'Indica um email válido.');
    if (password.length < MIN_PASSWORD) return invalid(form, form.password, `A palavra-passe tem de ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (password !== confirm) return invalid(form, form.confirm, 'As palavras-passe não coincidem.');

    await withLoading(form.querySelector('button.primary'), 'A criar conta…', async () => {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: redirectUrl() },
      });
      if (error) { setStatus(form, ptError(error)); return; }
      form.reset();
      if (data.session) {           // confirmação de email desativada no projeto
        dialog.close();
        return;
      }
      // Com confirmação ativa, um email já registado devolve um utilizador "ofuscado" sem identidades.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        notice('Este email já tem conta', 'Se a conta é tua, entra com a tua palavra-passe ou recupera-a.', {
          action: { label: 'Entrar', run: () => showView('login') },
        });
        return;
      }
      notice('Confirma o teu email',
        `Enviámos um link de confirmação para ${email}. Abre-o neste browser para ativares a conta. Se não o encontrares, verifica a pasta de spam.`,
        { tone: 'ok' });
    });
  }

  /* Fornecedores ativos no projeto (GET /auth/v1/settings, público com a chave publicável).
     Evita mandar o utilizador para uma página de erro do Supabase se o Google ainda não estiver ativo. */
  let providersPromise = null;
  function enabledProviders() {
    if (!providersPromise) {
      providersPromise = fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, {
        headers: { apikey: cfg.supabasePublishableKey },
      })
        .then(r => (r.ok ? r.json() : null))
        .then(s => s?.external || null)
        .catch(() => null);   // sem resposta: não escondemos nada, o clique trata do erro
    }
    return providersPromise;
  }

  async function applyProviderVisibility() {
    const external = await enabledProviders();
    const googleOn = !external || external.google === true;
    dialog.querySelectorAll('.google-btn, .google-btn + .divider').forEach(el => { el.hidden = !googleOn; });
  }

  async function signInWithGoogle(e) {
    const button = e.currentTarget;
    clearStatus();
    const external = await enabledProviders();
    if (external && external.google !== true) {
      setStatus(button.closest('form'), 'O início de sessão com Google ainda não está disponível. Usa o email e a palavra-passe.');
      return;
    }
    await withLoading(button, 'A abrir Google…', async () => {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl() },
      });
      // Em caso de sucesso o browser é redirecionado para a Google.
      if (error) setStatus(button.closest('form'), ptError(error));
    });
  }

  async function sendReset(e) {
    e.preventDefault();
    const form = e.currentTarget;
    clearStatus();
    const email = form.email.value.trim();
    if (!EMAIL_RE.test(email)) return invalid(form, form.email, 'Indica um email válido.');
    await withLoading(form.querySelector('button.primary'), 'A enviar…', async () => {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
      if (error) { setStatus(form, ptError(error)); return; }
      form.reset();
      // Não revelamos se o email existe ou não.
      notice('Verifica o teu email',
        `Se existir uma conta com ${email}, vais receber um link para definir uma nova palavra-passe. Abre-o neste browser.`,
        { tone: 'ok' });
    });
  }

  async function saveNewPassword(e) {
    e.preventDefault();
    const form = e.currentTarget;
    clearStatus();
    const password = form.password.value;
    if (password.length < MIN_PASSWORD) return invalid(form, form.password, `A palavra-passe tem de ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (password !== form.confirm.value) return invalid(form, form.confirm, 'As palavras-passe não coincidem.');
    if (!session) { setStatus(form, 'O link de recuperação expirou. Pede um novo.'); return; }
    await withLoading(form.querySelector('button.primary'), 'A guardar…', async () => {
      const { error } = await client.auth.updateUser({ password });
      if (error) { setStatus(form, ptError(error)); return; }
      form.reset();
      notice('Palavra-passe atualizada', 'A tua nova palavra-passe foi guardada. Já tens sessão iniciada.', { tone: 'ok' });
    });
  }

  async function saveAccount(e) {
    e.preventDefault();
    const form = e.currentTarget;
    clearStatus();
    const name = form.elements.fullname.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return invalid(form, form.elements.fullname, 'Indica o teu nome (pelo menos 2 caracteres).');
    if (name.length > 80) return invalid(form, form.elements.fullname, 'O nome pode ter no máximo 80 caracteres.');
    await withLoading(form.querySelector('button.primary'), 'A guardar…', async () => {
      const { data, error } = await client
        .from('profiles')
        .update({ full_name: name })
        .eq('id', session.user.id)
        .select('full_name, created_at')
        .maybeSingle();
      if (error) { setStatus(form, ptError(error)); return; }
      if (!data) { setStatus(form, 'Não foi possível guardar: perfil não encontrado.'); return; }
      profile = data;
      renderHeader();
      form.elements.fullname.value = data.full_name;
      setStatus(form, 'Nome atualizado.', 'ok');
    });
  }

  async function signOut() {
    closeMenu();
    const { error } = await client.auth.signOut();
    if (error) {
      notice('Não foi possível terminar a sessão', ptError(error), { tone: 'error' });
      return;
    }
    if (dialog.open) dialog.close();
    toast('Sessão terminada.');
  }

  function toast(text) {
    const el = $('message');
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('visible'), 2800);
  }

  /* ---------- Erros devolvidos no redirecionamento (#error=... ou ?error=...) ---------- */
  function readRedirectError() {
    const hash = new URLSearchParams(startUrl.hash.slice(1));
    const query = startUrl.searchParams;
    const get = k => hash.get(k) || query.get(k);
    if (!get('error') && !get('error_code')) return null;
    return { code: get('error_code') || get('error'), message: get('error_description') || '' };
  }

  function cleanAuthParams() {
    const url = new URL(window.location.href);
    let changed = false;
    ['code', 'error', 'error_code', 'error_description', 'type'].forEach(k => {
      if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; }
    });
    if (/(^|&)(error|access_token|error_code)=/.test(url.hash.slice(1))) { url.hash = ''; changed = true; }
    if (changed) history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  /* ---------- Arranque ---------- */
  function wireUi() {
    $('auth-open').addEventListener('click', () => {
      if (setupProblem) notice('Iniciar sessão', setupProblem, { tone: 'error' });
      else showView('login');
    });
    $('user-button').addEventListener('click', () => ($('user-dropdown').hidden ? openMenu() : closeMenu()));
    document.addEventListener('click', e => { if (!$('user-menu').contains(e.target)) closeMenu(); });
    $('user-menu').addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeMenu(); $('user-button').focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...$('user-dropdown').querySelectorAll('[role="menuitem"]')];
        const i = items.indexOf(document.activeElement);
        if (i !== -1) { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
      }
    });
    $('menu-account').addEventListener('click', openAccount);
    $('menu-signout').addEventListener('click', signOut);
    $('account-signout').addEventListener('click', signOut);

    dialog.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.goto === 'reset' && !session) { showView('forgot'); return; }
      showView(b.dataset.goto);
    }));
    $('auth-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.querySelectorAll('.show-password').forEach(b => b.addEventListener('click', () => {
      const input = b.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Ocultar' : 'Mostrar';
      b.setAttribute('aria-pressed', show);
    }));

    if (!client) return;
    $('auth-login').addEventListener('submit', signIn);
    $('auth-signup').addEventListener('submit', signUp);
    $('auth-forgot').addEventListener('submit', sendReset);
    $('auth-reset').addEventListener('submit', saveNewPassword);
    $('auth-account').addEventListener('submit', saveAccount);
    dialog.querySelectorAll('.google-btn').forEach(b => b.addEventListener('click', signInWithGoogle));
  }

  async function start() {
    setupProblem = createAuthClient();
    wireUi();
    if (!client) {
      renderHeader();
      if (setupProblem && !/não está configurado|servidor local/.test(setupProblem)) console.warn('[FORMA]', setupProblem);
      return;
    }

    const redirectError = readRedirectError();
    let recovering = false;
    applyProviderVisibility();

    client.auth.onAuthStateChange((event, newSession) => {
      session = newSession;
      renderHeader();
      // Não chamar outros métodos do Supabase dentro deste callback: adiar com setTimeout.
      if (event === 'PASSWORD_RECOVERY') {
        recovering = true;
        setTimeout(() => showView('reset'), 0);
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (newSession) setTimeout(loadProfile, 0);
      }
      if (event === 'SIGNED_OUT') profile = null;
      document.dispatchEvent(new CustomEvent('forma:auth', { detail: { event, session: newSession } }));
    });

    // Espera que o cliente restaure a sessão guardada e troque o ?code= (se houver)
    const { data, error } = await client.auth.getSession();
    session = data.session;
    renderHeader();
    cleanAuthParams();

    if (redirectError) {
      notice('Não foi possível concluir', ERROR_TEXT[redirectError.code] || redirectError.message || 'O link é inválido ou expirou.', {
        tone: 'error',
        action: { label: 'Pedir novo link', run: () => showView('forgot') },
      });
    } else if (error && cameFromAuthRedirect) {
      notice('Não foi possível concluir', ptError(error), { tone: 'error', action: { label: 'Entrar', run: () => showView('login') } });
    } else if (cameFromAuthRedirect && session && !recovering) {
      if (!(await routeAfterLogin())) toast(`Sessão iniciada. Olá, ${displayName()}!`);
    }

    if (loginRequested) {
      const url = new URL(window.location.href);
      url.searchParams.delete('login');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      if (session) {
        if (!(await routeAfterLogin())) toast('Já tens sessão iniciada.');
      } else {
        showView('login');
        setStatus($('auth-login'), 'Entra com a tua conta. Se for de administrador, abres o painel.', 'info');
      }
    }
  }

  /* API para outras partes do site (checkout.js) */
  window.FORMA_AUTH = {
    get client() { return client; },
    get session() { return session; },
    get profileName() { return displayName(); },
    get problem() { return setupProblem; },
    // Abre o "Entrar" com uma explicação (ex.: para continuar a encomenda)
    openLogin(message) {
      if (setupProblem) { notice('Iniciar sessão', setupProblem, { tone: 'error' }); return; }
      loginFromCheckout = true;
      showView('login');
      if (message) setStatus($('auth-login'), message, 'info');
    },
    errorText: ptError,
  };

  document.body.classList.add('auth-pending');
  start().catch(err => {
    console.error('[FORMA] Falha ao iniciar a autenticação:', err);
    setupProblem = 'Não foi possível iniciar o serviço de autenticação. Recarrega a página.';
    renderHeader();
  });
})();
