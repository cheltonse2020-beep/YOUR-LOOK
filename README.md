# YOUR LOOK — Experimenta o look

Protótipo estático: fila de 5 conjuntos com profundidade (o central em foco, os laterais mais pequenos e desfocados), categorias, pontos sobre as peças na vista ampliada, painel "Neste look", cesto local e contas de utilizador com Supabase.

## Abrir
Para explorar o catálogo basta abrir `index.html`. Para **iniciar sessão** o site tem de ser servido por HTTP (o Supabase não redireciona para `file://`):
- VS Code → extensão **Live Server** → "Go Live" (abre em `http://127.0.0.1:5500`), ou
- na pasta do projeto: `python -m http.server 5500` e abrir `http://localhost:5500/index.html`.

Não precisa de npm nem de compilação.

## Ficheiros
- `index.html` — estrutura e textos fixos (inclui os gradientes SVG partilhados `#shade` e `#floor`).
- `style.css` — cores (variáveis em `:root`), disposição, animações e telemóvel.
- `app.js` — categorias iniciais, carrossel, pontos, ficha da peça e cesto (os looks vêm do painel).
- `auth.js` — autenticação (Supabase Auth) e "A minha conta".
- `checkout.js` — "Prosseguir com a encomenda", entrega, confirmação e "As minhas encomendas".
- `catalog.js` — carrega as categorias e os looks publicados no painel (Supabase).
- `admin/` — painel de administração (`/admin/`): `index.html`, `admin.css`, `admin.js`.
- `supabase/admin.sql` — migração do painel (categorias, looks, variantes/stock, estados de pagamento e envio, funções `admin_*`, RLS e Storage).
- `supabase/test-admin.sql` — teste de permissões, stock, publicação e envios (faz rollback).
- `supabase/first-admin.sql` — atribui o primeiro administrador a partir do email de uma conta existente.
- `config.example.js` — modelo de configuração; copiar para `config.js` (ignorado pelo git).
- `supabase/schema.sql` — tabela `profiles`, trigger de criação automática, RLS e proteção de `is_admin`.
- `supabase/test-rls.sql` — teste de isolamento entre dois utilizadores (corre e faz rollback).
- `supabase/verify-auth.mjs` — verificação real, pela API, com duas contas de teste.
- `supabase/orders.sql` — catálogo de preços, encomendas, linhas, RLS e função `place_order`.
- `supabase/products.sql` — 68 produtos de demonstração (usados pelos testes SQL).
- `supabase/archive-demo-products.sql` — esconde (arquiva, sem apagar) esses produtos de demonstração.
- `supabase/test-orders.sql` — teste das encomendas (preços no servidor, validação, isolamento; faz rollback).
- `supabase/payments.sql` — campos de pagamento Stripe nas encomendas.
- `supabase/functions/create-checkout` — Edge Function que cria o pagamento Stripe de uma encomenda do cliente.
- `supabase/functions/stripe-webhook` — Edge Function que recebe a confirmação da Stripe e marca a encomenda como paga.
- `supabase/config.toml` — configuração das funções (sem verificação de JWT no gateway; ver abaixo).

## Os looks (modelos)
A loja já não traz looks de demonstração: o carrossel mostra **só os looks publicados no painel** (`/admin/` → *Looks e carrossel*). Enquanto não houver nenhum, aparece "Coleção em preparação"; numa categoria sem looks, "Ainda sem looks nesta categoria".

Para adicionar um modelo real:
1. **Produtos** → criar cada peça (nome, tipo, cor, preço, fotografia, tamanhos/stock) e publicá-la.
2. **Looks e carrossel** → criar o look: nome, categoria, descrição, **fotografia do modelo** e as peças.
3. **Pré-visualizar** e depois **Publicar**. O look aparece logo na loja, pela ordem definida.

Fotografia do modelo: PNG ou WebP **com fundo transparente**, de corpo inteiro, proporção **2:5** (ex.: 800 × 2000 px), até 5 MB, com o mesmo enquadramento em todas (cabeça no topo, pés em baixo). Os pontos brancos da vista ampliada ficam em `PIN_POSITIONS` (`app.js`, percentagens da figura): parte de cima a 30 %, calças a 70 %, calçado a 94 % da altura.

## Carrossel
Os modelos percorrem uma órbita elíptica (seno → posição, cosseno → profundidade), animada com `requestAnimationFrame`. Com mais de 10 looks, só 10 posições ficam na órbita; os restantes esperam escondidos atrás e entram em fade. Afina em `ORBIT` (`slots`, `radius`, `minScale`, `maxBlur`, `duration`).

## Categorias
No topo há separadores **Tudo · Date Night · Gym · Beach · Run** (também por link: `index.html#gym`, `#beach`, `#run`, `#date-night`). Ao mudar, o carrossel mostra só os looks dessa categoria e entra a rodar.
As categorias geram-se no painel (*Categorias*: nome, ordem, visibilidade). `CATEGORIES` em `app.js` só serve enquanto o painel não responde.

## Comprar peças soltas
Na vista ampliada (clicar no modelo da frente), os pontos brancos marcam cada peça; clicar num ponto (ou numa peça do painel) abre a ficha da peça: a fotografia da peça (ou do modelo, se a peça não tiver), tamanho (XS–XL) ou número (38–46), preço e "Adicionar peça ao cesto". As miniaturas em baixo trocam entre as peças do look. O cesto aceita peças soltas e conjuntos completos.

## Ecrãs e dispositivos
O tamanho dos modelos depende da altura **e** da largura do palco (`--model-h` com unidades `cqh`/`cqw` em `.studio`), por isso cabem em qualquer ecrã. Pontos de quebra em `style.css`:
- **≥ 1600px** — painel lateral mais largo;
- **≤ 1100px** — painel de 300px (portáteis pequenos, tablets na horizontal);
- **≤ 860px** — palco em cima e painel em baixo, em duas colunas (tablets na vertical);
- **≤ 600px** — telemóveis: painel numa coluna, ficha da peça empilhada;
- **≤ 360px** — telemóveis pequenos: o link "Coleção 01" esconde-se;
- **altura ≤ 520px na horizontal** — telemóveis deitados: palco e painel lado a lado, título compacto;
- **ecrãs táteis** — pontos, setas e tamanhos maiores para os dedos.

## Autenticação (Supabase)
Registo com nome/email/palavra-passe e confirmação por email, entrar com email ou Google, recuperar e redefinir a palavra-passe, terminar sessão, sessão restaurada ao recarregar, e "A minha conta" para ver e editar o nome. O catálogo, as categorias e o cesto funcionam sem sessão.

- Cliente: `@supabase/supabase-js@2.118.0` (CDN, versão fixa) com **PKCE** (`flowType: 'pkce'`); o `?code=` dos links é trocado automaticamente e removido do URL.
- Credenciais: geridas só pelo Supabase Auth. A tabela `profiles` guarda apenas `full_name` (+ `is_admin`, que o utilizador não pode alterar).
- O frontend usa **só a chave publicável** (`sb_publishable_…`). Se `config.js` tiver uma chave secreta ou `service_role`, a autenticação recusa-se a arrancar.
- A proteção dos dados está na base de dados: RLS (cada utilizador só lê/edita a sua linha), privilégios de coluna (só `full_name` é editável), trigger que bloqueia `is_admin`, sem INSERT/DELETE para utilizadores. Nunca uses `user_metadata` para permissões — o utilizador pode alterá-lo.

### Passos no Supabase
1. Cria um projeto em https://supabase.com/dashboard.
2. **SQL Editor** → cola e executa `supabase/schema.sql`.
3. **SQL Editor** → executa `supabase/test-rls.sql`; deve terminar com `OK: todos os testes de isolamento passaram` (não deixa dados).
4. **Project Settings → API Keys** (ou botão **Connect**): copia o *Project URL* e a **Publishable key**. Copia `config.example.js` para `config.js` e preenche os dois valores.
5. **Authentication → URL Configuration**:
   - *Site URL*: o endereço público do site (ex.: `https://www.o-teu-dominio.pt`). Em desenvolvimento podes usar `http://localhost:5500`.
   - *Redirect URLs*: acrescenta `http://localhost:5500/**`, `http://127.0.0.1:5500/**` e `https://www.o-teu-dominio.pt/**`.
6. **Authentication → Sign In / Providers → Email**: confirma que *Confirm email* está ativo. Em **Authentication → Policies/Passwords** (ou na mesma página) define o comprimento mínimo da palavra-passe para **8**.
7. **Emails**: o serviço de email incluído no Supabase tem limites muito baixos e é só para testes. Para produção configura um SMTP próprio em **Authentication → Emails → SMTP Settings**. Opcional: traduz os modelos *Confirm signup* e *Reset password* para português (mantém `{{ .ConfirmationURL }}`).

### Passos na Google (login com Google)
1. https://console.cloud.google.com → cria/seleciona um projeto.
2. **Google Auth Platform / OAuth consent screen**: tipo *External*, nome da app, email de suporte; scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Enquanto estiver em modo *Testing*, acrescenta os teus emails como *Test users* (ou publica a app).
3. **Clients → Create client → Web application**:
   - *Authorized JavaScript origins*: `http://localhost:5500`, `http://127.0.0.1:5500`, `https://www.o-teu-dominio.pt`.
   - *Authorized redirect URIs*: o *Callback URL* que aparece no Supabase em **Authentication → Sign In / Providers → Google** (formato `https://<ref-do-projeto>.supabase.co/auth/v1/callback`).
4. Copia o *Client ID* e o *Client secret* para **Supabase → Authentication → Sign In / Providers → Google**, ativa e guarda. (O *Client secret* fica só no Supabase, nunca no site.)

### Verificar com contas reais
1. Abre o site por HTTP, cria duas contas (A e B) e confirma ambos os emails.
2. Na pasta do projeto (PowerShell):
   ```powershell
   $env:SUPABASE_URL="https://<ref>.supabase.co"; $env:SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
   $env:USER_A_EMAIL="a@..."; $env:USER_A_PASSWORD="..."; $env:USER_B_EMAIL="b@..."; $env:USER_B_PASSWORD="..."
   node supabase/verify-auth.mjs
   ```
   Verifica que cada conta só vê/edita o próprio perfil, que não consegue alterar o de outra nem tornar-se administradora, e que sem sessão não se lê nada.
3. Testa no browser: registo → email → link (abre no mesmo browser) → sessão iniciada; terminar sessão; recarregar; "Esqueceste-te da palavra-passe?" → email → link → nova palavra-passe; "Continuar com Google".

### Tornar alguém administrador
Só pelo SQL Editor (nunca a partir do site): `update public.profiles set is_admin = true where id = '<uuid do utilizador>';`

## Encomendas
No cesto, **Prosseguir com a encomenda** pede início de sessão (o cesto fica guardado e a encomenda reabre sozinha depois de entrar), mostra o resumo agrupado, pede os dados de entrega (Portugal) e regista a encomenda no Supabase como **a aguardar pagamento**. O cliente vê-as em **As minhas encomendas** (menu do nome).

Segurança:
- O browser envia só **SKU, tamanho e quantidade**. Preços, portes (grátis a partir de 100 €, senão 4,90 €) e total são calculados na base de dados (`place_order`), a partir da tabela `products`.
- Os clientes não escrevem diretamente em `orders`/`order_items` e não podem alterar o estado; RLS garante que cada um só vê as suas.

Configurar (SQL Editor, por esta ordem, depois de `schema.sql`):
1. `supabase/orders.sql`
2. `supabase/products.sql` (produtos de demonstração, usados pelo teste)
3. `supabase/test-orders.sql` → deve terminar com `OK: todos os testes de encomendas passaram`.

Os preços oficiais são os da tabela `products`, geridos no painel (*Produtos*).

Gerir estados (pela loja, no SQL Editor ou no Table Editor): `update public.orders set status = 'paid' where number = 1001;` (estados: `pending_payment`, `paid`, `shipped`, `delivered`, `cancelled`).

## Pagamento (Stripe)
Ao carregar em **Confirmar e pagar**, a encomenda é registada e abre-se logo uma **janela de pagamento da Stripe dentro do site** (Embedded Checkout; exige `stripePublishableKey: 'pk_test_...'` em `config.js`). Sem essa chave, o cliente é levado para a página da Stripe. Se o pagamento não abrir, a encomenda fica guardada com **Pagar agora**. No regresso, o site mostra "Pagamento confirmado" (ou "cancelado", com "Tentar pagar de novo"). Encomendas por pagar têm **Pagar agora** em "As minhas encomendas".

Segurança:
- A **chave secreta da Stripe** fica só nos *Secrets* das Edge Functions — nunca no site, no `config.js` nem no GitHub.
- `create-checkout` verifica o utilizador, lê a encomenda **com o token do cliente** (RLS: só as suas) e usa os preços gravados na base de dados. O browser só envia o id da encomenda. Os URLs de regresso são fixos (`SITE_URL`).
- Uma encomenda só passa a **paga** pelo `stripe-webhook`, que verifica a assinatura da Stripe (`Stripe-Signature`) e confirma que o valor e a moeda coincidem com o total. Voltar ao site com `?payment=success` não marca nada como pago.
- Multibanco (se o ativares na Stripe): a encomenda fica a aguardar até a referência ser paga (`checkout.session.async_payment_succeeded`).

### Passos para ativar
1. **SQL Editor** → executar `supabase/payments.sql`.
2. **Stripe** (https://dashboard.stripe.com, em **modo de teste**) → *Developers → API keys* → copiar a **Secret key** (`sk_test_...`). Não a coloques no site.
2b. Copiar também a **Publishable key** (`pk_test_...`) para `stripePublishableKey` em `config.js` (é pública; ativa a janela de pagamento dentro do site).
3. **Supabase → Edge Functions → Secrets** (https://supabase.com/dashboard/project/_/functions/secrets): criar
   - `STRIPE_SECRET_KEY` = `sk_test_...`
   - `SITE_URL` = `http://localhost:5500/index.html` (em produção, o endereço público)
4. **Publicar as funções**:
   - Pelo painel: *Edge Functions → Deploy a new function → Via Editor*, nome `create-checkout`, colar `supabase/functions/create-checkout/index.ts`, e **desligar "Enforce JWT verification"**; repetir para `stripe-webhook`.
   - Ou pelo CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase functions deploy create-checkout stripe-webhook` (o `config.toml` já desliga a verificação de JWT).
   - Porquê sem JWT no gateway: a Stripe não envia JWT (o webhook é autenticado pela assinatura) e `create-checkout` verifica o utilizador dentro da função.
5. **Stripe → Developers → Webhooks → Add endpoint**:
   - URL: `https://<ref>.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Copiar o *Signing secret* (`whsec_...`) para o Secret `STRIPE_WEBHOOK_SECRET` no Supabase.
6. Testar com o cartão de teste `4242 4242 4242 4242`, qualquer data futura e qualquer CVC. A encomenda deve passar a **Paga** em "As minhas encomendas".

Para produção: trocar para as chaves `sk_live_...`, criar o webhook em modo live com o novo `whsec_...` e atualizar `SITE_URL`.

## Painel de administração (`/admin/`)
Abre `http://localhost:5500/admin/`. Áreas: **Visão geral** (métricas reais, stock baixo, últimas encomendas), **Looks e carrossel** (criar, editar, publicar, arquivar, ordem, imagem do modelo, produtos e preço do conjunto, pré-visualização), **Produtos** (fotografias, preço, estado, variantes de cor/tamanho com stock), **Categorias** (nome, imagem, ordem, visibilidade) e **Encomendas** (pesquisa, filtros, detalhe, preparação/envio).

Segurança — tudo é validado no Supabase, não no browser:
- `public.is_admin()` lê `profiles.is_admin`, que o utilizador não pode alterar (privilégios de coluna + trigger). O painel só abre se a base de dados o confirmar; mesmo forçando a interface, RLS e as funções `admin_*` recusam quem não é administrador.
- Clientes e visitantes só **leem** categorias visíveis, produtos e looks publicados. Não alteram produtos, stock, looks, categorias nem encomendas. O stock (variantes) não é público.
- Imagens: buckets `looks` (PNG/WebP) e `catalog` (PNG/JPEG/WebP), leitura pública, escrita só para administradores, máximo 5 MB.
- Encomendas: **pagamento** (`payment_status`) e **envio** (`fulfillment_status`) são separados. O pagamento só muda pelo webhook da Stripe; o painel só gere preparação/envio, não envia sem pagamento confirmado, e cancelar repõe o stock (o reembolso faz-se na Stripe). As linhas mantêm nome, cor, tamanho e preço do momento da compra.
- Produtos e looks **arquivam-se**, não se apagam. Um look só é publicado com imagem e pelo menos um produto publicado.

Na loja, o carrossel circular mostra os looks publicados, pela ordem definida no painel. `index.html?preview=<id>` mostra um rascunho só a administradores.

### Configurar
1. **SQL Editor**: executar `supabase/admin.sql` (depois de `schema.sql`, `orders.sql`, `products.sql`, `payments.sql`). Só acrescenta; não apaga dados.
2. Executar de novo `supabase/products.sql` (preenche cor/forma dos ícones; não altera preços nem estados).
3. **SQL Editor**: `supabase/test-admin.sql` → `OK: todos os testes de administração passaram`.
3b. **Só depois dos testes**: `supabase/archive-demo-products.sql` esconde os 68 produtos de demonstração (arquiva-os; nada é apagado e as encomendas antigas ficam intactas). Os testes SQL usam esses produtos, por isso correm antes.
4. **Primeiro administrador**: regista a conta na loja e confirma o email; depois abre `supabase/first-admin.sql`, substitui o email na linha `v_email` e executa-o no SQL Editor. O email só serve para encontrar a conta: a permissão fica no **ID do utilizador** (`profiles.is_admin`). O script recusa contas inexistentes ou por confirmar, só altera essa linha e lista os administradores no fim. Para retirar: `update public.profiles set is_admin = false where id = '<user_id>';`.
5. Se já tinhas publicado a função `stripe-webhook`, publica de novo a versão atual (também grava `payment_status`). A versão antiga continua a funcionar graças a um trigger de compatibilidade.

Stock: produtos **com** variantes ativas só se vendem nas variantes com stock (descontado ao encomendar, reposto ao cancelar). Produtos **sem** variantes vendem-se nos tamanhos padrão, sem controlo de stock. A loja ainda não esconde tamanhos esgotados: o servidor recusa e o cliente vê a mensagem.

## Entrada única (clientes e administrador)
Há um só formulário de entrada, na loja (email/palavra-passe ou Google). Depois de entrar, o site pergunta ao servidor `is_admin()` — que lê `profiles.is_admin` pelo ID do utilizador autenticado — e:
- **administrador** → abre `/admin/`;
- **cliente** → continua na loja (área normal: conta, encomendas, cesto).

A meio de uma encomenda, mesmo um administrador continua no checkout. `/admin/` sem sessão envia para o formulário da loja (`index.html?login=admin`); com sessão de cliente mostra "Acesso recusado". O encaminhamento é só conveniência: a proteção está no Supabase (RLS, funções `admin_*`, políticas do Storage). O registo nunca dá permissão de administrador (metadados como `"is_admin": true` são ignorados) e o site não compara emails para autorizar.

## Limitações
O cesto usa `localStorage` (não está ligado à conta). Não há gestão de stock nem reembolsos automáticos (fazem-se no painel da Stripe; o estado da encomenda muda-se no Supabase). Os preços e a marca são exemplos.
