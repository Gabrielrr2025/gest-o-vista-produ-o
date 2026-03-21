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

    // JOIN com produtos para obter o setor (tabela perdas não tem setor diretamente)
    const [lossesBySector, lossesByProduct, lossesBySectorProduct, rawLossesData] = await Promise.all([
      // Por setor
      sql`
        SELECT
          COALESCE(p.departamento_desc, 'Sem Setor') as setor,
          SUM(pe.valor_total_venda) as total_valor,
          SUM(pe.quantidade) as total_quantidade,
          COUNT(DISTINCT pe.produto_codigo) as total_produtos
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_codigo = p.codigo
        WHERE pe.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY COALESCE(p.departamento_desc, 'Sem Setor')
        ORDER BY total_valor DESC
      `,
      // Top N produtos geral
      sql`
        SELECT
          pe.produto_codigo as produto_id,
          COALESCE(pe.produto_descricao, 'Desconhecido') as produto_nome,
          COALESCE(p.departamento_desc, 'Sem Setor') as setor,
          COALESCE(pe.unidade_venda, 'un') as unidade,
          SUM(pe.valor_total_venda) as total_valor,
          SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_codigo = p.codigo
        WHERE pe.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY pe.produto_codigo, pe.produto_descricao, p.departamento_desc, pe.unidade_venda
        ORDER BY total_valor DESC
        LIMIT ${topN}
      `,
      // Todos produtos por setor
      sql`
        SELECT
          COALESCE(p.departamento_desc, 'Sem Setor') as setor,
          pe.produto_codigo as produto_id,
          COALESCE(pe.produto_descricao, 'Desconhecido') as produto_nome,
          COALESCE(pe.unidade_venda, 'un') as unidade,
          SUM(pe.valor_total_venda) as total_valor,
          SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_codigo = p.codigo
        WHERE pe.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY p.departamento_desc, pe.produto_codigo, pe.produto_descricao, pe.unidade_venda
        ORDER BY setor, total_valor DESC
      `,
      // Raw data para gráficos
      sql`
        SELECT
          pe.data,
          COALESCE(p.departamento_desc, 'Sem Setor') as setor,
          COALESCE(pe.produto_descricao, 'Desconhecido') as produto,
          SUM(pe.valor_total_venda) as valor_reais,
          SUM(pe.quantidade) as quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_codigo = p.codigo
        WHERE pe.data BETWEEN ${startDate}::date AND ${endDate}::date
        GROUP BY pe.data, p.departamento_desc, pe.produto_descricao
        ORDER BY pe.data
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