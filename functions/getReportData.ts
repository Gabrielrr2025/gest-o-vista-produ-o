import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

type PgError = {
  message?: string;
  stack?: string;
  code?: string;
  detail?: string;
  hint?: string;
};

const buildPeriodFields = (granularity: string) => {
  switch (granularity) {
    case 'day':
      return {
        periodDate: `date_trunc('day', data::date)`,
        periodKey: `to_char(date_trunc('day', data::date), 'YYYY-MM-DD')`,
        periodLabel: `to_char(date_trunc('day', data::date), 'DD/MM/YYYY')`
      };
    case 'month':
      return {
        periodDate: `date_trunc('month', data::date)`,
        periodKey: `to_char(date_trunc('month', data::date), 'YYYY-MM')`,
        periodLabel: `to_char(date_trunc('month', data::date), 'MM/YYYY')`
      };
    case 'year':
      return {
        periodDate: `date_trunc('year', data::date)`,
        periodKey: `to_char(date_trunc('year', data::date), 'YYYY')`,
        periodLabel: `to_char(date_trunc('year', data::date), 'YYYY')`
      };
    case 'week':
    default:
      return {
        periodDate: `date_trunc('week', data::date)`,
        periodKey: `to_char(date_trunc('week', data::date), 'IYYY-"W"IW')`,
        periodLabel: `to_char(date_trunc('week', data::date), 'IW/YYYY')`
      };
  }
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const logError = (err: unknown) => {
  console.error('[getReportData] ERROR', err);
  const message = (err as PgError)?.message;
  const stack = (err as PgError)?.stack;
  if (message) console.error('[getReportData] ERROR message:', message);
  if (stack) console.error('[getReportData] ERROR stack:', stack);
};

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
      granularity = 'week',
      compareMode = 'none'
    } = body ?? {};

    const allowedGranularities = new Set(['day', 'week', 'month', 'year']);
    const allowedCompareModes = new Set(['none', 'previous', 'yoy']);

    if (!startDate || !endDate) {
      return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }
    if (!allowedGranularities.has(granularity)) {
      return Response.json({ error: 'Invalid granularity' }, { status: 400 });
    }
    if (!allowedCompareModes.has(compareMode)) {
      return Response.json({ error: 'Invalid compareMode' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) {
      return Response.json({ error: 'Database connection not configured' }, { status: 500 });
    }

    const { Client } = await import('npm:pg@8.11.3');
    const client = new Client(connectionString);

    await client.connect();

    try {
      console.log('🧭 getReportData inputs:', { startDate, endDate, granularity, compareMode });

      // Sanity check (helps diagnose empty/invalid view)
      const sanityQuery =
        'select count(*) as n, min(data) as min, max(data) as max from vw_movimentacoes;';
      console.log('🧪 Sanity SQL:', sanityQuery);
      const sanityResult = await client.query(sanityQuery);
      console.log('🧪 Sanity result:', sanityResult.rows?.[0]);

      const runQueries = async (rangeStart: string, rangeEnd: string) => {
        const { periodKey, periodLabel } = buildPeriodFields(granularity);
        const baseParams = [rangeStart, rangeEnd];

        console.log(
          `📊 Buscando dados de relatório: ${rangeStart} a ${rangeEnd}, granularidade=${granularity}`
        );

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
        console.log('🧾 SQL salesLoss:', salesLossQuery.trim());

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
        console.log('🧾 SQL lossRate:', lossRateQuery.trim());

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
        console.log('🧾 SQL revenue:', revenueQuery.trim());

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
        console.log('🧾 SQL summary:', summaryQuery.trim());

        try {
          const [salesLossResult, lossRateResult, revenueResult, summaryResult] =
            await Promise.all([
              client.query(salesLossQuery, baseParams),
              client.query(lossRateQuery, baseParams),
              client.query(revenueQuery, baseParams),
              client.query(summaryQuery, baseParams)
            ]);

          console.log('📈 RowCounts:', {
            salesLoss: salesLossResult.rowCount,
            lossRate: lossRateResult.rowCount,
            revenue: revenueResult.rowCount,
            summary: summaryResult.rowCount
          });

          return {
            salesLoss: salesLossResult.rows,
            lossRate: lossRateResult.rows,
            revenue: revenueResult.rows,
            summary: summaryResult.rows
          };
        } catch (err) {
          console.error('❌ Erro ao executar queries:', err);
          console.error('❌ Stack trace:', (err as PgError)?.stack);
          throw err;
        }
      };

      const current = await runQueries(startDate, endDate);

      let comparison: unknown = null;
      if (compareMode !== 'none') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let comparisonStart = new Date(start);
        let comparisonEnd = new Date(end);

        if (compareMode === 'previous') {
          const durationDays =
            Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          comparisonEnd.setDate(comparisonEnd.getDate() - durationDays);
          comparisonStart = new Date(comparisonEnd);
          comparisonStart.setDate(comparisonStart.getDate() - durationDays + 1);
        } else if (compareMode === 'yoy') {
          comparisonStart.setFullYear(comparisonStart.getFullYear() - 1);
          comparisonEnd.setFullYear(comparisonEnd.getFullYear() - 1);
        }

        console.log('🧭 Comparison range:', {
          compareMode,
          comparisonStart: formatDate(comparisonStart),
          comparisonEnd: formatDate(comparisonEnd)
        });

        comparison = await runQueries(formatDate(comparisonStart), formatDate(comparisonEnd));
      }

      console.log('✅ Dados de relatório obtidos');

      return Response.json({ current, comparison });
    } finally {
      await client.end();
    }
  } catch (error) {
    logError(error);

    const pgError = error as PgError;
    return Response.json(
      {
        ok: false,
        error: pgError?.message ?? String(error),
        stack: pgError?.stack ?? null,
        code: pgError?.code ?? null,
        detail: pgError?.detail ?? null,
        hint: pgError?.hint ?? null
      },
      { status: 500 }
    );
  }
});
