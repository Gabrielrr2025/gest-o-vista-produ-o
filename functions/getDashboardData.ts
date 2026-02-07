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

    const sql = postgres(connectionString);

    try {
      console.log(`📊 Buscando dados do Dashboard: semana=${weekNumber}, ano=${year}, setor=${sector}`);

      // Query 1: Top 5 mais vendidos da semana
      let topSalesResult;
      if (sector !== 'all') {
        topSalesResult = await sql`
          SELECT 
            produto,
            SUM(quantidade) as total_vendas
          FROM vw_movimentacoes
          WHERE tipo = 'venda'
            AND numero_semana = ${weekNumber}
            AND ano = ${year}
            AND setor = ${sector}
          GROUP BY produto 
          ORDER BY total_vendas DESC 
          LIMIT 5
        `;
      } else {
        topSalesResult = await sql`
          SELECT 
            produto,
            SUM(quantidade) as total_vendas
          FROM vw_movimentacoes
          WHERE tipo = 'venda'
            AND numero_semana = ${weekNumber}
            AND ano = ${year}
          GROUP BY produto 
          ORDER BY total_vendas DESC 
          LIMIT 5
        `;
      }

      // Query 2: Análise de perdas da semana
      let lossAnalysisResult;
      if (sector !== 'all') {
        lossAnalysisResult = await sql`
          SELECT 
            produto,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perda,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as venda
          FROM vw_movimentacoes
          WHERE numero_semana = ${weekNumber}
            AND ano = ${year}
            AND setor = ${sector}
          GROUP BY produto
          HAVING SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) > 0
          ORDER BY perda DESC
        `;
      } else {
        lossAnalysisResult = await sql`
          SELECT 
            produto,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perda,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as venda
          FROM vw_movimentacoes
          WHERE numero_semana = ${weekNumber}
            AND ano = ${year}
          GROUP BY produto
          HAVING SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) > 0
          ORDER BY perda DESC
        `;
      }

      // Query 3: Dados das 6 semanas anteriores para gráfico de tendência
      let trendResult;
      if (sector !== 'all') {
        trendResult = await sql`
          SELECT 
            numero_semana,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas
          FROM vw_movimentacoes
          WHERE numero_semana <= ${weekNumber}
            AND numero_semana > ${weekNumber - 6}
            AND ano = ${year}
            AND setor = ${sector}
          GROUP BY numero_semana
          ORDER BY numero_semana
        `;
      } else {
        trendResult = await sql`
          SELECT 
            numero_semana,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas
          FROM vw_movimentacoes
          WHERE numero_semana <= ${weekNumber}
            AND numero_semana > ${weekNumber - 6}
            AND ano = ${year}
          GROUP BY numero_semana
          ORDER BY numero_semana
        `;
      }

      await sql.end();

      return Response.json({
        topSales: topSalesResult,
        lossAnalysis: lossAnalysisResult,
        trendData: trendResult,
        week: weekNumber,
        year: year
      });
    } catch (error) {
      await sql.end();
      throw error;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar dados do dashboard:', error.message);
    return Response.json({ 
      error: error.message,
      details: 'Erro ao buscar dados de vw_movimentacoes'
    }, { status: 500 });
  }
});