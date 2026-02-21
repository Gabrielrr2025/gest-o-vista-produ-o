import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productName, weekNumber, year = 2026 } = body;

    if (!productName || !weekNumber) {
      return Response.json({ error: 'Missing productName or weekNumber' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'Database connection not configured' }, { status: 500 });
    }

    const { Client } = await import('npm:pg@8.11.3');
    const client = new Client(connectionString);
    
    await client.connect();

    try {
      // Query 1: Vendas e perdas da semana atual (CORRIGIDO)
      const weekDataQuery = `
        SELECT 
          SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas_semana,
          SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas_semana
        FROM vw_movimentacoes
        WHERE produto = $1
          AND numero_semana = $2
          AND ano = $3
      `;

      const weekDataResult = await client.query(weekDataQuery, [productName, weekNumber, year]);
      const weekData = weekDataResult.rows[0] || { vendas_semana: 0, perdas_semana: 0 };

      // Query 2: Média das últimas 4 semanas (CORRIGIDO)
      const avgQuery = `
        SELECT 
          AVG(vendas) as media_vendas,
          AVG(perdas) as media_perdas
        FROM (
          SELECT 
            numero_semana,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas
          FROM vw_movimentacoes
          WHERE produto = $1
            AND ano = $2
          GROUP BY numero_semana
          ORDER BY numero_semana DESC
          LIMIT 4
        ) ultimas_semanas
      `;

      const avgResult = await client.query(avgQuery, [productName, year]);
      const avgData = avgResult.rows[0] || { media_vendas: 0, media_perdas: 0 };

      console.log(`📊 Dados do produto ${productName} - Semana ${weekNumber}:`, {
        vendas_semana: weekData.vendas_semana,
        perdas_semana: weekData.perdas_semana,
        media_vendas: avgData.media_vendas,
        media_perdas: avgData.media_perdas
      });

      return Response.json({
        currentWeek: {
          sales: parseFloat(weekData.vendas_semana) || 0,
          losses: parseFloat(weekData.perdas_semana) || 0
        },
        average4Weeks: {
          sales: parseFloat(avgData.media_vendas) || 0,
          losses: parseFloat(avgData.media_perdas) || 0
        }
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error.message);
    return Response.json({ 
      error: error.message,
      details: 'Erro ao buscar dados da vw_movimentacoes'
    }, { status: 500 });
  }
});