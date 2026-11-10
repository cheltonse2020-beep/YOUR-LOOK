// =====================================================================
// YOUR LOOK — configuração do Supabase (exemplo)
//
// 1. Copia este ficheiro para "config.js" (na mesma pasta).
// 2. Substitui os valores pelos do teu projeto:
//    Supabase → Project Settings → API Keys (ou botão "Connect").
//
// Usa APENAS a chave publicável (sb_publishable_...) — é pública por natureza
// e a segurança dos dados vem das políticas RLS (supabase/schema.sql).
// NUNCA coloques aqui a chave secreta (sb_secret_...) nem a service_role:
// o site recusa-se a arrancar a autenticação se detetar uma delas.
// =====================================================================
window.FORMA_CONFIG = {
  supabaseUrl: 'https://O-TEU-PROJETO.supabase.co',
  supabasePublishableKey: 'sb_publishable_COLOCA_AQUI_A_TUA_CHAVE',

  // Stripe: chave PUBLICÁVEL (pk_test_... / pk_live_...) para abrir o pagamento
  // numa janela dentro do site. A chave secreta (sk_...) vai só para os Secrets
  // das Edge Functions do Supabase, nunca para aqui.
  stripePublishableKey: 'pk_test_COLOCA_AQUI_A_TUA_CHAVE',

  // Opcional: URL para onde o Supabase redireciona depois de confirmar o
  // email, entrar com Google ou recuperar a palavra-passe. Por omissão é a
  // página atual (ex.: http://localhost:5500/index.html). Tem de constar em
  // Authentication → URL Configuration → Redirect URLs.
  // redirectUrl: 'https://www.o-teu-dominio.pt/',
};
