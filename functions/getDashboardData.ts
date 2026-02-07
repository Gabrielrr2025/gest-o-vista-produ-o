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
            SUM(quantidade) as total_vendas,
            SUM(valor) as total_valor
          FROM vw_movimentacoes
          WHERE tipo = 'venda'
            AND semana = ${weekNumber}
            AND EXTRACT(YEAR FROM data) = ${year}
            AND setor = ${sector}
          GROUP BY produto 
          ORDER BY total_vendas DESC 
          LIMIT 5
        `;
      } else {
        topSalesResult = await sql`
          SELECT 
            produto,
            SUM(quantidade) as total_vendas,
            SUM(valor) as total_valor
          FROM vw_movimentacoes
          WHERE tipo = 'venda'
            AND semana = ${weekNumber}
            AND EXTRACT(YEAR FROM data) = ${year}
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
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as venda,
            setor
          FROM vw_movimentacoes
          WHERE semana = ${weekNumber}
            AND EXTRACT(YEAR FROM data) = ${year}
            AND setor = ${sector}
          GROUP BY produto, setor
          HAVING SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) > 0
          ORDER BY perda DESC
        `;
      } else {
        lossAnalysisResult = await sql`
          SELECT 
            produto,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perda,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as venda,
            setor
          FROM vw_movimentacoes
          WHERE semana = ${weekNumber}
            AND EXTRACT(YEAR FROM data) = ${year}
          GROUP BY produto, setor
          HAVING SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) > 0
          ORDER BY perda DESC
        `;
      }

      // Query 3: Média de perdas das 4 semanas anteriores (para comparação de alertas)
      let prevWeeksResult;
      if (sector !== 'all') {
        prevWeeksResult = await sql`
          SELECT 
            produto,
            setor,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as total_perda,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as total_venda
          FROM vw_movimentacoes
          WHERE semana < ${weekNumber}
            AND semana >= ${weekNumber - 4}
            AND EXTRACT(YEAR FROM data) = ${year}
            AND setor = ${sector}
          GROUP BY produto, setor
        `;
      } else {
        prevWeeksResult = await sql`
          SELECT 
            produto,
            setor,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as total_perda,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as total_venda
          FROM vw_movimentacoes
          WHERE semana < ${weekNumber}
            AND semana >= ${weekNumber - 4}
            AND EXTRACT(YEAR FROM data) = ${year}
          GROUP BY produto, setor
        `;
      }

      // Query 4: Dados das 6 semanas anteriores para gráfico de tendência
      let trendResult;
      if (sector !== 'all') {
        trendResult = await sql`
          SELECT 
            semana,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas_qtd,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas_qtd,
            SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as vendas_valor
          FROM vw_movimentacoes
          WHERE semana BETWEEN ${weekNumber - 6} AND ${weekNumber - 1}
            AND EXTRACT(YEAR FROM data) = ${year}
            AND setor = ${sector}
          GROUP BY semana 
          ORDER BY semana
        `;
      } else {
        trendResult = await sql`
          SELECT 
            semana,
            SUM(CASE WHEN tipo = 'venda' ENTÃO quantidade ELSE 0 END) as vendas_qtd,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas_qtd,
            SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as vendas_valor
          FROM vw_movimentacoes
          WHERE semana BETWEEN ${weekNumber - 6} AND ${weekNumber - 1}
            AND EXTRACT(YEAR FROM data) = ${year}
          GROUP BY semana 
          ORDER BY semana
        `;
      }

      await sql.end();

      return Response.json({
        topSales: topSalesResult,
        lossAnalysis: lossAnalysisResult,
        previousWeeksAvg: prevWeeksResult,
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
    try {
      await sql?.end?.();
    } catch (e) {
      // Ignore cleanup errors
    }
    return Response.json({ 
      error: error.message,
      details: 'Erro ao buscar dados de vw_movimentacoes'
    }, { status: 500 });
  }
});