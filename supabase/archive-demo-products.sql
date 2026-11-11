-- =====================================================================
-- YOUR LOOK — esconder os 68 produtos de DEMONSTRAÇÃO (de products.sql)
-- Executar no SQL Editor DEPOIS de admin.sql (precisa da coluna status).
--
-- NÃO apaga nada: passa-os a «archived» (arquivados). Deixam de aparecer na
-- loja e não podem ser comprados, mas continuam na base de dados — as
-- encomendas antigas que os usam (ex.: n.º 1008) ficam intactas.
-- Produtos que já estejam num look PUBLICADO não são tocados.
-- Podes voltar a publicá-los no painel (Produtos → editar → Estado).
-- =====================================================================
update public.products p
   set status = 'archived'
 where p.status <> 'archived'
   and p.sku in (
    'top:greySweat', 'top:greenKnit', 'top:rustSweat', 'top:navyKnit', 'top:creamCable',
    'top:blackSweat', 'top:oatSweat', 'top:wineKnit', 'top:skySweat', 'top:whiteTee',
    'top:blackTee', 'top:sageTee', 'top:sandTee', 'top:brickTee', 'top:navyTee', 'top:greyTee',
    'top:mustardTee', 'top:whiteShirt', 'top:skyShirt', 'top:blackShirt', 'top:wineShirt',
    'top:blackTank', 'top:greyTank', 'top:navyTank', 'top:limeTee', 'top:orangeRunTee',
    'top:blueRunTee', 'top:whiteRunTank', 'top:linenCamp', 'top:terraCamp', 'top:sageCamp',
    'pants:midJeans', 'pants:washJeans', 'pants:iceJeans', 'pants:rawJeans', 'pants:blackJeans',
    'pants:ecruCanvas', 'pants:brownChino', 'pants:greyChino', 'pants:oliveChino',
    'pants:blackTrous', 'pants:khakiChino', 'pants:navyTrous', 'pants:creamChino',
    'pants:charcoalSuit', 'pants:blackJogger', 'pants:greyJogger', 'pants:blackShorts',
    'pants:navyRunShorts', 'pants:blackRunShorts', 'pants:swimBlue', 'pants:swimCoral',
    'pants:linenShorts', 'pants:stoneShorts', 'shoes:court', 'shoes:skate', 'shoes:derby',
    'shoes:runner', 'shoes:boot', 'shoes:suede', 'shoes:loafer', 'shoes:trail', 'shoes:sandal',
    'shoes:slide', 'shoes:runnerOrange', 'shoes:runnerBlue', 'shoes:trainer', 'shoes:trainerWhite')
   and not exists (
     select 1 from public.look_products lp
       join public.looks l on l.id = lp.look_id
      where lp.product_sku = p.sku and l.status = 'published');

-- Confirmação: produtos ainda visíveis na loja (devem ser só os teus)
select sku, name, color_name, price, status
  from public.products
 where status = 'published'
 order by sku;
