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
    const { 
      productIds, // Array de IDs dos produtos a comparar
      startDate, 
      endDate,
      type = 'sales' // 'sales' ou 'losses'
    } = body;

    if (!productIds || productIds.length === 0) {
      return Response.json({ error: 'productIds é obrigatório' }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📊 Comparação de ${productIds.length} produtos: ${startDate} a ${endDate}`);

    // ========================================
    // BUSCAR DADOS DE CADA PRODUTO
    // ========================================

    const productsData = [];

    for (const productId of productIds) {
      // Info do produto
      const productInfo = await sql`
        SELECT id, nome, setor, unidade
        FROM produtos
        WHERE id = ${productId}
      `;

      if (productInfo.length === 0) {
        console.warn(`⚠️ Produto ${productId} não encontrado`);
        continue;
      }

      // Dados temporais (dia a dia)
      let evolutionData = [];

      if (type === 'sales') {
        evolutionData = await sql`
          SELECT 
            v.data,
            SUM(v.valor_reais) as valor,
            SUM(v.quantidade) as quantidade
          FROM vendas v
          WHERE v.produto_id = ${productId}
            AND v.data BETWEEN ${startDate} AND ${endDate}
          GROUP BY v.data
          ORDER BY v.data
        `;
      } else if (type === 'losses') {
        evolutionData = await sql`
          SELECT 
            pe.data,
            SUM(pe.valor_reais) as valor,
            SUM(pe.quantidade) as quantidade
          FROM perdas pe
          WHERE pe.produto_id = ${productId}
            AND pe.data BETWEEN ${startDate} AND ${endDate}
          GROUP BY pe.data
          ORDER BY pe.data
        `;
      }

      // Estatísticas
      const totalValor = evolutionData.reduce((sum, d) => sum + parseFloat(d.valor || 0), 0);
      const totalQuantidade = evolutionData.reduce((sum, d) => sum + parseFloat(d.quantidade || 0), 0);
      const mediaValor = evolutionData.length > 0 ? totalValor / evolutionData.length : 0;
      
      // Pico e vale
      const valores = evolutionData.map(d => parseFloat(d.valor || 0));
      const picoValor = valores.length > 0 ? Math.max(...valores) : 0;
      const valeValor = valores.length > 0 ? Math.min(...valores) : 0;
      const picoData = evolutionData.find(d => parseFloat(d.valor) === picoValor)?.data || null;
      const valeData = evolutionData.find(d => parseFloat(d.valor) === valeValor)?.data || null;

      productsData.push({
        produto: productInfo[0],
        evolution: evolutionData,
        stats: {
          totalValor,
          totalQuantidade,
          mediaValor,
          diasComDados: evolutionData.length,
          pico: {
            valor: picoValor,
            data: picoData
          },
          vale: {
            valor: valeValor,
            data: valeData
          }
        }
      });

      console.log(`✅ Produto ${productInfo[0].nome}: ${evolutionData.length} dias de dados`);
    }

    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      period: {
        start: startDate,
        end: endDate
      },
      type,
      products: productsData
    });

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});
