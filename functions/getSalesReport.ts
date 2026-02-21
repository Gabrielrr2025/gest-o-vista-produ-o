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
      startDate, 
      endDate,
      compareStartDate = null,
      compareEndDate = null,
      topN = 10
    } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📊 Relatório de Vendas: ${startDate} a ${endDate}`);

    // ========================================
    // PERÍODO PRINCIPAL
    // ========================================

    // Executar todas as queries em paralelo
    const [salesBySector, salesByProduct, salesBySectorProduct, rawSalesData] = await Promise.all([
      sql`
        SELECT 
          p.setor,
          SUM(v.valor_reais) as total_valor,
          SUM(v.quantidade) as total_quantidade,
          COUNT(DISTINCT p.id) as total_produtos
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN ${startDate} AND ${endDate}
        GROUP BY p.setor
        ORDER BY total_valor DESC
      `,
      sql`
        SELECT 
          p.id as produto_id,
          p.nome as produto_nome,
          p.setor,
          p.unidade,
          SUM(v.valor_reais) as total_valor,
          SUM(v.quantidade) as total_quantidade
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN ${startDate} AND ${endDate}
        GROUP BY p.id, p.nome, p.setor, p.unidade
        ORDER BY total_valor DESC
        LIMIT ${topN}
      `,
      sql`
        SELECT 
          p.setor,
          p.id as produto_id,
          p.nome as produto_nome,
          p.unidade,
          SUM(v.valor_reais) as total_valor,
          SUM(v.quantidade) as total_quantidade
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN ${startDate} AND ${endDate}
        GROUP BY p.setor, p.id, p.nome, p.unidade
        ORDER BY p.setor, total_valor DESC
      `,
      sql`
        SELECT 
          v.data,
          p.setor,
          v.valor_reais
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN ${startDate} AND ${endDate}
      `
    ]);

    const totalGeral = salesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor), 0);

    console.log(`✅ ${salesBySector.length} setores, ${salesByProduct.length} produtos (top ${topN})`);

    // ========================================
    // PERÍODO DE COMPARAÇÃO (se fornecido)
    // ========================================

    let compareData = null;

    if (compareStartDate && compareEndDate) {
      console.log(`📊 Comparação: ${compareStartDate} a ${compareEndDate}`);

      const compareSalesBySector = await sql`
        SELECT 
          p.setor,
          SUM(v.valor_reais) as total_valor,
          SUM(v.quantidade) as total_quantidade
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN ${compareStartDate} AND ${compareEndDate}
        GROUP BY p.setor
      `;

      const compareSalesByProduct = await sql`
        SELECT 
          p.id as produto_id,
          p.nome as produto_nome,
          p.setor,
          SUM(v.valor_reais) as total_valor,
          SUM(v.quantidade) as total_quantidade
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN ${compareStartDate} AND ${compareEndDate}
        GROUP BY p.id, p.nome, p.setor
      `;

      const compareTotalGeral = compareSalesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor), 0);

      const compareRawSalesData = await sql`
        SELECT 
          v.data,
          p.setor,
          v.valor_reais
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN ${compareStartDate} AND ${compareEndDate}
      `;

      compareData = {
        salesBySector: compareSalesBySector,
        salesByProduct: compareSalesByProduct,
        rawData: compareRawSalesData,
        totalGeral: compareTotalGeral
      };

      console.log(`✅ Comparação: ${compareSalesBySector.length} setores`);
    }

    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      period: {
        start: startDate,
        end: endDate
      },
      comparePeriod: compareStartDate ? {
        start: compareStartDate,
        end: compareEndDate
      } : null,
      data: {
        salesBySector,
        salesByProduct,
        salesBySectorProduct,
        rawData: rawSalesData,
        totalGeral
      },
      compareData
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