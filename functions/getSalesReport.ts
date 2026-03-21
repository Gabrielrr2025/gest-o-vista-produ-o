import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
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

    // Estrutura atual da tabela vendas:
    // id, data_hora, data (date), hora, sequencial,
    // produto_codigo, produto_descricao, produto_unidade,
    // departamento_codigo, departamento_descricao,
    // funcionario_codigo, funcionario_nome, atendente_codigo, atendente_nome,
    // quantidade, valor_total, valor_custo, criado_em

    const [salesBySector, salesByProduct, salesBySectorProduct, rawSalesData] = await Promise.all([
      sql`
        SELECT 
          COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
          SUM(v.valor_total) as total_valor,
          SUM(v.quantidade) as total_quantidade,
          COUNT(DISTINCT v.produto_codigo) as total_produtos
        FROM vendas v
        LEFT JOIN produtos p ON v.produto_codigo = p.codigo
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor')
        ORDER BY total_valor DESC
      `,
      sql`
        SELECT 
          v.produto_codigo as produto_id,
          COALESCE(p.descricao, v.produto_descricao) as produto_nome,
          COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
          COALESCE(p.unidade, v.produto_unidade, 'un') as unidade,
          SUM(v.valor_total) as total_valor,
          SUM(v.quantidade) as total_quantidade
        FROM vendas v
        LEFT JOIN produtos p ON v.produto_codigo = p.codigo
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY v.produto_codigo, produto_nome, setor, p.unidade, v.produto_unidade
        ORDER BY total_valor DESC
        LIMIT ${topN}
      `,
      sql`
        SELECT 
          COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
          v.produto_codigo as produto_id,
          COALESCE(p.descricao, v.produto_descricao) as produto_nome,
          COALESCE(p.unidade, v.produto_unidade, 'un') as unidade,
          SUM(v.valor_total) as total_valor,
          SUM(v.quantidade) as total_quantidade
        FROM vendas v
        LEFT JOIN produtos p ON v.produto_codigo = p.codigo
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY setor, v.produto_codigo, produto_nome, p.unidade, v.produto_unidade
        ORDER BY setor, total_valor DESC
      `,
      sql`
        SELECT 
          v.data,
          COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
          COALESCE(p.descricao, v.produto_descricao) as produto,
          SUM(v.valor_total) as valor_reais,
          SUM(v.quantidade) as quantidade
        FROM vendas v
        LEFT JOIN produtos p ON v.produto_codigo = p.codigo
        WHERE v.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY v.data, COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor'), COALESCE(p.descricao, v.produto_descricao)
        ORDER BY v.data
      `
    ]);

    const totalGeral = salesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor || 0), 0);
    console.log(`✅ ${salesBySector.length} setores, ${salesByProduct.length} produtos`);

    let compareData = null;

    if (compareStartDate && compareEndDate) {
      const [compareSalesBySector, compareSalesByProduct, compareRawSalesData] = await Promise.all([
        sql`
          SELECT 
            COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
            SUM(v.valor_total) as total_valor,
            SUM(v.quantidade) as total_quantidade
          FROM vendas v
          LEFT JOIN produtos p ON v.produto_codigo = p.codigo
          WHERE v.data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
          GROUP BY COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor')
        `,
        sql`
          SELECT 
            v.produto_codigo as produto_id,
            COALESCE(p.descricao, v.produto_descricao) as produto_nome,
            COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
            SUM(v.valor_total) as total_valor,
            SUM(v.quantidade) as total_quantidade
          FROM vendas v
          LEFT JOIN produtos p ON v.produto_codigo = p.codigo
          WHERE v.data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
          GROUP BY v.produto_codigo, produto_nome, setor
        `,
        sql`
          SELECT 
            v.data,
            COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor') as setor,
            SUM(v.valor_total) as valor_reais
          FROM vendas v
          LEFT JOIN produtos p ON v.produto_codigo = p.codigo
          WHERE v.data BETWEEN ${compareStartDate}::date AND ${compareEndDate}::date
          GROUP BY v.data, COALESCE(p.departamento_desc, v.departamento_descricao, 'Sem Setor')
          ORDER BY v.data
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
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});