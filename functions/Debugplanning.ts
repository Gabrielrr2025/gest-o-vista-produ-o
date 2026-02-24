import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const connStr = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connStr) {
      return Response.json({ erro: 'POSTGRES_CONNECTION_URL não encontrada' });
    }

    const sql = neon(connStr);

    // Datas: últimas 8 semanas a partir de hoje
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    const oitoSemanasAtras = new Date(hoje);
    oitoSemanasAtras.setDate(oitoSemanasAtras.getDate() - 56);
    const recStartStr = oitoSemanasAtras.toISOString().split('T')[0];

    // 1. Contagem geral de dados
    const totalVendas = await sql`SELECT COUNT(*) as total, MIN(data) as mais_antiga, MAX(data) as mais_recente FROM vendas`;
    const totalPerdas = await sql`SELECT COUNT(*) as total, MIN(data) as mais_antiga, MAX(data) as mais_recente FROM perdas`;
    const totalProdutos = await sql`SELECT COUNT(*) as total FROM produtos WHERE status = 'ativo'`;

    // 2. Vendas/perdas reais via view (separando por tipo)
    const vendasRecentes = await sql`
      SELECT COUNT(*) as total, SUM(quantidade) as soma_qtd
      FROM vw_movimentacoes
      WHERE tipo = 'venda' AND data >= ${recStartStr} AND data < ${hojeStr}
    `;
    const perdasRecentes = await sql`
      SELECT COUNT(*) as total, SUM(quantidade) as soma_qtd
      FROM vw_movimentacoes
      WHERE tipo = 'perda' AND data >= ${recStartStr} AND data < ${hojeStr}
    `;

    // 3. Top 5 produtos com mais vendas no período
    const topProdutos = await sql`
      SELECT m.produto as nome, p.setor, COUNT(*) as qtd_registros, SUM(m.quantidade) as soma_vendas
      FROM vw_movimentacoes m
      JOIN produtos p ON m.produto = p.nome
      WHERE m.tipo = 'venda' AND m.data >= ${recStartStr} AND m.data < ${hojeStr}
      GROUP BY m.produto, p.setor
      ORDER BY soma_vendas DESC
      LIMIT 5
    `;

    // 4. Verificar JOIN por nome
    const amostraVendas = await sql`
      SELECT m.produto as nome_view, p.id as produto_id_produtos, p.nome as nome_tabela
      FROM vw_movimentacoes m
      LEFT JOIN produtos p ON m.produto = p.nome
      WHERE m.tipo = 'venda'
      LIMIT 5
    `;

    // 5. Produtos SEM vendas no histórico
    const produtosSemVenda = await sql`
      SELECT p.nome, p.setor
      FROM produtos p
      WHERE p.status = 'ativo'
      AND NOT EXISTS (
        SELECT 1 FROM vw_movimentacoes m
        WHERE m.produto = p.nome AND m.tipo = 'venda' AND m.data >= ${recStartStr}
      )
      LIMIT 10
    `;

    // 6. Distribuição por semana via view
    const vendasPorSemana = await sql`
      SELECT 
        date_trunc('week', data::date) as semana,
        COUNT(*) as registros,
        SUM(quantidade) as total_qtd
      FROM vw_movimentacoes
      WHERE tipo = 'venda' AND data >= ${recStartStr} AND data < ${hojeStr}
      GROUP BY semana
      ORDER BY semana
    `;

    return Response.json({
      diagnostico_planejamento: {
        periodo_historico: { de: recStartStr, ate: hojeStr },
        totais_gerais: {
          vendas: {
            total_registros: totalVendas[0]?.total,
            mais_antiga: totalVendas[0]?.mais_antiga,
            mais_recente: totalVendas[0]?.mais_recente
          },
          perdas: {
            total_registros: totalPerdas[0]?.total,
            mais_antiga: totalPerdas[0]?.mais_antiga,
            mais_recente: totalPerdas[0]?.mais_recente
          },
          produtos_ativos: totalProdutos[0]?.total,
        },
        dados_nas_ultimas_8_semanas: {
          vendas: {
            registros: vendasRecentes[0]?.total,
            quantidade_total: vendasRecentes[0]?.soma_qtd
          },
          perdas: {
            registros: perdasRecentes[0]?.total,
            quantidade_total: perdasRecentes[0]?.soma_qtd
          },
        },
        top5_produtos_com_vendas: topProdutos,
        produtos_sem_vendas_no_periodo: produtosSemVenda,
        vendas_por_semana: vendasPorSemana,
        amostra_join_produto_id: amostraVendas.map((r: any) => ({
          nome_na_view: r.nome_view,
          produto_id_encontrado: r.produto_id_produtos,
          nome_na_tabela: r.nome_tabela,
          join_ok: r.produto_id_produtos !== null,
        })),
      }
    });

  } catch (e: any) {
    return Response.json({ 
      erro: e.message,
      stack: e.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
});
