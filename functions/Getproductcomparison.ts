import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('📥 Request body:', JSON.stringify(body, null, 2));
    
    const { 
      productIds: rawProductIds, 
      startDate, 
      endDate,
      type = 'sales'
    } = body;

    // Garantir que são números
    const productIds = Array.isArray(rawProductIds) ? 
      rawProductIds.map(id => parseInt(id)) : 
      [parseInt(rawProductIds)];

    console.log('🎯 Parsed productIds:', productIds);
    console.log('📅 Dates:', { startDate, endDate, type });

    if (!productIds || productIds.length === 0 || productIds.some(id => isNaN(id))) {
      return Response.json({ error: 'productIds inválidos' }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    // ========================================
    // BUSCAR DADOS DE CADA PRODUTO
    // ========================================

    const productsData = [];

    for (const productId of productIds) {
      console.log(`\n🔍 === Processando produto ${productId} ===`);
      
      try {
        // 1. Info do produto
        console.log(`   Query 1: Buscando info do produto...`);
        const productInfo = await sql`
          SELECT id, nome, setor, unidade
          FROM produtos
          WHERE id = ${productId}
        `;
        console.log(`   ✅ Resultado:`, productInfo);

        if (productInfo.length === 0) {
          console.warn(`   ⚠️ Produto ${productId} não encontrado no banco`);
          continue;
        }

        const produto = productInfo[0];
        console.log(`   ✅ Produto: ${produto.nome} (${produto.setor})`);

        // 2. Dados de evolução
        console.log(`   Query 2: Buscando ${type}...`);
        
        let evolutionData = [];
        
        if (type === 'sales') {
          evolutionData = await sql`
            SELECT 
              DATE(data) as data,
              CAST(COALESCE(SUM(valor_reais), 0) AS DECIMAL) as valor,
              CAST(COALESCE(SUM(quantidade), 0) AS DECIMAL) as quantidade
            FROM vendas
            WHERE produto_id = ${productId}
              AND DATE(data) >= DATE(${startDate})
              AND DATE(data) <= DATE(${endDate})
            GROUP BY DATE(data)
            ORDER BY DATE(data)
          `;
        } else {
          evolutionData = await sql`
            SELECT 
              DATE(data) as data,
              CAST(COALESCE(SUM(valor_reais), 0) AS DECIMAL) as valor,
              CAST(COALESCE(SUM(quantidade), 0) AS DECIMAL) as quantidade
            FROM perdas
            WHERE produto_id = ${productId}
              AND DATE(data) >= DATE(${startDate})
              AND DATE(data) <= DATE(${endDate})
            GROUP BY DATE(data)
            ORDER BY DATE(data)
          `;
        }

        console.log(`   ✅ ${evolutionData.length} dias encontrados`);

        // Se não tiver dados, adicionar registro vazio mesmo assim
        if (evolutionData.length === 0) {
          console.warn(`   ⚠️ Nenhum dado encontrado para produto ${productId}, mas continuando...`);
        }

        // 3. Calcular estatísticas
        const totalValor = evolutionData.reduce((sum, d) => sum + parseFloat(d.valor || 0), 0);
        const totalQuantidade = evolutionData.reduce((sum, d) => sum + parseFloat(d.quantidade || 0), 0);
        const mediaValor = evolutionData.length > 0 ? totalValor / evolutionData.length : 0;
        
        const valores = evolutionData.map(d => parseFloat(d.valor || 0));
        const picoValor = valores.length > 0 ? Math.max(...valores) : 0;
        const valeValor = valores.length > 0 ? Math.min(...valores) : 0;
        
        const picoItem = evolutionData.find(d => parseFloat(d.valor) === picoValor);
        const valeItem = evolutionData.find(d => parseFloat(d.valor) === valeValor);

        productsData.push({
          produto: {
            id: produto.id,
            nome: produto.nome,
            setor: produto.setor,
            unidade: produto.unidade
          },
          evolution: evolutionData,
          stats: {
            totalValor,
            totalQuantidade,
            mediaValor,
            diasComDados: evolutionData.length,
            pico: {
              valor: picoValor,
              data: picoItem?.data || null
            },
            vale: {
              valor: valeValor,
              data: valeItem?.data || null
            }
          }
        });

        console.log(`   ✅ Produto ${produto.nome} processado com sucesso!`);
        console.log(`   📊 Total de produtos no array agora: ${productsData.length}`);

      } catch (productError) {
        console.error(`\n   ❌ ERRO no produto ${productId}:`);
        console.error(`   Message: ${productError.message}`);
        console.error(`   Stack: ${productError.stack}`);
        // Continua para o próximo
      }
    }

    console.log(`\n✅ Processamento completo: ${productsData.length} produtos`);
    console.log(`📦 Produtos processados:`, productsData.map(p => p.produto.nome));
    console.log(`🔍 IDs enviados:`, productIds);
    console.log(`🔍 IDs processados:`, productsData.map(p => p.produto.id));

    if (productsData.length !== productIds.length) {
      console.warn(`⚠️⚠️⚠️ ATENÇÃO: Foram solicitados ${productIds.length} produtos mas só ${productsData.length} foram processados!`);
    }

    return Response.json({
      period: { start: startDate, end: endDate },
      type,
      products: productsData
    });

  } catch (error) {
    console.error('\n❌ ERRO GERAL:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});
