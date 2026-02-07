import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { startDate, endDate, sector = 'all', product = 'all', year = 2026 } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'Database connection not configured' }, { status: 500 });
    }

    const { Client } = await import('npm:pg@8.11.3');
    const client = new Client(connectionString);
    
    await client.connect();

    try {
      console.log(`📊 Buscando dados de relatório: ${startDate} a ${endDate}, setor=${sector}, produto=${product}`);

      // Query 1: Vendas x Perdas em R$ (CORRIGIDO)
      let salesLossQuery = `
        SELECT 
          numero_semana,
          SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as vendas_reais,
          SUM(CASE WHEN tipo = 'perda' THEN valor ELSE 0 END) as perdas_reais
        FROM vw_movimentacoes
        WHERE data BETWEEN $1 AND $2
          AND ano = $3
      `;

      const params = [startDate, endDate, year];
      let paramIndex = 4;

      if (sector !== 'all') {
        salesLossQuery += ` AND setor = $${paramIndex}`;
        params.push(sector);
        paramIndex++;
      }

      if (product !== 'all') {
        salesLossQuery += ` AND produto = $${paramIndex}`;
        params.push(product);
        paramIndex++;
      }

      salesLossQuery += ` GROUP BY numero_semana ORDER BY numero_semana`;

      const salesLossResult = await client.query(salesLossQuery, params);

      // Query 2: Taxa de Perda % (CORRIGIDO)
      let lossRateQuery = `
        SELECT 
          numero_semana,
          (SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) / 
           NULLIF(SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END), 0) * 100) as taxa_perda
        FROM vw_movimentacoes
        WHERE data BETWEEN $1 AND $2
          AND ano = $3
      `;

      if (sector !== 'all') {
        lossRateQuery += ` AND setor = $4`;
      }
      if (product !== 'all') {
        lossRateQuery += ` AND produto = $${sector !== 'all' ? 5 : 4}`;
      }

      lossRateQuery += ` GROUP BY numero_semana ORDER BY numero_semana`;

      const lossRateResult = await client.query(lossRateQuery, params);

      // Query 3: Faturamento R$ (CORRIGIDO)
      let revenueQuery = `
        SELECT 
          numero_semana,
          SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as faturamento
        FROM vw_movimentacoes
        WHERE data BETWEEN $1 AND $2
          AND ano = $3
      `;

      if (sector !== 'all') {
        revenueQuery += ` AND setor = $4`;
      }
      if (product !== 'all') {
        revenueQuery += ` AND produto = $${sector !== 'all' ? 5 : 4}`;
      }

      revenueQuery += ` GROUP BY numero_semana ORDER BY numero_semana`;

      const revenueResult = await client.query(revenueQuery, params);

      // Query 4: Tabela Resumo (CORRIGIDO)
      let summaryQuery = `
        SELECT 
          numero_semana,
          SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas_qtd,
          SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas_qtd,
          (SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) / 
           NULLIF(SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END), 0) * 100) as taxa_perda,
          SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as faturamento
        FROM vw_movimentacoes
        WHERE data BETWEEN $1 AND $2
          AND ano = $3
      `;

      if (sector !== 'all') {
        summaryQuery += ` AND setor = $4`;
      }
      if (product !== 'all') {
        summaryQuery += ` AND produto = $${sector !== 'all' ? 5 : 4}`;
      }

      summaryQuery += ` GROUP BY numero_semana ORDER BY numero_semana`;

      const summaryResult = await client.query(summaryQuery, params);

      console.log(`✅ Dados de relatório obtidos`);

      return Response.json({
        salesLoss: salesLossResult.rows,
        lossRate: lossRateResult.rows,
        revenue: revenueResult.rows,
        summary: summaryResult.rows
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error.message);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});