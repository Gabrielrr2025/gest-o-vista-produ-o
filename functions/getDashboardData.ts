import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import postgres from 'npm:postgres@3.4.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { weekNumber, year, sector = 'all' } = body;

    if (weekNumber === undefined || !year) {
      return Response.json({ error: 'Missing weekNumber or year' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'Database connection not configured' }, { status: 500 });
    }

    const { Pool } = await import('npm:pg@8.11.3');
    const pool = new Pool({ connectionString });
    const client = await pool.connect();

    try {
      console.log(`📊 Buscando dados do Dashboard: semana=${weekNumber}, ano=${year}, setor=${sector}`);

      // Query 1: Top 5 mais vendidos da semana
      let topSalesQuery = `
        SELECT 
          produto,
          SUM(quantidade) as total_vendas,
          SUM(valor) as total_valor
        FROM vw_movimentacoes
        WHERE tipo = 'venda'
          AND semana = $1
          AND EXTRACT(YEAR FROM data) = $2
      `;

      const params = [weekNumber, year];
      let paramIndex = 3;

      if (sector !== 'all') {
        topSalesQuery += ` AND setor = $${paramIndex}`;
        params.push(sector);
        paramIndex++;
      }

      topSalesQuery += ` GROUP BY produto ORDER BY total_vendas DESC LIMIT 5`;

      const topSalesResult = await client.query(topSalesQuery, params);

      // Query 2: Análise de perdas da semana
      let lossAnalysisQuery = `
        SELECT 
          produto,
          SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perda,
          SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as venda,
          setor
        FROM vw_movimentacoes
        WHERE semana = $1
          AND EXTRACT(YEAR FROM data) = $2
      `;

      const lossParams = [weekNumber, year];
      
      if (sector !== 'all') {
        lossAnalysisQuery += ` AND setor = $3`;
        lossParams.push(sector);
      }

      lossAnalysisQuery += ` GROUP BY produto, setor
                          HAVING SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) > 0
                          ORDER BY perda DESC`;

      const lossAnalysisResult = await client.query(lossAnalysisQuery, lossParams);

      // Query 3: Média de perdas das 4 semanas anteriores (para comparação de alertas)
      let prevWeeksQuery = `
        SELECT 
          produto,
          setor,
          SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as total_perda,
          SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as total_venda
        FROM vw_movimentacoes
        WHERE semana < $1
          AND semana >= $1 - 4
          AND EXTRACT(YEAR FROM data) = $2
      `;

      if (sector !== 'all') {
        prevWeeksQuery += ` AND setor = $3`;
      }

      prevWeeksQuery += ` GROUP BY produto, setor`;

      const prevParams = sector !== 'all' 
        ? [weekNumber, year, sector]
        : [weekNumber, year];

      const prevWeeksResult = await client.query(prevWeeksQuery, prevParams);

      // Query 4: Dados das 6 semanas anteriores para gráfico de tendência
      let trendQuery = `
        SELECT 
          semana,
          SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas_qtd,
          SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas_qtd,
          SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as vendas_valor
        FROM vw_movimentacoes
        WHERE semana BETWEEN $1 - 6 AND $1 - 1
          AND EXTRACT(YEAR FROM data) = $2
      `;

      const trendParams = [weekNumber, year];

      if (sector !== 'all') {
        trendQuery += ` AND setor = $3`;
        trendParams.push(sector);
      }

      trendQuery += ` GROUP BY semana ORDER BY semana`;

      const trendResult = await client.query(trendQuery, trendParams);

      return Response.json({
        topSales: topSalesResult.rows,
        lossAnalysis: lossAnalysisResult.rows,
        previousWeeksAvg: prevWeeksResult.rows,
        trendData: trendResult.rows,
        week: weekNumber,
        year: year
      });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('❌ Erro ao buscar dados do dashboard:', error.message);
    return Response.json({ 
      error: error.message,
      details: 'Erro ao buscar dados de vw_movimentacoes'
    }, { status: 500 });
  }
});