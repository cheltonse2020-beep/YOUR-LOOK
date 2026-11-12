'use strict';

/* =========================================================
   Dados — a coleção vem toda do painel de administração (Supabase).
   catalog.js lê os looks PUBLICADOS e chama applyRemote().
   Estas são as categorias iniciais; o painel pode mudá-las.
   Peças: kind top | pants | shoes · style só afina o ícone.
   ========================================================= */
const CATEGORIES = [
  { id: 'all', label: 'Tudo', blurb: 'conjuntos, do primeiro ao último pormenor.' },
  { id: 'date-night', label: 'Date Night', blurb: 'conjuntos para uma noite especial.' },
  { id: 'gym', label: 'Gym', blurb: 'conjuntos para treinar com estilo.' },
  { id: 'beach', label: 'Beach', blurb: 'conjuntos para dias de praia.' },
  { id: 'run', label: 'Run', blurb: 'conjuntos para correr.' },
];

const withDetail = p => ({ ...p, detail: p.fabric ? `${p.colorName} · ${p.fabric}` : p.colorName });

const LOOKS = [];   // preenchido por applyRemote()

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const SHOE_SIZES = ['38', '39', '40', '41', '42', '43', '44', '45', '46'];
const STORAGE_KEY = 'forma-bag-v2';

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
const pad = n => String(n).padStart(2, '0');
const lookTotal = look => look.pieces.reduce((sum, p) => sum + p.price, 0);

const escAttr = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Fotografia do modelo (fundo transparente), carregada no painel
const figure = look => `<img class="model-img" src="${escAttr(look.image)}" alt="" draggable="false">`;

function icon(piece) {
  const paths = {
    sweater: 'M20 9L26 13H34L40 9L53 16L58 52L49 53L45 27V63H15V27L11 53L2 52L7 16Z',
    shirt: 'M20 9L26 13L30 20L34 13L40 9L53 16L58 52L49 53L45 27V63H15V27L11 53L2 52L7 16Z',
    tee: 'M19 10L25 14H35L41 10L56 23L48 34L42 29V62H18V29L12 34L4 23Z',
    camp: 'M19 10L25 14L30 21L35 14L41 10L56 23L48 34L42 29V62H18V29L12 34L4 23Z',
    tank: 'M20 6H25Q30 18 35 6H40L44 22V64H16V22Z',
    pants: 'M14 5H46L53 65H34L30 25L26 65H7Z',
    shorts: 'M12 12H48L53 48H34L30 28L26 48H7Z',
    shoes: 'M5 46Q6 32 18 32L30 36Q42 40 52 42Q58 44 57 52H5Z',
    sandal: 'M5 46Q6 42 16 42H46Q57 42 56 50H5ZM16 42L22 34H30L26 42ZM34 42L38 34H46L42 42Z',
    glasses: 'M4 30H56V34H52Q51 46 40 46Q31 46 30 36Q29 46 20 46Q9 46 8 34H4Z',
    watch: 'M22 6H38L40 20Q48 26 48 35Q48 44 40 50L38 64H22L20 50Q12 44 12 35Q12 26 20 20Z',
    necklace: 'M10 8Q30 52 50 8L54 10Q32 62 6 10ZM26 46H34V58H26Z',
    hat: 'M14 40Q14 14 30 14Q46 14 46 40H58V48H2V40Z',
    bag: 'M10 26H50L54 64H6ZM20 26Q20 8 30 8Q40 8 40 26H35Q35 13 30 13Q25 13 25 26Z',
    belt: 'M2 28H58V40H2ZM24 25H38V43H24Z',
    accessory: 'M30 6L37 23L55 24L41 36L46 54L30 44L14 54L19 36L5 24L23 23Z',
  };
  const key = piece.kind === 'top' ? piece.style
    : piece.kind === 'pants' ? (isShorts(piece) ? 'shorts' : 'pants')
    : piece.kind === 'accessory' ? (piece.style in ACCESSORY_LABEL ? piece.style : 'accessory')
    : piece.style === 'sandal' ? 'sandal' : 'shoes';
  const d = paths[key] || paths[piece.kind === 'top' ? 'tee' : piece.kind] || paths.tee;
  return `<svg viewBox="0 0 60 70" aria-hidden="true">
    <path d="${d}" fill="${piece.color || '#9aa0a6'}" stroke="#000" stroke-opacity=".12"/>
    <path d="${d}" fill="url(#shade)"/>
  </svg>`;
}

// Miniatura da peça: fotografia (painel) ou ícone desenhado
const pieceThumb = piece => (piece.image
  ? `<img src="${escAttr(piece.image)}" alt="" loading="lazy">`
  : icon(piece));

/* Posição dos pontos (em % da figura) */
const PIN_POSITIONS = { top: [50, 30], pants: [60, 70], shoes: [63, 94] };
// Acessórios: o ponto fica onde a peça costuma estar numa fotografia de corpo inteiro, de frente
const ACCESSORY_PINS = { glasses: [50, 8], hat: [50, 3], necklace: [50, 19], watch: [68, 46], bag: [76, 52], belt: [50, 42], other: [72, 38] };
const ACCESSORY_LABEL = { glasses: 'Óculos', watch: 'Relógio', necklace: 'Colar', hat: 'Chapéu', bag: 'Mala', belt: 'Cinto', other: 'Acessório' };
const isShorts = piece => piece.style === 'shorts' || piece.style === 'runshorts';
const pinPosition = piece =>
  piece.kind === 'accessory' ? (ACCESSORY_PINS[piece.style] || ACCESSORY_PINS.other)
  : piece.kind === 'pants' && isShorts(piece) ? [60, piece.style === 'runshorts' ? 56 : 59] : PIN_POSITIONS[piece.kind];

const KIND_LABEL = { top: 'Parte de cima', pants: 'Calças', shoes: 'Calçado', accessory: 'Acessório' };
const kindLabel = piece => (piece.kind === 'pants' && isShorts(piece) ? 'Calções'
  : piece.kind === 'accessory' ? (ACCESSORY_LABEL[piece.style] || 'Acessório') : KIND_LABEL[piece.kind]);
// Tamanhos à venda: os ativados no painel; sem lista, os padrão do tipo. Acessórios: tamanho único ('U').
const sizesFor = piece => (piece.sizes?.length ? piece.sizes
  : piece.kind === 'shoes' ? SHOE_SIZES : piece.kind === 'accessory' ? ['U'] : SIZES);
const sizeText = size => (size === 'U' ? 'Único' : size);
const clothes = piece => piece.kind === 'top' || piece.kind === 'pants';

/* =========================================================
   Estado
   ========================================================= */
let category = 'all';
let view = [];       // índices de LOOKS visíveis na categoria atual
let active = 0;      // posição em `view`
let activePiece = null;
const currentLook = () => LOOKS[view[active]];
// Os looks são guardados no cesto pelo id do painel (estável)
const bagLook = x => LOOKS.find(l => l.dbId === x.lookId);
const lookRef = () => ({ lookId: currentLook().dbId });
let bag = loadBag();

function loadBag() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    // Validado de novo quando o catálogo do Supabase carregar (applyRemote).
    // Artigos dos antigos looks de demonstração (sem lookId) são descartados.
    return stored.filter(x => typeof x.lookId === 'string' && /^[0-9a-f-]{36}$/i.test(x.lookId) && typeof x.size === 'string');
  } catch {
    return [];
  }
}

/* =========================================================
   Estúdio (carrossel)
   ========================================================= */
let modelEls = [];

function buildModels() {
  $('models').innerHTML = '';
  modelEls = view.map((id, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'model';
    el.dataset.look = i;
    el.setAttribute('aria-label', `Ver look ${LOOKS[id].name}`);
    el.innerHTML = figure(LOOKS[id]);
    $('models').appendChild(el);
    return el;
  });
}

/* ---------- Órbita elíptica ----------
   Cada modelo tem um desvio contínuo em relação à frente: off = i − rotation
   (normalizado para −n/2…n/2). O ângulo na elipse é θ = off · 2π / SLOTS.
   sin θ → posição horizontal · cos θ → profundidade (1 = à frente, −1 = atrás).
   Com muitos modelos, só SLOTS cabem na órbita; os restantes esperam
   escondidos atrás e entram/saem em fade. `rotation` é contínua, por isso
   a passagem entre o último e o primeiro é feita sem saltos. */
const ORBIT = {
  slots: 10,          // posições visíveis na elipse
  radius: 1.9,        // raio horizontal, em unidades de --spread (CSS)
  lift: 3,            // quanto os modelos de trás sobem (perspetiva)
  minScale: 0.6,
  maxBlur: 3.5,       // px
  minOpacity: 0.45,
  duration: 850,      // ms por passo de 1 (passos maiores demoram um pouco mais)
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let rotation = active;      // posição atual (contínua)
let targetRotation = active;
let anim = null;            // { from, to, start, duration }

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = v => Math.min(Math.max(v, 0), 1);

function orbitOffset(i, rot) {
  const n = view.length;
  return ((((i - rot + n / 2) % n) + n) % n) - n / 2;
}

function placeModels() {
  const n = view.length;
  // Até ORBIT.slots looks: anel completo — todos repartidos pela volta inteira (360°),
  // sem princípio nem fim. Com mais: 10 posições visíveis; os restantes esperam escondidos
  // atrás e entram/saem em fade.
  const closed = n <= ORBIT.slots;
  const slots = closed ? Math.max(n, 1) : ORBIT.slots;
  const reach = slots / 2 - 0.5;
  modelEls.forEach((el, i) => {
    const off = orbitOffset(i, rotation);
    // Fora da órbita visível: fica escondido (sem custo de desenho).
    const fade = closed ? 1 : clamp01(reach - Math.abs(off));
    if (fade <= 0) {
      el.style.visibility = 'hidden';
      return;
    }
    el.style.visibility = '';

    const theta = (off * 2 * Math.PI) / slots;
    const x = Math.sin(theta);
    const depth = (Math.cos(theta) + 1) / 2; // 0 = atrás, 1 = à frente

    el.style.setProperty('--pos', (x * ORBIT.radius).toFixed(4));
    el.style.setProperty('--d', ((1 - depth) * ORBIT.lift).toFixed(4));
    el.style.setProperty('--s', (ORBIT.minScale + (1 - ORBIT.minScale) * depth).toFixed(4));
    el.style.setProperty('--b', `${((1 - depth) * ORBIT.maxBlur).toFixed(2)}px`);
    // Opacos na metade da frente (para não se verem os de trás através deles), esbatidos atrás.
    const opacity = Math.min(1, ORBIT.minOpacity + (1 - ORBIT.minOpacity) * depth * 1.6);
    el.style.setProperty('--o', (opacity * fade).toFixed(4));
    el.style.setProperty('--sat', (0.65 + 0.35 * depth).toFixed(4));
    el.style.zIndex = Math.round(depth * 100);
  });
}

function markSelected() {
  modelEls.forEach((el, i) => {
    const selected = i === active;
    const reachable = Math.abs(orbitOffset(i, active)) <= 2; // só os vizinhos próximos recebem foco
    el.classList.toggle('selected', selected);
    el.setAttribute('aria-pressed', selected);
    const name = LOOKS[view[i]].name;
    el.setAttribute('aria-label', selected ? `Ampliar look ${name}` : `Ver look ${name}`);
    el.tabIndex = selected || reachable ? 0 : -1;
  });
}

/* ---------- Vista ampliada ---------- */
let focused = false;
let zoomTimer;

function setFocus(on, moveFocus = true) {
  if (focused === on || (on && !currentLook())) return;
  focused = on;
  const studio = document.querySelector('.studio');
  studio.classList.add('zooming');
  studio.classList.toggle('focus', on);
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => studio.classList.remove('zooming'), 650);
  $('focus-title').textContent = currentLook().name;
  modelEls[active].setAttribute('aria-label',
    on ? `Reduzir look ${currentLook().name}` : `Ampliar look ${currentLook().name}`);
  if (!moveFocus) return;
  if (on) $('focus-close').focus({ preventScroll: true });
  else modelEls[active].focus({ preventScroll: true });
}

function tick(now) {
  if (!anim) return;
  const t = Math.min((now - anim.start) / anim.duration, 1);
  rotation = anim.from + (anim.to - anim.from) * easeInOut(t);
  placeModels();
  if (t < 1) {
    requestAnimationFrame(tick);
  } else {
    anim = null;
    $('pins').classList.remove('moving');
    renderPins();
  }
}

function rotateTo(target, customDuration) {
  targetRotation = target;
  $('pins').classList.add('moving');
  if (reduceMotion.matches) {
    rotation = target;
    placeModels();
    anim = null;
    $('pins').classList.remove('moving');
    renderPins();
    return;
  }
  const running = anim !== null;
  const steps = Math.abs(target - rotation);
  const duration = customDuration ?? ORBIT.duration * (1 + Math.min(steps - 1, 6) * 0.15);
  anim = { from: rotation, to: target, start: performance.now(), duration };
  if (!running) requestAnimationFrame(tick);
}

function renderPins() {
  const look = currentLook();
  if (!look) { $('pins').innerHTML = ''; return; }
  $('pins').innerHTML = `<div class="pin-frame">${look.pieces.map((piece, i) => {
    const [x, y] = pinPosition(piece);
    return `<button type="button" class="pin" data-piece="${i}" style="left:${x}%;top:${y}%"
      aria-label="Ver ${piece.name}"></button>`;
  }).join('')}</div>`;
}

/* =========================================================
   Painel lateral
   ========================================================= */
function renderPanel() {
  const look = currentLook();
  renderEmpty();
  if (!look) return;
  $('look-title').textContent = look.name;
  $('look-mood').textContent = look.mood;
  $('look-number').textContent = pad(active + 1);
  // Só pede o tamanho/número que o conjunto precisa, com os tamanhos à venda em todas as peças
  fillSizes($('size'), look.pieces.filter(clothes), SIZES);
  fillSizes($('shoe'), look.pieces.filter(p => p.kind === 'shoes'), SHOE_SIZES);
  $('products').innerHTML = look.pieces.map((p, i) => `
    <button type="button" class="product" data-piece="${i}">
      <span class="swatch">${pieceThumb(p)}</span>
      <span><span class="pname">${p.name}</span><span class="pdetail">${p.detail}</span></span>
      <strong>${money(p.price)}</strong>
    </button>`).join('');
  $('total').textContent = money(lookTotal(look));
}

// Opções do seletor: tamanhos disponíveis em TODAS as peças desse tipo (o conjunto vende-se num só tamanho)
function fillSizes(select, pieces, order) {
  select.closest('label').hidden = !pieces.length;
  if (!pieces.length) return;
  const common = pieces.map(sizesFor).reduce((a, b) => a.filter(x => b.includes(x)));
  const rank = x => (order.indexOf(x) + 1) || 99;
  const sizes = [...common].sort((a, b) => rank(a) - rank(b));
  const keep = sizes.includes(select.value) ? select.value : '';
  const placeholder = select.options[0].textContent;
  select.innerHTML = `<option value="">${placeholder}</option>` + sizes.map(s => `<option>${escAttr(s)}</option>`).join('');
  select.value = keep;
  select.disabled = !sizes.length;
  if (!sizes.length) select.options[0].textContent = 'Sem tamanho comum';
}

function highlightPiece(index) {
  activePiece = index;
  document.querySelectorAll('[data-piece]').forEach(el =>
    el.classList.toggle('active', Number(el.dataset.piece) === activePiece));
}

/* ---------- Ficha da peça (ampliada) ---------- */
function openPiece(index) {
  highlightPiece(index);
  renderPiece(index);
  if (!$('piece').open) $('piece').showModal();
}

function renderPiece(index) {
  const look = currentLook();
  const piece = look.pieces[index];
  const sizes = sizesFor(piece);
  // Pré-seleciona o tamanho já escolhido no painel, se houver.
  const preset = sizes.length === 1 ? sizes[0] : piece.kind === 'shoes' ? $('shoe').value : $('size').value;

  $('piece').dataset.piece = index;
  $('piece-zoom').innerHTML = `<img src="${escAttr(piece.image || look.image)}" alt="">`;
  $('piece-zoom').classList.remove('enter');
  void $('piece-zoom').offsetWidth;
  $('piece-zoom').classList.add('enter');
  $('piece-kind').textContent = `${kindLabel(piece)} · look ${look.name}`;
  $('piece-name').textContent = piece.name;
  $('piece-detail').textContent = piece.detail;
  $('piece-price').textContent = money(piece.price);
  $('piece-size-label').textContent = piece.kind === 'shoes' ? 'Número' : 'Tamanho';
  $('piece-sizes').innerHTML = sizes.map(s => `
    <button type="button" class="size-chip${s === preset ? ' selected' : ''}" data-size="${escAttr(s)}"
      aria-pressed="${s === preset}">${escAttr(sizeText(s))}</button>`).join('');
  $('piece-status').textContent = '';
  $('piece-others').innerHTML = look.pieces.map((p, i) => `
    <button type="button" class="piece-thumb${i === index ? ' active' : ''}" data-goto="${i}"
      aria-label="Ver ${p.name}" aria-current="${i === index}">${pieceThumb(p)}</button>`).join('');
  $('piece-full').textContent = `Comprar o conjunto completo · ${money(lookTotal(look))}`;
}

function addPieceToBag() {
  const index = Number($('piece').dataset.piece);
  const piece = currentLook().pieces[index];
  const chosen = $('piece-sizes').querySelector('.selected');
  if (!chosen) {
    $('piece-status').textContent = piece.kind === 'shoes' ? 'Escolhe o número.' : 'Escolhe o tamanho.';
    $('piece-status').className = 'piece-status warn';
    return;
  }
  bag.push({ type: 'piece', ...lookRef(), piece: index, size: chosen.dataset.size });
  saveBag();
  $('piece-status').textContent = `✓ ${piece.name} (${chosen.dataset.size}) adicionada ao cesto.`;
  $('piece-status').className = 'piece-status ok';
}

let interacted = false;   // o cliente já mudou de look? (ver applyRemote)

function go(index) {
  interacted = true;
  const n = view.length;
  if (!n) return;
  const next = ((index % n) + n) % n;
  // Caminho mais curto à volta da órbita (ex.: 5 → 1 avança uma posição).
  let delta = next - active;
  if (delta > n / 2) delta -= n;
  if (delta < -n / 2) delta += n;
  if (delta === 0) return;

  setFocus(false, false);
  active = next;
  activePiece = null;
  markSelected();
  renderPanel();
  rotateTo(targetRotation + delta);
}

/* ---------- Sem looks ---------- */
let catalogReady = false;   // applyRemote() já respondeu (com ou sem looks)

function renderEmpty() {
  const empty = !view.length;
  document.body.classList.toggle('no-looks', empty);
  $('empty').hidden = !empty;
  if (!empty) return;
  const [title, text] = !catalogReady
    ? ['A carregar a coleção…', '']
    : LOOKS.length
      ? ['Ainda sem looks nesta categoria', 'Experimenta outra categoria acima.']
      : ['Coleção em preparação', 'Os novos looks chegam em breve.'];
  $('empty').innerHTML = `<strong>${title}</strong>${text ? `<span>${text}</span>` : ''}`;
  $('look-title').textContent = title;
  $('look-mood').textContent = text;
  $('look-number').textContent = '';
  $('products').innerHTML = '';
}

/* ---------- Categorias ---------- */
function renderTabs() {
  $('categories').innerHTML = CATEGORIES.filter(c => !c.hidden).map(c => {
    const count = c.id === 'all' ? LOOKS.length : LOOKS.filter(l => l.cats.includes(c.id)).length;
    return `<button type="button" class="cat" data-cat="${c.id}" aria-pressed="false">${c.label}<span>${count}</span></button>`;
  }).join('');
}

function setCategory(id, { animate = true } = {}) {
  if (!CATEGORIES.some(c => c.id === id && !c.hidden)) id = 'all';
  const cat = CATEGORIES.find(c => c.id === id);
  category = id;
  // Ordem: a posição definida no painel
  const order = i => LOOKS[i].order ?? i;
  view = LOOKS.map((_, i) => i).filter(i => LOOKS[i].cats.includes(id)).sort((a, b) => order(a) - order(b));

  setFocus(false, false);
  if ($('piece').open) $('piece').close();
  anim = null;
  active = 0;
  activePiece = null;

  buildModels();
  markSelected();
  renderPanel();
  $('intro-text').innerHTML = view.length
    ? `${view.length} ${escAttr(cat.blurb || 'conjuntos.')}<br>Toca no modelo para o ampliar.`
    : 'Novos looks em breve.';
  document.querySelectorAll('.cat').forEach(b => {
    const on = b.dataset.cat === id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });

  if (animate && !reduceMotion.matches) {
    // Entrada: os modelos chegam a rodar até ao primeiro look da categoria.
    rotation = active - 2.5;
    placeModels();
    $('models').classList.remove('entering');
    void $('models').offsetWidth;
    $('models').classList.add('entering');
    rotateTo(active, 1100);
  } else {
    rotation = targetRotation = active;
    placeModels();
    $('pins').classList.remove('moving');
    renderPins();
  }

  const hash = id === 'all' ? '' : `#${id}`;
  // Não mexer no URL se trouxer parâmetros de autenticação (#error=..., tratados em auth.js)
  const authParams = location.hash.includes('=');
  if (!authParams && location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
}

function init() {
  renderTabs();
  setCategory(location.hash.slice(1), { animate: false });
}

/* ---------- Catálogo do Supabase (catalog.js) ----------
   Recebe as categorias e os looks publicados no painel (sem argumentos = sem catálogo). */
function applyRemote({ categories = [], looks = [], preview = null } = {}) {
  catalogReady = true;
  const tabsBefore = JSON.stringify(CATEGORIES.map(c => [c.id, c.label, c.hidden]));
  categories.forEach(c => {
    let cat = CATEGORIES.find(x => x.id === c.id);
    if (!cat) { cat = { id: c.id }; CATEGORIES.push(cat); }
    cat.label = c.name;
    cat.hidden = !c.visible;
    cat.position = c.position;
    if (c.description) cat.blurb = c.description;
    else if (!cat.blurb) cat.blurb = `conjuntos ${c.name}.`;
  });
  CATEGORIES.sort((a, b) => (a.id === 'all' ? -1 : b.id === 'all' ? 1 : (a.position ?? 999) - (b.position ?? 999)));

  const keep = currentLook();
  for (let i = LOOKS.length - 1; i >= 0; i--) if (LOOKS[i].dbId) LOOKS.splice(i, 1);
  looks.forEach(l => LOOKS.push({
    name: l.name,
    mood: l.description || 'Look da coleção.',
    cats: ['all', l.category_id],
    image: l.image,
    order: l.preview ? -1 : l.position,
    dbId: l.id,
    preview: Boolean(l.preview),
    pieces: l.pieces.map(withDetail),
  }));

  // Cesto: retira looks que deixaram de estar publicados
  const before = bag.length;
  bag = bag.filter(x => {
    const look = bagLook(x);
    if (!look) return false;
    return x.type !== 'piece' || Boolean(look.pieces[x.piece]);
  });
  if (bag.length !== before) saveBag(); else updateBag();

  const tabsChanged = JSON.stringify(CATEGORIES.map(c => [c.id, c.label, c.hidden])) !== tabsBefore;
  if (!looks.length && !tabsChanged) { renderPanel(); return; }
  renderTabs();
  setCategory(preview ? 'all' : category, { animate: false });
  // Só mantém o look atual se o cliente já tiver navegado; no primeiro carregamento mostra os looks novos à frente
  const idx = keep && !preview && interacted ? view.findIndex(i => LOOKS[i] === keep) : -1;
  if (idx > 0) {
    active = idx;
    rotation = targetRotation = idx;
    markSelected(); placeModels(); renderPanel(); renderPins();
  }
  const banner = $('preview-banner');
  if (banner) {
    banner.hidden = !preview;
    if (preview) banner.textContent = `Pré-visualização: «${preview}» ainda não está publicado. Só administradores o veem.`;
  }
}

window.FORMA_STORE = { applyRemote };

/* =========================================================
   Saco
   ========================================================= */
let messageTimer;
function message(text) {
  $('message').textContent = text;
  $('message').classList.add('visible');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => $('message').classList.remove('visible'), 2800);
}

function saveBag() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bag));
  } catch {
    message('O navegador não permite guardar o cesto.');
  }
  updateBag();
}

function updateBag() {
  const count = $('count');
  if (count.dataset.ready && Number(count.textContent) < bag.length) {   // artigo novo: o contador dá um pequeno salto
    count.classList.remove('bump');
    void count.offsetWidth;
    count.classList.add('bump');
  }
  const shown = bag.filter(x => bagLook(x));   // looks do painel ainda a carregar ficam guardados
  count.textContent = shown.length;
  count.dataset.ready = '1';
  count.toggleAttribute('data-empty', shown.length === 0);
  $('bag').setAttribute('aria-label', `Abrir cesto (${shown.length} ${shown.length === 1 ? 'artigo' : 'artigos'})`);
  $('cart-items').innerHTML = shown.length
    ? bag.map((x, i) => {
      const look = bagLook(x);
      if (!look) return '';
      if (x.type === 'piece') {
        const piece = look.pieces[x.piece];
        const sizeLabel = piece.kind === 'shoes' ? 'Número' : 'Tamanho';
        return `<div class="cart-row">
          <span class="cart-thumb">${pieceThumb(piece)}</span>
          <span class="cart-info">${piece.name}<br><small>${piece.detail} · ${sizeLabel} ${sizeText(x.size)} · ${money(piece.price)}</small></span>
          <button type="button" data-remove="${i}">Remover</button>
        </div>`;
      }
      const sizes = [x.size && `Roupa ${x.size}`, x.shoe && `Calçado ${x.shoe}`].filter(Boolean).join(' · ');
      return `<div class="cart-row">
        <span class="cart-thumb">${pieceThumb(look.pieces[0])}</span>
        <span class="cart-info">Conjunto ${look.name}<br><small>${sizes} · ${money(lookTotal(look))}</small></span>
        <button type="button" data-remove="${i}">Remover</button>
      </div>`;
    }).join('')
    : '<p class="muted">O teu cesto está vazio.</p>';
  const total = shown.reduce((sum, x) =>
    sum + (x.type === 'piece' ? bagLook(x).pieces[x.piece].price : lookTotal(bagLook(x))), 0);
  $('cart-total').textContent = money(total);
  $('cart-total-row').hidden = !shown.length;
  $('clear').hidden = !shown.length;
  if ($('checkout-start')) $('checkout-start').hidden = !shown.length;
}

/* =========================================================
   Eventos
   ========================================================= */
$('size').insertAdjacentHTML('beforeend', SIZES.map(s => `<option>${s}</option>`).join(''));
$('shoe').insertAdjacentHTML('beforeend', SHOE_SIZES.map(s => `<option>${s}</option>`).join(''));

$('models').addEventListener('click', e => {
  const el = e.target.closest('[data-look]');
  if (swiped) { swiped = false; return; }
  if (!el) { setFocus(false); return; }                 // clique no fundo fecha a vista ampliada
  const index = Number(el.dataset.look);
  if (index === active) setFocus(!focused);             // modelo da frente: ampliar / reduzir
  else go(index);
});
$('focus-close').addEventListener('click', () => setFocus(false));
$('focus-back').addEventListener('click', () => setFocus(false));

$('pins').addEventListener('click', e => {
  const pin = e.target.closest('[data-piece]');
  if (pin) openPiece(Number(pin.dataset.piece));
});
$('products').addEventListener('click', e => {
  const row = e.target.closest('[data-piece]');
  if (row) openPiece(Number(row.dataset.piece));
});

// Ficha da peça
$('piece-sizes').addEventListener('click', e => {
  const chip = e.target.closest('[data-size]');
  if (!chip) return;
  $('piece-sizes').querySelectorAll('.size-chip').forEach(c => {
    c.classList.toggle('selected', c === chip);
    c.setAttribute('aria-pressed', c === chip);
  });
  $('piece-status').textContent = '';
});
$('piece-others').addEventListener('click', e => {
  const thumb = e.target.closest('[data-goto]');
  if (thumb) { highlightPiece(Number(thumb.dataset.goto)); renderPiece(Number(thumb.dataset.goto)); }
});
$('piece-add').addEventListener('click', addPieceToBag);
$('piece-close').addEventListener('click', () => $('piece').close());
$('piece-full').addEventListener('click', () => {
  $('piece').close();
  $('size').focus();
});
$('piece').addEventListener('click', e => { if (e.target === $('piece')) $('piece').close(); }); // clique fora
$('piece').addEventListener('close', () => highlightPiece(null));

document.addEventListener('keydown', e => {
  if (e.target.matches('select, input') || document.querySelector('dialog[open]')) return;
  if (e.key === 'Escape') setFocus(false);
  if (e.key === 'ArrowRight') go(active + 1);
  if (e.key === 'ArrowLeft') go(active - 1);
});

/* =========================================================
   Arrastar com rato ou dedo
   A órbita segue o ponteiro em tempo real; ao largar, continua com a
   inércia do gesto e assenta no modelo mais próximo.
   ========================================================= */
const DRAG = {
  threshold: 6,      // px antes de contar como arrasto (abaixo disto é um clique)
  stepRatio: 0.22,   // largura do palco que corresponde a passar um modelo
  inertia: 220,      // ms de "projeção" da velocidade ao largar
  maxFling: 3,       // máximo de modelos que a inércia acrescenta
};
let drag = null;     // { id, startX, startRot, moved, samples: [{x, t}] }
let swiped = false;  // impede o clique que o navegador dispara no fim de um arrasto

const pxPerStep = () => Math.max(70, $('models').clientWidth * DRAG.stepRatio);

function setActiveFromRotation(rot) {
  interacted = true;   // arrastar também conta como navegação
  const n = view.length;
  if (!n) return;
  const index = ((Math.round(rot) % n) + n) % n;
  if (index !== active) {
    active = index;
    activePiece = null;
    markSelected();
    renderPanel();
  }
}

$('models').addEventListener('pointerdown', e => {
  if (focused || e.button > 0 || !view.length) return;            // só botão principal; na vista ampliada não arrasta
  if (e.pointerType === 'mouse') e.preventDefault(); // evita selecionar texto / arrastar a imagem
  anim = null;                                     // agarra a órbita onde estiver, mesmo a meio de uma animação
  drag = { id: e.pointerId, startX: e.clientX, startRot: rotation, moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
  swiped = false;
});

$('models').addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.startX;
  if (!drag.moved) {
    if (Math.abs(dx) < DRAG.threshold) return;
    drag.moved = true;
    try { $('models').setPointerCapture(e.pointerId); } catch { /* ponteiro já libertado */ }
    $('models').classList.add('dragging');
    $('pins').classList.add('moving');
  }
  rotation = drag.startRot - dx / pxPerStep();
  placeModels();
  setActiveFromRotation(rotation);                 // o painel acompanha o modelo que passa à frente
  drag.samples.push({ x: e.clientX, t: e.timeStamp });
  if (drag.samples.length > 6) drag.samples.shift();
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { moved, samples } = drag;
  drag = null;
  $('models').classList.remove('dragging');
  if (!moved) {
    if (anim === null && rotation !== targetRotation) rotateTo(targetRotation); // toque a meio de uma animação: retoma
    return;
  }
  swiped = true;

  // Velocidade do gesto (px/ms) nos últimos instantes → inércia
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = Math.max(last.t - first.t, 1);
  const velocity = (last.x - first.x) / dt;
  const fling = -(velocity * DRAG.inertia) / pxPerStep();
  const projected = rotation + Math.max(-DRAG.maxFling, Math.min(DRAG.maxFling, fling));
  const target = Math.round(projected);

  setActiveFromRotation(target);
  const distance = Math.abs(target - rotation);
  rotateTo(target, Math.min(900, 320 + distance * 260));
}
$('models').addEventListener('pointerup', endDrag);
$('models').addEventListener('pointercancel', endDrag);

// Trackpad / roda horizontal: um modelo por gesto
let wheelAccum = 0;
let wheelLock = 0;
$('models').addEventListener('wheel', e => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;  // deslocação vertical continua a fazer scroll à página
  e.preventDefault();
  if (focused || e.timeStamp < wheelLock) return;
  wheelAccum += e.deltaX;
  if (Math.abs(wheelAccum) > 40) {
    go(active + Math.sign(wheelAccum));
    wheelAccum = 0;
    wheelLock = e.timeStamp + 350;
  }
}, { passive: false });

$('add').addEventListener('click', () => {
  const look = currentLook();
  if (!look) return;
  const needsSize = look.pieces.some(clothes);
  const needsShoe = look.pieces.some(p => p.kind === 'shoes');
  if ((needsSize && $('size').disabled) || (needsShoe && $('shoe').disabled)) {
    message('As peças deste look não têm um tamanho em comum: compra-as em separado.'); return;
  }
  if (needsSize && !$('size').value) { message('Escolhe primeiro o tamanho da roupa.'); $('size').focus(); return; }
  if (needsShoe && !$('shoe').value) { message('Escolhe o número do calçado.'); $('shoe').focus(); return; }
  bag.push({ ...lookRef(), size: needsSize ? $('size').value : '', shoe: needsShoe ? $('shoe').value : '' });
  saveBag();
  message(`${currentLook().name} adicionado ao cesto.`);
});

$('bag').addEventListener('click', () => { updateBag(); $('cart').showModal(); });
$('close').addEventListener('click', () => $('cart').close());
$('clear').addEventListener('click', () => { bag = []; saveBag(); });
$('cart-items').addEventListener('click', e => {
  if (e.target.dataset.remove !== undefined) {
    bag.splice(Number(e.target.dataset.remove), 1);
    saveBag();
  }
});

$('categories').addEventListener('click', e => {
  const tab = e.target.closest('[data-cat]');
  if (tab && tab.dataset.cat !== category) setCategory(tab.dataset.cat);
});
window.addEventListener('hashchange', () => {
  if (location.hash.includes('=')) return;   // parâmetros de autenticação, não uma categoria
  const id = location.hash.slice(1) || 'all';
  if (id !== category) setCategory(id);
});

init();
updateBag();
