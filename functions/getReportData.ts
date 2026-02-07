import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { startDate, endDate, sector = 'all', product = 'all', groupBy = 'week' } = body;

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
      // Validação de datas
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      console.log(`📊 Buscando dados de relatório: ${startDate} a ${endDate}, setor=${sector}, produto=${product}`);

      // Query 1: Vendas x Perdas em R$
      let salesLossQuery = `
        SELECT 
          semana,
          SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as vendas_reais,
          SUM(CASE WHEN tipo = 'perda' THEN valor ELSE 0 END) as perdas_reais
        FROM vw_movimentacoes
        WHERE data BETWEEN $1 AND $2
      `;

      const params = [startDate, endDate];
      let paramIndex = 3;

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

      salesLossQuery += ` GROUP BY semana ORDER BY semana`;

      const salesLossResult = await client.query(salesLossQuery, params);
      const salesLossData = salesLossResult.rows;

      // Query 2: Taxa de Perda %
      let lossRateQuery = `
        SELECT 
          semana,
          (SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) / 
           NULLIF(SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END), 0) * 100) as taxa_perda
        FROM vw_movimentacoes
        WHERE data BETWEEN $1 AND $2
      `;

      if (sector !== 'all') {
        lossRateQuery += ` AND setor = $${paramIndex - Object.keys(params).length + 2}`;
      }
      if (product !== 'all') {
        lossRateQuery += ` AND produto = $${paramIndex - Object.keys(params).length + 3}`;
      }

      lossRateQuery += ` GROUP BY semana ORDER BY semana`;

      const lossRateResult = await client.query(lossRateQuery, params.slice(0, sector !== 'all' || product !== 'all' ? paramIndex - 1 : 2));
      const lossRateData = lossRateResult.rows;

      // Query 3: Faturamento R$
      let revenueQuery = `
        SELECT 
          semana,
          SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as faturamento
        FROM vw_movimentacoes
        WHERE data BETWEEN $1 AND $2
      `;

      if (sector !== 'all') {
        revenueQuery += ` AND setor = $${paramIndex - Object.keys(params).length + 2}`;
      }
      if (product !== 'all') {
        revenueQuery += ` AND produto = $${paramIndex - Object.keys(params).length + 3}`;
      }

      revenueQuery += ` GROUP BY semana ORDER BY semana`;

      const revenueResult = await client.query(revenueQuery, params.slice(0, sector !== 'all' || product !== 'all' ? paramIndex - 1 : 2));
      const revenueData = revenueResult.rows;

      // Query 4: Tabela Resumo
      let summaryQuery = `
        SELECT 
          semana,
          SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas_qtd,
          SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas_qtd,
          (SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) / 
           NULLIF(SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END), 0) * 100) as taxa_perda,
          SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as faturamento
        FROM vw_movimentacoes
        WHERE data BETWEEN $1 AND $2
      `;

      if (sector !== 'all') {
        summaryQuery += ` AND setor = $${paramIndex - Object.keys(params).length + 2}`;
      }
      if (product !== 'all') {
        summaryQuery += ` AND produto = $${paramIndex - Object.keys(params).length + 3}`;
      }

      summaryQuery += ` GROUP BY semana ORDER BY semana`;

      const summaryResult = await client.query(summaryQuery, params.slice(0, sector !== 'all' || product !== 'all' ? paramIndex - 1 : 2));
      const summaryData = summaryResult.rows;

      console.log(`✅ Dados de relatório obtidos com sucesso:`, {
        salesLoss: salesLossData.length,
        lossRate: lossRateData.length,
        revenue: revenueData.length,
        summary: summaryData.length
      });

      return Response.json({
        salesLoss: salesLossData,
        lossRate: lossRateData,
        revenue: revenueData,
        summary: summaryData
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error.message);
    return Response.json({ 
      error: error.message,
      details: 'Erro ao buscar dados de vw_movimentacoes'
    }, { status: 500 });
  }
});