import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
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

    // Tabela vendas: produto_codigo, produto_descricao, departamento_descricao, quantidade_total, valor_total
    // Join com produtos via: vendas.produto_codigo = produtos.codigo
    // produtos: codigo, descricao, unidade, departamento_desc, setor (adicionado pelo app)

    const [salesBySector, salesByProduct, salesBySectorProduct, rawSalesData] = await Promise.all([
      sql`
        SELECT 
          COALESCE(p.setor, v.departamento_descricao, 'Sem Setor') as setor,
          SUM(v.valor_total) as total_valor,
          SUM(v.quantidade_total) as total_quantidade,
          COUNT(DISTINCT v.produto_codigo) as total_produtos
        FROM vendas v
        LEFT JOIN produtos p ON v.produto_codigo = p.codigo
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY COALESCE(p.setor, v.departamento_descricao, 'Sem Setor')
        ORDER BY total_valor DESC
      `,
      sql`
        SELECT 
          v.produto_codigo as produto_id,
          COALESCE(p.nome, v.produto_descricao) as produto_nome,
          COALESCE(p.setor, v.departamento_descricao, 'Sem Setor') as setor,
          COALESCE(p.unidade, v.produto_unidade, 'un') as unidade,
          SUM(v.valor_total) as total_valor,
          SUM(v.quantidade_total) as total_quantidade
        FROM vendas v
        LEFT JOIN produtos p ON v.produto_codigo = p.codigo
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY v.produto_codigo, produto_nome, setor, unidade
        ORDER BY total_valor DESC
        LIMIT ${topN}
      `,
      sql`
        SELECT 
          COALESCE(p.setor, v.departamento_descricao, 'Sem Setor') as setor,
          v.produto_codigo as produto_id,
          COALESCE(p.nome, v.produto_descricao) as produto_nome,
          COALESCE(p.unidade, v.produto_unidade, 'un') as unidade,
          SUM(v.valor_total) as total_valor,
          SUM(v.quantidade_total) as total_quantidade
        FROM vendas v
        LEFT JOIN produtos p ON v.produto_codigo = p.codigo
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY setor, v.produto_codigo, produto_nome, unidade
        ORDER BY setor, total_valor DESC
      `,
      sql`
        SELECT 
          v.data,
          COALESCE(p.setor, v.departamento_descricao, 'Sem Setor') as setor,
          v.valor_total as valor_reais
        FROM vendas v
        LEFT JOIN produtos p ON v.produto_codigo = p.codigo
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
      `
    ]);

    const totalGeral = salesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor || 0), 0);

    console.log(`✅ ${salesBySector.length} setores, ${salesByProduct.length} produtos (top ${topN})`);

    // Período de comparação (se fornecido)
    let compareData = null;

    if (compareStartDate && compareEndDate) {
      console.log(`📊 Comparação: ${compareStartDate} a ${compareEndDate}`);

      const [compareSalesBySector, compareSalesByProduct, compareRawSalesData] = await Promise.all([
        sql`
          SELECT 
            COALESCE(p.setor, v.departamento_descricao, 'Sem Setor') as setor,
            SUM(v.valor_total) as total_valor,
            SUM(v.quantidade_total) as total_quantidade
          FROM vendas v
          LEFT JOIN produtos p ON v.produto_codigo = p.codigo
          WHERE v.data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
          GROUP BY COALESCE(p.setor, v.departamento_descricao, 'Sem Setor')
        `,
        sql`
          SELECT 
            v.produto_codigo as produto_id,
            COALESCE(p.nome, v.produto_descricao) as produto_nome,
            COALESCE(p.setor, v.departamento_descricao, 'Sem Setor') as setor,
            SUM(v.valor_total) as total_valor,
            SUM(v.quantidade_total) as total_quantidade
          FROM vendas v
          LEFT JOIN produtos p ON v.produto_codigo = p.codigo
          WHERE v.data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
          GROUP BY v.produto_codigo, produto_nome, setor
        `,
        sql`
          SELECT 
            v.data,
            COALESCE(p.setor, v.departamento_descricao, 'Sem Setor') as setor,
            v.valor_total as valor_reais
          FROM vendas v
          LEFT JOIN produtos p ON v.produto_codigo = p.codigo
          WHERE v.data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
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