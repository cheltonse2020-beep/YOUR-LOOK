# FORMA — Experimenta o look

Protótipo estático: fila de 5 conjuntos com profundidade (o central em foco, os laterais mais pequenos e desfocados), categorias, pontos sobre as peças na vista ampliada, painel "Neste look", cesto local e contas de utilizador com Supabase.

## Abrir
Para explorar o catálogo basta abrir `index.html`. Para **iniciar sessão** o site tem de ser servido por HTTP (o Supabase não redireciona para `file://`):
- VS Code → extensão **Live Server** → "Go Live" (abre em `http://127.0.0.1:5500`), ou
- na pasta do projeto: `python -m http.server 5500` e abrir `http://localhost:5500/index.html`.

Não precisa de npm nem de compilação.

## Ficheiros
- `index.html` — estrutura e textos fixos (inclui os gradientes SVG partilhados `#shade` e `#floor`).
- `style.css` — cores (variáveis em `:root`), disposição, animações e telemóvel.
- `app.js` — dados (`LOOKS`), ilustrações (`figure`), carrossel, pontos e cesto.
- `auth.js` — autenticação (Supabase Auth) e "A minha conta".
- `checkout.js` — "Prosseguir com a encomenda", entrega, confirmação e "As minhas encomendas".
- `config.example.js` — modelo de configuração; copiar para `config.js` (ignorado pelo git).
- `supabase/schema.sql` — tabela `profiles`, trigger de criação automática, RLS e proteção de `is_admin`.
- `supabase/test-rls.sql` — teste de isolamento entre dois utilizadores (corre e faz rollback).
- `supabase/verify-auth.mjs` — verificação real, pela API, com duas contas de teste.
- `supabase/orders.sql` — catálogo de preços, encomendas, linhas, RLS e função `place_order`.
- `supabase/products.sql` — preços oficiais (gerado por `supabase/generate-products.mjs` a partir de `app.js`).
- `supabase/test-orders.sql` — teste das encomendas (preços no servidor, validação, isolamento; faz rollback).

## Editar os looks
Os 30 looks da coleção principal estão em `LOOK_TABLE` (`app.js`), uma linha por look:
`[nome, corpo, parte de cima, calças, calçado, descrição opcional]`.
- `corpo` é um índice de `BODIES` (pele, cabelo `short` | `buzz` | `mop` | `locs`, cor do cabelo, `glasses` opcional);
- as peças são chaves dos catálogos `TOPS` (`sweater` | `tee`), `PANTS` (`baggy` | `straight`) e `SHOES`, com nome, cor e preço.

Sem descrição, é gerada a partir das cores ("Cru com ganga crua."). O total do conjunto é a soma das peças.

## Carrossel
Os modelos percorrem uma órbita elíptica (seno → posição, cosseno → profundidade), animada com `requestAnimationFrame`. Com mais de 10 looks, só 10 posições ficam na órbita; os restantes esperam escondidos atrás e entram em fade. Afina em `ORBIT` (`slots`, `radius`, `minScale`, `maxBlur`, `duration`).

## Categorias
No topo há separadores **Tudo · Date Night · Gym · Beach · Run** (também por link: `index.html#gym`, `#beach`, `#run`, `#date-night`). Ao mudar, o carrossel mostra só os looks dessa categoria e entra a rodar.
As categorias estão em `CATEGORIES` (`app.js`): cada uma tem `looks` próprios (mesmo formato de `LOOK_TABLE`) e pode incluir looks da coleção principal pelo nome (`include`). As peças novas (camisas, camisolas de alças, calções, joggers, sandálias, sapatilhas de corrida/treino) foram acrescentadas a `TOPS`, `PANTS` e `SHOES`, com os estilos `shirt`, `camp`, `tank`, `jogger`, `shorts`, `runshorts` e `sandal`.

## Comprar peças soltas
Na vista ampliada (clicar no modelo da frente), os pontos brancos marcam cada peça; clicar num ponto (ou numa peça do painel) abre a ficha da peça: a peça ampliada no próprio modelo (recorte em `PIECE_CROP`), tamanho (XS–XL) ou número (38–46), preço e "Adicionar peça ao cesto". As miniaturas em baixo trocam entre as peças do look. O cesto aceita peças soltas e conjuntos completos.

## Ecrãs e dispositivos
O tamanho dos modelos depende da altura **e** da largura do palco (`--model-h` com unidades `cqh`/`cqw` em `.studio`), por isso cabem em qualquer ecrã. Pontos de quebra em `style.css`:
- **≥ 1600px** — painel lateral mais largo;
- **≤ 1100px** — painel de 300px (portáteis pequenos, tablets na horizontal);
- **≤ 860px** — palco em cima e painel em baixo, em duas colunas (tablets na vertical);
- **≤ 600px** — telemóveis: painel numa coluna, ficha da peça empilhada;
- **≤ 360px** — telemóveis pequenos: o link "Coleção 01" esconde-se;
- **altura ≤ 520px na horizontal** — telemóveis deitados: palco e painel lado a lado, título compacto;
- **ecrãs táteis** — pontos, setas e tamanhos maiores para os dedos.

## Usar fotografias
As figuras são ilustrações SVG. Para o efeito realista, substitui o retorno de `figure()` por `<img src="assets/look-1.webp" alt="">` com PNG/WebP transparentes de corpo inteiro, proporção 2:5 e o mesmo enquadramento em todas, e acrescenta `.model img { width:100%; height:100%; object-fit:contain; }`. Ajusta `PIN_POSITIONS` (percentagens da figura) se necessário.

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
2. `supabase/products.sql`
3. `supabase/test-orders.sql` → deve terminar com `OK: todos os testes de encomendas passaram`.

Se mudares peças ou preços em `app.js`: `node supabase/generate-products.mjs` e volta a executar `products.sql`.

Gerir estados (pela loja, no SQL Editor ou no Table Editor): `update public.orders set status = 'paid' where number = 1001;` (estados: `pending_payment`, `paid`, `shipped`, `delivered`, `cancelled`).

## Limitações
O cesto usa `localStorage` (não está ligado à conta). Não há pagamento online nem gestão de stock: as encomendas ficam a aguardar pagamento. Os preços e a marca são exemplos.
