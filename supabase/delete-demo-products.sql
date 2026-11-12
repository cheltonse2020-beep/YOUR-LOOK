-- =====================================================================
-- YOUR LOOK — eliminar os produtos de DEMONSTRAÇÃO (os 68 do antigo products.sql)
-- Executar no SQL Editor DEPOIS de admin.sql. Pode ser executado mais de uma vez.
--
-- O que faz, para cada produto de demonstração:
--   • está em algum look (rascunho, publicado ou arquivado) → NÃO mexe (o look continua igual);
--   • está em alguma encomenda antiga                         → ARQUIVA (fica escondido; a encomenda
--                                                              precisa dele para mostrar o que foi comprado);
--   • não está em nenhum                                      → APAGA (com as suas variantes de stock).
-- Não toca em produtos criados no painel, em looks nem em encomendas.
-- No fim mostra um resumo e os produtos de demonstração que ficaram.
-- O antigo products.sql foi retirado do projeto, para não voltar a criá-los.
-- =====================================================================
begin;

create temporary table demo_skus (sku text primary key) on commit drop;
insert into demo_skus (sku) values
  ('top:greySweat'), ('top:greenKnit'), ('top:rustSweat'), ('top:navyKnit'), ('top:creamCable'),
  ('top:blackSweat'), ('top:oatSweat'), ('top:wineKnit'), ('top:skySweat'), ('top:whiteTee'),
  ('top:blackTee'), ('top:sageTee'), ('top:sandTee'), ('top:brickTee'), ('top:navyTee'), ('top:greyTee'),
  ('top:mustardTee'), ('top:whiteShirt'), ('top:skyShirt'), ('top:blackShirt'), ('top:wineShirt'),
  ('top:blackTank'), ('top:greyTank'), ('top:navyTank'), ('top:limeTee'), ('top:orangeRunTee'),
  ('top:blueRunTee'), ('top:whiteRunTank'), ('top:linenCamp'), ('top:terraCamp'), ('top:sageCamp'),
  ('pants:midJeans'), ('pants:washJeans'), ('pants:iceJeans'), ('pants:rawJeans'), ('pants:blackJeans'),
  ('pants:ecruCanvas'), ('pants:brownChino'), ('pants:greyChino'), ('pants:oliveChino'),
  ('pants:blackTrous'), ('pants:khakiChino'), ('pants:navyTrous'), ('pants:creamChino'),
  ('pants:charcoalSuit'), ('pants:blackJogger'), ('pants:greyJogger'), ('pants:blackShorts'),
  ('pants:navyRunShorts'), ('pants:blackRunShorts'), ('pants:swimBlue'), ('pants:swimCoral'),
  ('pants:linenShorts'), ('pants:stoneShorts'), ('shoes:court'), ('shoes:skate'), ('shoes:derby'),
  ('shoes:runner'), ('shoes:boot'), ('shoes:suede'), ('shoes:loafer'), ('shoes:trail'), ('shoes:sandal'),
  ('shoes:slide'), ('shoes:runnerOrange'), ('shoes:runnerBlue'), ('shoes:trainer'), ('shoes:trainerWhite');

-- Classificação de cada produto de demonstração que ainda existe
create temporary table demo_plan on commit drop as
select p.sku, p.name, p.color_name,
       case
         when exists (select 1 from public.look_products lp where lp.product_sku = p.sku) then 'mantido (está num look)'
         when exists (select 1 from public.order_items oi where oi.sku = p.sku)          then 'arquivado (está numa encomenda)'
         else 'apagado'
       end as acao
  from public.products p join demo_skus d on d.sku = p.sku;

update public.products p set status = 'archived'
  from demo_plan x
 where x.sku = p.sku and x.acao like 'arquivado%' and p.status <> 'archived';

delete from public.product_variants v using demo_plan x
 where x.sku = v.product_sku and x.acao = 'apagado';
delete from public.products p using demo_plan x
 where x.sku = p.sku and x.acao = 'apagado';

-- Resumo
select acao, count(*) as produtos from demo_plan group by acao order by acao;

commit;

-- Produtos de demonstração que ficaram (nos looks ou em encomendas). Para os retirar dos looks,
-- troca essas peças no painel e executa este script de novo.
select p.sku, p.name, p.color_name, p.status,
       (select string_agg(l.name, ', ') from public.look_products lp join public.looks l on l.id = lp.look_id where lp.product_sku = p.sku) as looks
  from public.products p
 where p.sku in ('top:greySweat', 'top:greenKnit', 'top:rustSweat', 'top:navyKnit', 'top:creamCable',
  'top:blackSweat', 'top:oatSweat', 'top:wineKnit', 'top:skySweat', 'top:whiteTee', 'top:blackTee', 'top:sageTee',
  'top:sandTee', 'top:brickTee', 'top:navyTee', 'top:greyTee', 'top:mustardTee', 'top:whiteShirt', 'top:skyShirt',
  'top:blackShirt', 'top:wineShirt', 'top:blackTank', 'top:greyTank', 'top:navyTank', 'top:limeTee', 'top:orangeRunTee',
  'top:blueRunTee', 'top:whiteRunTank', 'top:linenCamp', 'top:terraCamp', 'top:sageCamp', 'pants:midJeans',
  'pants:washJeans', 'pants:iceJeans', 'pants:rawJeans', 'pants:blackJeans', 'pants:ecruCanvas', 'pants:brownChino',
  'pants:greyChino', 'pants:oliveChino', 'pants:blackTrous', 'pants:khakiChino', 'pants:navyTrous', 'pants:creamChino',
  'pants:charcoalSuit', 'pants:blackJogger', 'pants:greyJogger', 'pants:blackShorts', 'pants:navyRunShorts',
  'pants:blackRunShorts', 'pants:swimBlue', 'pants:swimCoral', 'pants:linenShorts', 'pants:stoneShorts', 'shoes:court',
  'shoes:skate', 'shoes:derby', 'shoes:runner', 'shoes:boot', 'shoes:suede', 'shoes:loafer', 'shoes:trail',
  'shoes:sandal', 'shoes:slide', 'shoes:runnerOrange', 'shoes:runnerBlue', 'shoes:trainer', 'shoes:trainerWhite')
 order by p.sku;
