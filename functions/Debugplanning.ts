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

    // 2. Vendas nas últimas 8 semanas (janela usada pelo planejamento)
    const vendasRecentes = await sql`
      SELECT COUNT(*) as total, SUM(quantidade) as soma_qtd
      FROM vendas
      WHERE data >= ${recStartStr} AND data < ${hojeStr}
    `;
    const perdasRecentes = await sql`
      SELECT COUNT(*) as total, SUM(quantidade) as soma_qtd
      FROM perdas
      WHERE data >= ${recStartStr} AND data < ${hojeStr}
    `;

    // 3. Top 5 produtos com mais vendas no período
    const topProdutos = await sql`
      SELECT p.nome, p.setor, COUNT(v.id) as qtd_registros, SUM(v.quantidade) as soma_vendas
      FROM vendas v
      JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= ${recStartStr} AND v.data < ${hojeStr}
      GROUP BY p.nome, p.setor
      ORDER BY soma_vendas DESC
      LIMIT 5
    `;

    // 4. Verificar se produto_id bate entre tabelas (JOIN ok?)
    const amostraVendas = await sql`
      SELECT v.produto_id, p.nome, p.id as produto_id_produtos
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      LIMIT 5
    `;

    // 5. Produtos SEM nenhuma venda no histórico
    const produtosSemVenda = await sql`
      SELECT p.nome, p.setor
      FROM produtos p
      WHERE p.status = 'ativo'
      AND NOT EXISTS (
        SELECT 1 FROM vendas v WHERE v.produto_id = p.id AND v.data >= ${recStartStr}
      )
      LIMIT 10
    `;

    // 6. Distribuição de vendas por semana
    const vendasPorSemana = await sql`
      SELECT 
        date_trunc('week', data::date) as semana,
        COUNT(*) as registros,
        SUM(quantidade) as total_qtd
      FROM vendas
      WHERE data >= ${recStartStr} AND data < ${hojeStr}
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
          venda_produto_id: r.produto_id,
          tipo_venda_id: typeof r.produto_id,
          produto_nome: r.nome,
          produto_tabela_id: r.produto_id_produtos,
          tipo_produto_id: typeof r.produto_id_produtos,
          join_ok: r.nome !== null,
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
