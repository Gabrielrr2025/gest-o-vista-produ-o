import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { startDate, endDate, compareStartDate = null, compareEndDate = null, topN = 10 } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });

    const sql = neon(connectionString);
    console.log(`📊 Relatório de Vendas: ${startDate} a ${endDate}`);

    const [salesBySector, salesByProduct, salesBySectorProduct, rawSalesData] = await Promise.all([
      // Por setor
      sql`
        SELECT
          COALESCE(departamento_descricao, 'Sem Setor') as setor,
          SUM(valor_total) as total_valor,
          SUM(quantidade) as total_quantidade,
          COUNT(DISTINCT produto_codigo) as total_produtos
        FROM vendas
        WHERE data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY COALESCE(departamento_descricao, 'Sem Setor')
        ORDER BY total_valor DESC
      `,
      // Top N produtos geral
      sql`
        SELECT
          produto_codigo as produto_id,
          produto_descricao as produto_nome,
          COALESCE(departamento_descricao, 'Sem Setor') as setor,
          COALESCE(produto_unidade, 'un') as unidade,
          SUM(valor_total) as total_valor,
          SUM(quantidade) as total_quantidade
        FROM vendas
        WHERE data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY produto_codigo, produto_descricao, departamento_descricao, produto_unidade
        ORDER BY total_valor DESC
        LIMIT ${topN}
      `,
      // Todos produtos por setor
      sql`
        SELECT
          COALESCE(departamento_descricao, 'Sem Setor') as setor,
          produto_codigo as produto_id,
          produto_descricao as produto_nome,
          COALESCE(produto_unidade, 'un') as unidade,
          SUM(valor_total) as total_valor,
          SUM(quantidade) as total_quantidade
        FROM vendas
        WHERE data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY departamento_descricao, produto_codigo, produto_descricao, produto_unidade
        ORDER BY setor, total_valor DESC
      `,
      // Raw data para gráficos
      sql`
        SELECT
          TO_CHAR(data, 'YYYY-MM-DD') as data,
          COALESCE(departamento_descricao, 'Sem Setor') as setor,
          produto_descricao as produto,
          SUM(valor_total) as valor_reais,
          SUM(quantidade) as quantidade
        FROM vendas
        WHERE data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY data, departamento_descricao, produto_descricao
        ORDER BY data
      `
    ]);

    const totalGeral = salesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor || 0), 0);
    console.log(`✅ ${salesBySector.length} setores, ${salesByProduct.length} produtos`);

    let compareData = null;
    if (compareStartDate && compareEndDate) {
      const [compareSalesBySector, compareSalesByProduct, compareRawSalesData] = await Promise.all([
        sql`
          SELECT
            COALESCE(departamento_descricao, 'Sem Setor') as setor,
            SUM(valor_total) as total_valor,
            SUM(quantidade) as total_quantidade
          FROM vendas
          WHERE data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
          GROUP BY COALESCE(departamento_descricao, 'Sem Setor')
        `,
        sql`
          SELECT
            produto_codigo as produto_id,
            produto_descricao as produto_nome,
            COALESCE(departamento_descricao, 'Sem Setor') as setor,
            SUM(valor_total) as total_valor,
            SUM(quantidade) as total_quantidade
          FROM vendas
          WHERE data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
          GROUP BY produto_codigo, produto_descricao, departamento_descricao
        `,
        sql`
          SELECT
            TO_CHAR(data, 'YYYY-MM-DD') as data,
            COALESCE(departamento_descricao, 'Sem Setor') as setor,
            SUM(valor_total) as valor_reais
          FROM vendas
          WHERE data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
          GROUP BY data, departamento_descricao
          ORDER BY data
        `
      ]);

      const compareTotalGeral = compareSalesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor || 0), 0);
      compareData = {
        salesBySector: compareSalesBySector,
        salesByProduct: compareSalesByProduct,
        rawData: compareRawSalesData,
        totalGeral: compareTotalGeral
      };
    }

    return Response.json({
      period: { start: startDate, end: endDate },
      comparePeriod: compareStartDate ? { start: compareStartDate, end: compareEndDate } : null,
      data: { salesBySector, salesByProduct, salesBySectorProduct, rawData: rawSalesData, totalGeral },
      compareData
    });

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});