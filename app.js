'use strict';

/* =========================================================
   Dados — catálogo de peças e corpos + tabela de looks.
   kind: top | pants | shoes · style controla a forma no SVG.
   ========================================================= */
const TOPS = {
  greySweat:  { kind: 'top', style: 'sweater', name: 'Sweatshirt Heavyweight', colorName: 'Cinzento mescla', fabric: 'algodão', color: '#8b8f96', price: 44.9 },
  greenKnit:  { kind: 'top', style: 'sweater', name: 'Camisola Raglan', colorName: 'Verde musgo', fabric: 'lã merino', color: '#5d7a4c', price: 54.9 },
  rustSweat:  { kind: 'top', style: 'sweater', name: 'Sweatshirt Heavyweight', colorName: 'Terracota', fabric: 'algodão', color: '#8a3f2d', price: 44.9 },
  navyKnit:   { kind: 'top', style: 'sweater', name: 'Camisola Merino', colorName: 'Azul-marinho', fabric: 'lã merino', color: '#2e3a55', price: 59.9 },
  creamCable: { kind: 'top', style: 'sweater', name: 'Camisola Cable', colorName: 'Cru', fabric: 'lã', color: '#e9e2d0', price: 64.9 },
  blackSweat: { kind: 'top', style: 'sweater', name: 'Sweatshirt Heavyweight', colorName: 'Preto', fabric: 'algodão', color: '#1f2023', price: 44.9 },
  oatSweat:   { kind: 'top', style: 'sweater', name: 'Sweatshirt Heavyweight', colorName: 'Aveia', fabric: 'algodão', color: '#c9b79a', price: 44.9 },
  wineKnit:   { kind: 'top', style: 'sweater', name: 'Camisola Merino', colorName: 'Bordeaux', fabric: 'lã merino', color: '#5e2430', price: 59.9 },
  skySweat:   { kind: 'top', style: 'sweater', name: 'Sweatshirt Loopback', colorName: 'Azul céu', fabric: 'algodão', color: '#9db7cf', price: 49.9 },
  whiteTee:   { kind: 'top', style: 'tee', name: 'T-shirt Oversized', colorName: 'Branco natural', fabric: '240 g', color: '#f2f2ee', price: 24.9 },
  blackTee:   { kind: 'top', style: 'tee', name: 'T-shirt Boxy', colorName: 'Preto', fabric: 'algodão orgânico', color: '#232327', price: 27.9 },
  sageTee:    { kind: 'top', style: 'tee', name: 'T-shirt Oversized', colorName: 'Salva', fabric: '240 g', color: '#a9b69a', price: 24.9 },
  sandTee:    { kind: 'top', style: 'tee', name: 'T-shirt Boxy', colorName: 'Areia', fabric: 'algodão orgânico', color: '#d8c7a8', price: 27.9 },
  brickTee:   { kind: 'top', style: 'tee', name: 'T-shirt Oversized', colorName: 'Tijolo', fabric: '240 g', color: '#a2503a', price: 24.9 },
  navyTee:    { kind: 'top', style: 'tee', name: 'T-shirt Boxy', colorName: 'Azul-marinho', fabric: 'algodão orgânico', color: '#2c3650', price: 27.9 },
  greyTee:    { kind: 'top', style: 'tee', name: 'T-shirt Oversized', colorName: 'Cinzento claro', fabric: '240 g', color: '#b4b7bb', price: 24.9 },
  mustardTee: { kind: 'top', style: 'tee', name: 'T-shirt Boxy', colorName: 'Mostarda', fabric: 'algodão orgânico', color: '#c99a3a', price: 27.9 },
};

const PANTS = {
  midJeans:   { kind: 'pants', style: 'baggy', name: 'Jeans Baggy', colorName: 'Lavagem média', color: '#58799c', price: 59.9 },
  washJeans:  { kind: 'pants', style: 'baggy', name: 'Jeans Baggy', colorName: 'Lavagem clara gasta', color: '#8ea2a6', price: 59.9 },
  iceJeans:   { kind: 'pants', style: 'baggy', name: 'Jeans Wide Leg', colorName: 'Azul gelo', color: '#8fb0d4', price: 64.9 },
  rawJeans:   { kind: 'pants', style: 'baggy', name: 'Jeans Wide Leg', colorName: 'Ganga crua', color: '#2f3d55', price: 64.9 },
  blackJeans: { kind: 'pants', style: 'baggy', name: 'Jeans Baggy', colorName: 'Preto lavado', color: '#2b2c2f', price: 59.9 },
  ecruCanvas: { kind: 'pants', style: 'baggy', name: 'Calças Carpenter', colorName: 'Cru', color: '#ddd5c2', price: 69.9 },
  brownChino: { kind: 'pants', style: 'straight', name: 'Calças Relaxed', colorName: 'Castanho', color: '#7b5637', price: 54.9 },
  greyChino:  { kind: 'pants', style: 'straight', name: 'Calças Relaxed', colorName: 'Cinzento pedra', color: '#8a8e8e', price: 54.9 },
  oliveChino: { kind: 'pants', style: 'straight', name: 'Calças Utility', colorName: 'Azeitona', color: '#5c5f3b', price: 59.9 },
  blackTrous: { kind: 'pants', style: 'straight', name: 'Calças de Pinças', colorName: 'Preto', color: '#26272a', price: 69.9 },
  khakiChino: { kind: 'pants', style: 'straight', name: 'Calças Relaxed', colorName: 'Caqui', color: '#b19e7a', price: 54.9 },
  navyTrous:  { kind: 'pants', style: 'straight', name: 'Calças de Pinças', colorName: 'Azul-marinho', color: '#2f3a52', price: 69.9 },
  creamChino: { kind: 'pants', style: 'straight', name: 'Calças Relaxed', colorName: 'Creme', color: '#e4dccb', price: 54.9 },
};

const SHOES = {
  court:  { kind: 'shoes', name: 'Sapatilhas Court', colorName: 'Branco', color: '#ecebe6', price: 69.9 },
  skate:  { kind: 'shoes', name: 'Sapatilhas Skate', colorName: 'Preto', color: '#2c2c2e', price: 64.9 },
  derby:  { kind: 'shoes', name: 'Sapatos Derby', colorName: 'Pele castanha', color: '#6b4528', price: 89.9 },
  runner: { kind: 'shoes', name: 'Sapatilhas Runner', colorName: 'Off-white', color: '#e3e1d9', price: 79.9 },
  boot:   { kind: 'shoes', name: 'Botas Chelsea', colorName: 'Preto', color: '#1e1e20', price: 99.9 },
  suede:  { kind: 'shoes', name: 'Sapatilhas Camurça', colorName: 'Cinzento', color: '#8c8a86', price: 74.9 },
  loafer: { kind: 'shoes', name: 'Mocassins', colorName: 'Bordeaux', color: '#4a1f22', price: 94.9 },
  trail:  { kind: 'shoes', name: 'Sapatilhas Trail', colorName: 'Verde', color: '#4f6b4a', price: 84.9 },
};

const BODIES = [
  { skin: '#dcab86', hair: 'short', hairColor: '#2a211b' },
  { skin: '#6b4330', hair: 'locs', hairColor: '#1d1714' },
  { skin: '#e2b593', hair: 'mop', hairColor: '#2b231d' },
  { skin: '#7a4c35', hair: 'buzz', hairColor: '#1a1512', glasses: true },
  { skin: '#e4b998', hair: 'short', hairColor: '#3a2a20' },
  { skin: '#f0c8a8', hair: 'mop', hairColor: '#8a5a2e' },
  { skin: '#a8714f', hair: 'buzz', hairColor: '#241a14' },
  { skin: '#c8946c', hair: 'short', hairColor: '#141110', glasses: true },
  { skin: '#8d5a3b', hair: 'locs', hairColor: '#2a1d16' },
  { skin: '#efc9a4', hair: 'buzz', hairColor: '#c9a36a' },
];

// [nome, corpo (índice em BODIES), parte de cima, calças, calçado, descrição opcional]
const LOOK_TABLE = [
  ['Off Duty', 0, 'greySweat', 'midJeans', 'court', 'Malha cinzenta e ganga larga.'],
  ['Gallery Opening', 1, 'whiteTee', 'washJeans', 'skate', 'Branco limpo, ganga gasta.'],
  ['Everyday Form', 2, 'greenKnit', 'brownChino', 'derby', 'Malha macia, tons de terra.'],
  ['City Escape', 3, 'blackTee', 'iceJeans', 'court', 'Preto, azul claro e óculos escuros.'],
  ['The Weekend', 4, 'rustSweat', 'greyChino', 'runner', 'Terracota sobre cinzento.'],
  ['Studio Hours', 5, 'creamCable', 'rawJeans', 'boot'],
  ['Late Checkout', 6, 'sandTee', 'oliveChino', 'suede'],
  ['Sunday Market', 7, 'sageTee', 'ecruCanvas', 'runner'],
  ['Night Shift', 8, 'blackSweat', 'blackJeans', 'boot'],
  ['Coastal Drift', 9, 'skySweat', 'creamChino', 'court'],
  ['Quiet Luxury', 2, 'navyKnit', 'khakiChino', 'loafer'],
  ['Rooftop', 1, 'mustardTee', 'midJeans', 'court'],
  ['Commute', 4, 'greyTee', 'navyTrous', 'derby'],
  ['Record Store', 3, 'brickTee', 'blackJeans', 'skate'],
  ['Slow Morning', 0, 'oatSweat', 'greyChino', 'suede'],
  ['Fieldwork', 6, 'greenKnit', 'ecruCanvas', 'trail'],
  ['Downtown', 7, 'blackTee', 'blackTrous', 'court'],
  ['Second Coffee', 5, 'brickTee', 'khakiChino', 'runner'],
  ['Afterglow', 8, 'wineKnit', 'washJeans', 'loafer'],
  ['Concrete', 9, 'greySweat', 'blackTrous', 'boot'],
  ['Park Bench', 2, 'sageTee', 'brownChino', 'court'],
  ['Long Weekend', 1, 'oatSweat', 'iceJeans', 'runner'],
  ['Workshop', 6, 'navyTee', 'oliveChino', 'boot'],
  ['Night Bus', 3, 'navyKnit', 'rawJeans', 'skate'],
  ['Soft Utility', 4, 'sandTee', 'greyChino', 'trail'],
  ['Harbour', 0, 'navyTee', 'creamChino', 'derby'],
  ['Daybreak', 9, 'whiteTee', 'khakiChino', 'suede'],
  ['Metro', 7, 'greyTee', 'midJeans', 'skate'],
  ['First Frost', 5, 'creamCable', 'brownChino', 'boot'],
  ['Last Light', 8, 'rustSweat', 'rawJeans', 'court'],
];

/* ---------- Peças extra para as categorias ---------- */
Object.assign(TOPS, {
  whiteShirt:   { kind: 'top', style: 'shirt', name: 'Camisa Oxford', colorName: 'Branco', fabric: 'algodão', color: '#f4f3ef', price: 49.9 },
  skyShirt:     { kind: 'top', style: 'shirt', name: 'Camisa Oxford', colorName: 'Azul claro', fabric: 'algodão', color: '#b9cde2', price: 49.9 },
  blackShirt:   { kind: 'top', style: 'shirt', name: 'Camisa de Cetim', colorName: 'Preto', fabric: 'viscose', color: '#1c1c1f', price: 59.9 },
  wineShirt:    { kind: 'top', style: 'shirt', name: 'Camisa de Seda', colorName: 'Bordeaux', fabric: 'seda', color: '#5a1f2b', price: 79.9 },
  blackTank:    { kind: 'top', style: 'tank', name: 'Camisola de Alças Training', colorName: 'Preto', fabric: 'dry-fit', color: '#1f2124', price: 24.9 },
  greyTank:     { kind: 'top', style: 'tank', name: 'Camisola de Alças Training', colorName: 'Cinzento mescla', fabric: 'dry-fit', color: '#9a9ea4', price: 24.9 },
  navyTank:     { kind: 'top', style: 'tank', name: 'Camisola de Alças Training', colorName: 'Azul-marinho', fabric: 'dry-fit', color: '#2a3550', price: 24.9 },
  limeTee:      { kind: 'top', style: 'tee', name: 'T-shirt Training', colorName: 'Lima', fabric: 'dry-fit', color: '#c6d64a', price: 29.9 },
  orangeRunTee: { kind: 'top', style: 'tee', name: 'T-shirt Running', colorName: 'Laranja', fabric: 'malha técnica', color: '#e0723a', price: 34.9 },
  blueRunTee:   { kind: 'top', style: 'tee', name: 'T-shirt Running', colorName: 'Azul elétrico', fabric: 'malha técnica', color: '#3a6fd8', price: 34.9 },
  whiteRunTank: { kind: 'top', style: 'tank', name: 'Camisola de Alças Running', colorName: 'Branco', fabric: 'malha técnica', color: '#f1f1ee', price: 29.9 },
  linenCamp:    { kind: 'top', style: 'camp', name: 'Camisa Resort', colorName: 'Linho cru', fabric: 'linho', color: '#e6dcc6', price: 54.9 },
  terraCamp:    { kind: 'top', style: 'camp', name: 'Camisa Resort', colorName: 'Terracota', fabric: 'linho', color: '#c4673f', price: 54.9 },
  sageCamp:     { kind: 'top', style: 'camp', name: 'Camisa Resort', colorName: 'Salva', fabric: 'linho', color: '#9fb39a', price: 54.9 },
});

Object.assign(PANTS, {
  charcoalSuit:  { kind: 'pants', style: 'straight', name: 'Calças de Fato', colorName: 'Antracite', color: '#34363a', price: 89.9 },
  blackJogger:   { kind: 'pants', style: 'jogger', name: 'Calças Jogger Tech', colorName: 'Preto', color: '#222326', price: 49.9 },
  greyJogger:    { kind: 'pants', style: 'jogger', name: 'Calças Jogger Tech', colorName: 'Cinzento', color: '#8d9196', price: 49.9 },
  blackShorts:   { kind: 'pants', style: 'shorts', name: 'Calções Training', colorName: 'Preto', color: '#222326', price: 29.9 },
  navyRunShorts: { kind: 'pants', style: 'runshorts', name: 'Calções Running', colorName: 'Azul-marinho', color: '#283350', price: 34.9 },
  blackRunShorts:{ kind: 'pants', style: 'runshorts', name: 'Calções Running', colorName: 'Preto', color: '#1e1f22', price: 34.9 },
  swimBlue:      { kind: 'pants', style: 'runshorts', name: 'Calções de Banho', colorName: 'Azul mar', color: '#2f7fa8', price: 39.9 },
  swimCoral:     { kind: 'pants', style: 'runshorts', name: 'Calções de Banho', colorName: 'Coral', color: '#e27a63', price: 39.9 },
  linenShorts:   { kind: 'pants', style: 'shorts', name: 'Bermudas de Linho', colorName: 'Areia', color: '#d9c9a6', price: 44.9 },
  stoneShorts:   { kind: 'pants', style: 'shorts', name: 'Bermudas Chino', colorName: 'Pedra', color: '#b8b2a3', price: 39.9 },
});

Object.assign(SHOES, {
  sandal:       { kind: 'shoes', style: 'sandal', name: 'Sandálias de Couro', colorName: 'Castanho', color: '#6e4a2f', price: 59.9 },
  slide:        { kind: 'shoes', style: 'sandal', name: 'Chinelos Slide', colorName: 'Preto', color: '#1d1d1f', price: 29.9 },
  runnerOrange: { kind: 'shoes', name: 'Sapatilhas Running', colorName: 'Laranja', color: '#e46a32', price: 119.9 },
  runnerBlue:   { kind: 'shoes', name: 'Sapatilhas Running', colorName: 'Azul', color: '#3c63c9', price: 119.9 },
  trainer:      { kind: 'shoes', name: 'Sapatilhas Training', colorName: 'Preto', color: '#232325', price: 89.9 },
  trainerWhite: { kind: 'shoes', name: 'Sapatilhas Training', colorName: 'Branco', color: '#efefec', price: 89.9 },
});

/* ---------- Categorias ----------
   Cada categoria tem looks próprios (mesmo formato de LOOK_TABLE) e pode
   incluir looks da coleção principal pelo nome (`include`). */
const CATEGORIES = [
  { id: 'all', label: 'Tudo', blurb: 'conjuntos, do primeiro ao último pormenor.' },
  {
    id: 'date-night', label: 'Date Night', blurb: 'conjuntos para uma noite especial.',
    include: ['Gallery Opening', 'Quiet Luxury', 'Downtown', 'Afterglow'],
    looks: [
      ['Candlelight', 2, 'blackShirt', 'charcoalSuit', 'loafer', 'Cetim preto e antracite.'],
      ['Wine Bar', 7, 'wineShirt', 'blackTrous', 'boot', 'Seda bordeaux com preto.'],
      ['Dinner Reservation', 4, 'whiteShirt', 'navyTrous', 'derby', 'Oxford branca, pinças azul-marinho.'],
      ['Late Show', 3, 'blackTee', 'charcoalSuit', 'boot', 'Tudo escuro, corte limpo.'],
      ['Rooftop Bar', 9, 'skyShirt', 'creamChino', 'loafer', 'Azul claro e creme ao fim do dia.'],
      ['Slow Dance', 1, 'navyKnit', 'blackTrous', 'derby', 'Merino e pele castanha.'],
    ],
  },
  {
    id: 'gym', label: 'Gym', blurb: 'conjuntos para treinar com estilo.',
    looks: [
      ['Leg Day', 6, 'blackTank', 'blackShorts', 'trainer', 'Preto total, pronto a treinar.'],
      ['Push Pull', 0, 'greyTank', 'blackJogger', 'trainerWhite', 'Alças cinzentas e jogger tech.'],
      ['Morning Lift', 3, 'limeTee', 'blackShorts', 'trainer', 'Um toque de lima para acordar.'],
      ['Cooldown', 5, 'greySweat', 'greyJogger', 'trainerWhite', 'Conforto para o fim do treino.'],
      ['Power Hour', 8, 'navyTank', 'greyJogger', 'trainer', 'Azul-marinho e cinzento.'],
      ['Studio Class', 9, 'blackTee', 'blackJogger', 'trainerWhite', 'Preto simples, sapatilha branca.'],
    ],
  },
  {
    id: 'beach', label: 'Beach', blurb: 'conjuntos para dias de praia.',
    looks: [
      ['Shoreline', 0, 'linenCamp', 'swimBlue', 'slide', 'Linho cru e azul mar.'],
      ['Golden Hour', 8, 'terraCamp', 'linenShorts', 'sandal', 'Terracota ao pôr do sol.'],
      ['Boardwalk', 2, 'whiteTee', 'stoneShorts', 'sandal', 'Branco e pedra, sem esforço.'],
      ['Salt Water', 7, 'sageCamp', 'swimCoral', 'slide', 'Salva com coral.'],
      ['Beach Club', 1, 'whiteShirt', 'linenShorts', 'sandal', 'Camisa branca e bermudas de linho.'],
      ['Low Tide', 5, 'sandTee', 'swimBlue', 'slide', 'Areia e azul, simples.'],
    ],
  },
  {
    id: 'run', label: 'Run', blurb: 'conjuntos para correr.',
    looks: [
      ['Tempo Run', 6, 'orangeRunTee', 'blackRunShorts', 'runnerOrange', 'Laranja para ser visto.'],
      ['Long Run', 4, 'blueRunTee', 'navyRunShorts', 'runnerBlue', 'Azul para os quilómetros longos.'],
      ['Intervals', 3, 'whiteRunTank', 'blackRunShorts', 'runnerBlue', 'Leve e fresco para séries.'],
      ['Recovery Jog', 9, 'greyTee', 'greyJogger', 'runner', 'Ritmo leve, tons neutros.'],
      ['Sunrise 10K', 1, 'orangeRunTee', 'navyRunShorts', 'runnerOrange', 'Laranja e azul-marinho ao nascer do sol.'],
      ['Trail Day', 0, 'blueRunTee', 'blackJogger', 'trail', 'Pronto para o trilho.'],
    ],
  },
];

const withDetail = p => ({ ...p, detail: p.fabric ? `${p.colorName} · ${p.fabric}` : p.colorName });

const makeLook = ([name, body, top, pants, shoes, mood], cats) => ({
  name,
  cats,
  mood: mood || `${TOPS[top].colorName} com ${PANTS[pants].colorName.toLowerCase()}.`,
  body: BODIES[body],
  pieces: [withDetail(TOPS[top]), withDetail(PANTS[pants]), withDetail(SHOES[shoes])],
});

// A coleção principal vem primeiro (os índices guardados no saco continuam válidos).
const LOOKS = LOOK_TABLE.map(row => makeLook(row, ['all']));
CATEGORIES.forEach(cat => {
  (cat.include || []).forEach(name => LOOKS.find(l => l.name === name)?.cats.push(cat.id));
  (cat.looks || []).forEach(row => LOOKS.push(makeLook(row, ['all', cat.id])));
});

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const SHOE_SIZES = ['38', '39', '40', '41', '42', '43', '44', '45', '46'];
const STORAGE_KEY = 'forma-bag-v2';

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
const pad = n => String(n).padStart(2, '0');
const lookTotal = look => look.pieces.reduce((sum, p) => sum + p.price, 0);

/* =========================================================
   Ilustrações SVG (viewBox 240×600). Substitui figure() por
   <img> quando tiveres fotografias de corpo inteiro.
   ========================================================= */
const shade = d => `<path d="${d}" fill="url(#shade)"/>`;
const fill = (d, color, extra = '') => `<path d="${d}" fill="${color}" ${extra}/>`;
const lines = (d, color = '#000', opacity = 0.14, width = 2) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round"/>`;

const SHAPES = {
  shoes: [
    'M70 552H114L116 566Q116 576 106 576H66Q57 576 60 566Z',
    'M126 552H170L180 566Q183 576 174 576H134Q124 576 124 566Z',
  ],
  pants: {
    baggy: {
      d: 'M74 280H166L172 400L180 552Q154 562 127 557L122 356H118L113 557Q86 562 60 552L68 400Z',
      creases: 'M95 300L91 548M145 300L149 548',
      folds: 'M64 518Q88 530 112 516M128 516Q152 530 176 518M62 540Q88 550 113 536M127 536Q152 550 178 540',
    },
    straight: {
      d: 'M78 280H162L165 400L166 554Q146 559 126 556L121 352H119L114 556Q94 559 74 554L75 400Z',
      creases: 'M96 300L94 550M144 300L146 550',
      folds: 'M76 532Q95 540 114 530M126 530Q145 540 165 532',
    },
    jogger: {
      d: 'M78 280H162L160 400L152 552Q138 557 124 553L121 352H119L116 553Q102 557 88 552L80 400Z',
      creases: 'M98 300L102 540M142 300L138 540',
      folds: 'M89 532L116 534M124 534L151 532M84 470Q100 478 117 470M123 470Q140 478 156 470',
    },
    shorts: {   // bermudas / calções de treino (até ao joelho)
      d: 'M74 280H166L172 400Q150 408 126 402L121 352H119L114 402Q90 408 68 400Z',
      legs: ['M82 396L86 552H112L114 398Z', 'M126 398L128 552H154L158 396Z'],
      creases: 'M95 300L92 398M145 300L148 398',
      folds: 'M70 390Q92 398 114 392M126 392Q148 398 170 390',
    },
    runshorts: { // calções de corrida / banho (acima do joelho)
      d: 'M74 280H166L170 372Q150 378 127 372L121 340H119L113 372Q90 378 70 372Z',
      legs: ['M80 366L86 552H112L115 370Z', 'M125 370L128 552H154L160 366Z'],
      creases: 'M76 330L86 372M164 330L154 372',
      folds: 'M72 362Q92 370 113 364M127 364Q148 370 168 362',
    },
  },
  top: {
    sweater: {
      body: 'M100 102Q120 116 140 102L168 112Q178 117 178 134L176 296Q120 308 64 296L62 134Q62 117 72 112Z',
      sleeves: [
        'M72 112Q58 116 55 140L46 288Q54 296 66 293L74 170Z',
        'M168 112Q182 116 185 140L194 288Q186 296 174 293L166 170Z',
      ],
      hem: 'M64 282Q120 294 176 282L176 296Q120 308 64 296Z',
      details: 'M100 102Q120 118 140 102M47 278L66 282M193 278L174 282M84 160L82 280M156 160L158 280',
      hands: [[56, 307], [184, 307]],
    },
    tee: {
      body: 'M100 102Q120 112 140 102L170 112Q180 118 180 136L178 292Q120 300 62 292L60 136Q60 118 70 112Z',
      sleeves: [
        'M70 112Q52 118 48 146L40 206Q56 214 74 208L76 160Z',
        'M170 112Q188 118 192 146L200 206Q184 214 166 208L164 160Z',
      ],
      arms: [
        'M45 205L43 292Q50 298 60 294L70 209Z',
        'M195 205L197 292Q190 298 180 294L170 209Z',
      ],
      details: 'M100 102Q120 114 140 102M86 150L84 286M154 150L156 286',
      hands: [[52, 306], [188, 306]],
    },
    tank: {
      body: 'M104 100Q120 114 136 100L150 106Q156 110 158 128L162 294Q120 302 78 294L82 128Q84 110 90 106Z',
      sleeves: [],
      arms: [
        'M92 106Q68 108 60 136L46 292Q53 298 62 294L80 160Z',
        'M148 106Q172 108 180 136L194 292Q187 298 178 294L160 160Z',
      ],
      details: 'M104 100Q120 122 136 100M90 106Q98 130 84 150M150 106Q142 130 156 150',
      hands: [[54, 306], [186, 306]],
    },
  },
  collar: 'M100 102L110 126L120 110L130 126L140 102L132 99L120 108L108 99Z',
  hair: {
    short: 'M97 54Q93 24 120 24Q148 23 144 54Q141 40 130 37Q114 34 101 42Z',
    buzz: 'M99 48Q100 27 120 27Q141 27 141 48Q131 38 120 38Q109 38 99 48Z',
    mop: 'M95 62Q88 22 120 21Q153 21 146 62Q143 46 134 42Q122 50 104 44Q98 50 95 62Z',
    locs: 'M97 52Q95 24 120 24Q146 24 143 52Q132 36 120 36Q108 36 97 52Z',
  },
};

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// Estilos que reutilizam a forma de outro e acrescentam gola + botões
const TOP_BASE = { shirt: 'sweater', camp: 'tee' };

function figure(look) {
  const { body } = look;
  const [top, pants, shoes] = look.pieces;
  const buttoned = top.style in TOP_BASE;
  const t = SHAPES.top[TOP_BASE[top.style] || top.style];
  const p = SHAPES.pants[pants.style];
  const lightTop = luminance(top.color) > 0.75;

  const legsSvg = (p.legs || []).map(d => fill(d, body.skin) + shade(d)).join('');

  const shoesSvg = shoes.style === 'sandal'
    ? SHAPES.shoes.map(d => fill(d, body.skin) + shade(d)).join('') +          // pés à mostra
      lines('M72 559H113M127 559H176', shoes.color, 1, 6) +                     // tiras
      lines('M60 575H115M126 575H182', shoes.color, 1, 4)                       // sola
    : SHAPES.shoes.map(d => fill(d, shoes.color) + shade(d)).join('') +
      lines('M62 572H112M128 572H178', '#000', 0.25, 2);

  const pantsSvg = legsSvg + fill(p.d, pants.color) + shade(p.d) +
    lines(p.creases, '#fff', 0.14, 3) + lines(p.folds, '#000', 0.16, 2);

  const armsSvg = (t.arms || []).map(d => fill(d, body.skin) + shade(d)).join('') +
    t.hands.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="15" fill="${body.skin}"/>`).join('');

  const torsoSvg = t.sleeves.map(d => fill(d, top.color) + shade(d)).join('') +
    fill(t.body, top.color) + shade(t.body) +
    (t.hem && !buttoned ? fill(t.hem, '#000', 'fill-opacity=".1"') : '') +
    lines(t.details, '#000', lightTop ? 0.1 : 0.18, 3) +
    (buttoned
      ? fill(SHAPES.collar, top.color) + lines(SHAPES.collar + 'M120 110V292', '#000', lightTop ? 0.16 : 0.3, 2) +
        [140, 172, 204, 236, 268].map(y => `<circle cx="123" cy="${y}" r="2.2" fill="#000" fill-opacity=".28"/>`).join('')
      : '');

  const locs = body.hair === 'locs'
    ? lines('M99 44L96 98M104 40L102 104M138 40L140 104M143 46L146 96M109 37L108 70M132 37L133 72', body.hairColor, 1, 6)
    : '';
  const glasses = body.glasses
    ? fill('M102 51H118V58Q110 63 102 58ZM122 51H138V58Q130 63 122 58Z', '#111') + lines('M118 53H122', '#111', 1, 2)
    : '';

  const headSvg =
    fill('M109 76H131L133 108Q120 116 107 108Z', body.skin) + shade('M109 76H131L133 108Q120 116 107 108Z') +
    `<ellipse cx="98" cy="58" rx="4" ry="7" fill="${body.skin}"/><ellipse cx="142" cy="58" rx="4" ry="7" fill="${body.skin}"/>` +
    `<ellipse cx="120" cy="54" rx="22" ry="28" fill="${body.skin}"/>` +
    `<ellipse cx="120" cy="54" rx="22" ry="28" fill="url(#shade)"/>` +
    locs + fill(SHAPES.hair[body.hair], body.hairColor) + glasses;

  return `<svg viewBox="0 0 240 600" aria-hidden="true">
    <ellipse cx="120" cy="576" rx="90" ry="11" fill="url(#floor)"/>
    ${shoesSvg}${pantsSvg}${armsSvg}${torsoSvg}${headSvg}
  </svg>`;
}

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
  };
  const key = piece.kind === 'top' ? piece.style
    : piece.kind === 'pants' ? (isShorts(piece) ? 'shorts' : 'pants')
    : piece.style === 'sandal' ? 'sandal' : 'shoes';
  const d = paths[key];
  return `<svg viewBox="0 0 60 70" aria-hidden="true">
    <path d="${d}" fill="${piece.color}" stroke="#000" stroke-opacity=".12"/>
    <path d="${d}" fill="url(#shade)"/>
  </svg>`;
}

/* Posição dos pontos (em % da figura) */
const PIN_POSITIONS = { top: [50, 30], pants: [60, 70], shoes: [63, 94] };
const isShorts = piece => piece.style === 'shorts' || piece.style === 'runshorts';
const pinPosition = piece =>
  piece.kind === 'pants' && isShorts(piece) ? [60, piece.style === 'runshorts' ? 56 : 59] : PIN_POSITIONS[piece.kind];

/* Recorte da figura (viewBox x y largura altura) usado para ampliar cada peça no modelo */
const PIECE_CROP = { top: '20 70 200 250', pants: '4 268 232 290', shoes: '44 500 152 86' };
const KIND_LABEL = { top: 'Parte de cima', pants: 'Calças', shoes: 'Calçado' };
const kindLabel = piece => (piece.kind === 'pants' && isShorts(piece) ? 'Calções' : KIND_LABEL[piece.kind]);
const cropFor = piece => (piece.kind === 'pants' && isShorts(piece) ? '20 262 200 250' : PIECE_CROP[piece.kind]);
const sizesFor = piece => (piece.kind === 'shoes' ? SHOE_SIZES : SIZES);

/* =========================================================
   Estado
   ========================================================= */
let category = 'all';
let view = [];       // índices de LOOKS visíveis na categoria atual
let active = 0;      // posição em `view`
let activePiece = null;
const currentId = () => view[active];
const currentLook = () => LOOKS[view[active]];
let bag = loadBag();

function loadBag() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(x => {
      if (!Number.isInteger(x.look) || !LOOKS[x.look]) return false;
      if (x.type === 'piece') {
        const piece = LOOKS[x.look].pieces[x.piece];
        return Boolean(piece) && sizesFor(piece).includes(x.size);
      }
      return SIZES.includes(x.size) && SHOE_SIZES.includes(x.shoe); // conjunto completo
    });
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
  const slots = ORBIT.slots;  // espaçamento fixo na elipse, seja qual for o número de looks
  // Até onde se mostram modelos: 4,5 posições para cada lado, ou menos se a categoria for pequena
  // (o modelo que dá a volta, em ±n/2, desaparece em vez de saltar).
  const reach = Math.min(slots / 2 - 0.5, n / 2);
  modelEls.forEach((el, i) => {
    const off = orbitOffset(i, rotation);
    // Fora da órbita visível: fica escondido (sem custo de desenho).
    const fade = n > 1 ? clamp01(reach - Math.abs(off)) : 1;
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
  if (focused === on) return;
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
  $('look-title').textContent = look.name;
  $('look-mood').textContent = look.mood;
  $('look-number').textContent = pad(active + 1);
  $('products').innerHTML = look.pieces.map((p, i) => `
    <button type="button" class="product" data-piece="${i}">
      <span class="swatch">${icon(p)}</span>
      <span><span class="pname">${p.name}</span><span class="pdetail">${p.detail}</span></span>
      <strong>${money(p.price)}</strong>
    </button>`).join('');
  $('total').textContent = money(lookTotal(look));
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
  const preset = piece.kind === 'shoes' ? $('shoe').value : $('size').value;

  $('piece').dataset.piece = index;
  $('piece-zoom').innerHTML = figure(look).replace('viewBox="0 0 240 600"', `viewBox="${cropFor(piece)}"`);
  $('piece-zoom').classList.remove('enter');
  void $('piece-zoom').offsetWidth;
  $('piece-zoom').classList.add('enter');
  $('piece-kind').textContent = `${kindLabel(piece)} · look ${look.name}`;
  $('piece-name').textContent = piece.name;
  $('piece-detail').textContent = piece.detail;
  $('piece-price').textContent = money(piece.price);
  $('piece-size-label').textContent = piece.kind === 'shoes' ? 'Número' : 'Tamanho';
  $('piece-sizes').innerHTML = sizes.map(s => `
    <button type="button" class="size-chip${s === preset ? ' selected' : ''}" data-size="${s}"
      aria-pressed="${s === preset}">${s}</button>`).join('');
  $('piece-status').textContent = '';
  $('piece-others').innerHTML = look.pieces.map((p, i) => `
    <button type="button" class="piece-thumb${i === index ? ' active' : ''}" data-goto="${i}"
      aria-label="Ver ${p.name}" aria-current="${i === index}">${icon(p)}</button>`).join('');
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
  bag.push({ type: 'piece', look: currentId(), piece: index, size: chosen.dataset.size });
  saveBag();
  $('piece-status').textContent = `✓ ${piece.name} (${chosen.dataset.size}) adicionada ao cesto.`;
  $('piece-status').className = 'piece-status ok';
}

function go(index) {
  const n = view.length;
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

/* ---------- Categorias ---------- */
function renderTabs() {
  $('categories').innerHTML = CATEGORIES.map(c => {
    const count = c.id === 'all' ? LOOKS.length : LOOKS.filter(l => l.cats.includes(c.id)).length;
    return `<button type="button" class="cat" data-cat="${c.id}" aria-pressed="false">${c.label}<span>${count}</span></button>`;
  }).join('');
}

function setCategory(id, { animate = true } = {}) {
  if (!CATEGORIES.some(c => c.id === id)) id = 'all';
  const cat = CATEGORIES.find(c => c.id === id);
  category = id;
  view = LOOKS.map((_, i) => i).filter(i => LOOKS[i].cats.includes(id));

  setFocus(false, false);
  if ($('piece').open) $('piece').close();
  anim = null;
  active = id === 'all' ? Math.min(2, view.length - 1) : 0;
  activePiece = null;

  buildModels();
  markSelected();
  renderPanel();
  $('intro-text').innerHTML = `${view.length} ${cat.blurb}<br>Toca no modelo para o ampliar.`;
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
  count.textContent = bag.length;
  count.dataset.ready = '1';
  count.toggleAttribute('data-empty', bag.length === 0);
  $('bag').setAttribute('aria-label', `Abrir cesto (${bag.length} ${bag.length === 1 ? 'artigo' : 'artigos'})`);
  $('cart-items').innerHTML = bag.length
    ? bag.map((x, i) => {
      const look = LOOKS[x.look];
      if (x.type === 'piece') {
        const piece = look.pieces[x.piece];
        const sizeLabel = piece.kind === 'shoes' ? 'Número' : 'Tamanho';
        return `<div class="cart-row">
          <span class="cart-thumb">${icon(piece)}</span>
          <span class="cart-info">${piece.name}<br><small>${piece.detail} · ${sizeLabel} ${x.size} · ${money(piece.price)}</small></span>
          <button type="button" data-remove="${i}">Remover</button>
        </div>`;
      }
      return `<div class="cart-row">
        <span class="cart-thumb">${icon(look.pieces[0])}</span>
        <span class="cart-info">Conjunto ${look.name}<br><small>Roupa ${x.size} · Calçado ${x.shoe} · ${money(lookTotal(look))}</small></span>
        <button type="button" data-remove="${i}">Remover</button>
      </div>`;
    }).join('')
    : '<p class="muted">O teu cesto está vazio.</p>';
  const total = bag.reduce((sum, x) =>
    sum + (x.type === 'piece' ? LOOKS[x.look].pieces[x.piece].price : lookTotal(LOOKS[x.look])), 0);
  $('cart-total').textContent = money(total);
  $('cart-total-row').hidden = !bag.length;
  $('clear').hidden = !bag.length;
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
  const n = view.length;
  const index = ((Math.round(rot) % n) + n) % n;
  if (index !== active) {
    active = index;
    activePiece = null;
    markSelected();
    renderPanel();
  }
}

$('models').addEventListener('pointerdown', e => {
  if (focused || e.button > 0) return;            // só botão principal; na vista ampliada não arrasta
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
  if (!$('size').value) { message('Escolhe primeiro o tamanho da roupa.'); $('size').focus(); return; }
  if (!$('shoe').value) { message('Escolhe o número do calçado.'); $('shoe').focus(); return; }
  bag.push({ look: currentId(), size: $('size').value, shoe: $('shoe').value });
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
