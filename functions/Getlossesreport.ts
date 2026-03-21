import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { startDate, endDate, topN = 20 } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString) return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });

    const sql = neon(connectionString);
    console.log(`📊 Relatório de Perdas: ${startDate} a ${endDate}`);

    // Usa vw_movimentacoes (tipo = 'perda') que já consolida dados de todas as fontes
    const [lossesBySector, lossesByProduct, lossesBySectorProduct, rawLossesData] = await Promise.all([
      // Por setor
      sql`
        SELECT
          COALESCE(setor, 'Sem Setor') as setor,
          SUM(valor) as total_valor,
          SUM(quantidade) as total_quantidade,
          COUNT(DISTINCT produto_codigo) as total_produtos
        FROM vw_movimentacoes
        WHERE tipo = 'perda'
          AND data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY COALESCE(setor, 'Sem Setor')
        ORDER BY total_valor DESC
      `,
      // Top N produtos geral
      sql`
        SELECT
          produto_codigo as produto_id,
          produto as produto_nome,
          COALESCE(setor, 'Sem Setor') as setor,
          COALESCE(unidade, 'un') as unidade,
          SUM(valor) as total_valor,
          SUM(quantidade) as total_quantidade
        FROM vw_movimentacoes
        WHERE tipo = 'perda'
          AND data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY produto_codigo, produto, setor, unidade
        ORDER BY total_valor DESC
        LIMIT ${topN}
      `,
      // Todos produtos por setor
      sql`
        SELECT
          COALESCE(setor, 'Sem Setor') as setor,
          produto_codigo as produto_id,
          produto as produto_nome,
          COALESCE(unidade, 'un') as unidade,
          SUM(valor) as total_valor,
          SUM(quantidade) as total_quantidade
        FROM vw_movimentacoes
        WHERE tipo = 'perda'
          AND data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY setor, produto_codigo, produto, unidade
        ORDER BY setor, total_valor DESC
      `,
      // Raw data para gráficos
      sql`
        SELECT
          data,
          COALESCE(setor, 'Sem Setor') as setor,
          produto,
          SUM(valor) as valor_reais,
          SUM(quantidade) as quantidade
        FROM vw_movimentacoes
        WHERE tipo = 'perda'
          AND data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY data, setor, produto
        ORDER BY data
      `
    ]);

    const totalGeral = lossesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor || 0), 0);
    console.log(`✅ Perdas: ${lossesBySector.length} setores, ${lossesByProduct.length} produtos, total R$ ${totalGeral.toFixed(2)}`);

    return Response.json({
      period: { start: startDate, end: endDate },
      data: {
        lossesBySector,
        lossesByProduct,
        lossesBySectorProduct,
        rawData: rawLossesData,
        totalGeral
      }
    });

  } catch (error) {
    console.error('❌ ERRO Perdas:', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});