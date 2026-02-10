import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const buildPeriodFields = (granularity: string) => {
  switch (granularity) {
    case 'day':
      return {
        periodDate: `date_trunc('day', data)`,
        periodKey: `to_char(date_trunc('day', data), 'YYYY-MM-DD')`,
        periodLabel: `to_char(date_trunc('day', data), 'DD/MM/YYYY')`
      };
    case 'month':
      return {
        periodDate: `date_trunc('month', data)`,
        periodKey: `to_char(date_trunc('month', data), 'YYYY-MM')`,
        periodLabel: `to_char(date_trunc('month', data), 'MM/YYYY')`
      };
    case 'year':
      return {
        periodDate: `date_trunc('year', data)`,
        periodKey: `to_char(date_trunc('year', data), 'YYYY')`,
        periodLabel: `to_char(date_trunc('year', data), 'YYYY')`
      };
    case 'week':
    default:
      return {
        periodDate: `date_trunc('week', data)`,
        periodKey: `to_char(date_trunc('week', data), 'IYYY-"W"IW')`,
        periodLabel: `to_char(date_trunc('week', data), 'IW/YYYY')`
      };
  }
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { startDate, endDate, granularity = 'week', compareMode = 'none' } = body;

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
      const runQueries = async (rangeStart: string, rangeEnd: string) => {
        const { periodKey, periodLabel } = buildPeriodFields(granularity);

        const baseParams = [rangeStart, rangeEnd];

        console.log(`📊 Buscando dados de relatório: ${rangeStart} a ${rangeEnd}, granularidade=${granularity}`);

        const salesLossQuery = `
          SELECT 
            ${periodKey} as period_key,
            ${periodLabel} as period_label,
            SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as vendas_reais,
            SUM(CASE WHEN tipo = 'perda' THEN valor ELSE 0 END) as perdas_reais
          FROM vw_movimentacoes
          WHERE data BETWEEN $1 AND $2
          GROUP BY ${periodKey}, ${periodLabel}
          ORDER BY ${periodKey}
        `;

        const lossRateQuery = `
          SELECT 
            ${periodKey} as period_key,
            ${periodLabel} as period_label,
            (SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) / 
             NULLIF(SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END), 0) * 100) as taxa_perda
          FROM vw_movimentacoes
          WHERE data BETWEEN $1 AND $2
          GROUP BY ${periodKey}, ${periodLabel}
          ORDER BY ${periodKey}
        `;

        const revenueQuery = `
          SELECT 
            ${periodKey} as period_key,
            ${periodLabel} as period_label,
            SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as faturamento
          FROM vw_movimentacoes
          WHERE data BETWEEN $1 AND $2
          GROUP BY ${periodKey}, ${periodLabel}
          ORDER BY ${periodKey}
        `;

        const summaryQuery = `
          SELECT 
            ${periodKey} as period_key,
            ${periodLabel} as period_label,
            SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END) as vendas_qtd,
            SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) as perdas_qtd,
            (SUM(CASE WHEN tipo = 'perda' THEN quantidade ELSE 0 END) / 
             NULLIF(SUM(CASE WHEN tipo = 'venda' THEN quantidade ELSE 0 END), 0) * 100) as taxa_perda,
            SUM(CASE WHEN tipo = 'venda' THEN valor ELSE 0 END) as faturamento
          FROM vw_movimentacoes
          WHERE data BETWEEN $1 AND $2
          GROUP BY ${periodKey}, ${periodLabel}
          ORDER BY ${periodKey}
        `;

        const [salesLossResult, lossRateResult, revenueResult, summaryResult] = await Promise.all([
          client.query(salesLossQuery, baseParams),
          client.query(lossRateQuery, baseParams),
          client.query(revenueQuery, baseParams),
          client.query(summaryQuery, baseParams)
        ]);

        return {
          salesLoss: salesLossResult.rows,
          lossRate: lossRateResult.rows,
          revenue: revenueResult.rows,
          summary: summaryResult.rows
        };
      };

      const current = await runQueries(startDate, endDate);

      let comparison = null;
      if (compareMode !== 'none') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let comparisonStart = new Date(start);
        let comparisonEnd = new Date(end);

        if (compareMode === 'previous') {
          const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          comparisonEnd.setDate(comparisonEnd.getDate() - durationDays);
          comparisonStart = new Date(comparisonEnd);
          comparisonStart.setDate(comparisonStart.getDate() - durationDays + 1);
        } else if (compareMode === 'yoy') {
          comparisonStart.setFullYear(comparisonStart.getFullYear() - 1);
          comparisonEnd.setFullYear(comparisonEnd.getFullYear() - 1);
        }

        comparison = await runQueries(formatDate(comparisonStart), formatDate(comparisonEnd));
      }

      console.log(`✅ Dados de relatório obtidos`);

      return Response.json({
        current,
        comparison
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
