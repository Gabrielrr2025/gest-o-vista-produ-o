import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

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
      topN = 10
    } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`💸 Relatório de Perdas: ${startDate} a ${endDate}`);

    // Tabela perdas: produto_codigo, produto_descricao, unidade_venda, quantidade, valor_total_venda
    // Join com produtos via: perdas.produto_codigo = produtos.codigo

    const [totalResult, rawData, productDetails, bySector, bySectorProduct] = await Promise.all([
      sql`
        SELECT SUM(pe.valor_total_venda) as total_valor
        FROM perdas pe
        WHERE pe.data >= ${startDate}::date AND pe.data <= ${endDate}::date
      `,
      sql`
        SELECT pe.data, SUM(pe.valor_total_venda) as valor_reais, SUM(pe.quantidade) as quantidade
        FROM perdas pe
        WHERE pe.data >= ${startDate}::date AND pe.data <= ${endDate}::date
        GROUP BY pe.data
        ORDER BY pe.data
      `,
      sql`
        SELECT 
          pe.produto_codigo as produto_id,
          COALESCE(p.nome, pe.produto_descricao) as produto_nome,
          COALESCE(p.setor, p.departamento_desc, 'Sem Setor') as setor,
          COALESCE(p.unidade, pe.unidade_venda, 'un') as unidade,
          SUM(pe.valor_total_venda) as total_valor,
          SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_codigo = p.codigo
        WHERE pe.data >= ${startDate}::date AND pe.data <= ${endDate}::date
        GROUP BY pe.produto_codigo, produto_nome, setor, unidade
        ORDER BY total_valor DESC
        LIMIT ${topN}
      `,
      sql`
        SELECT 
          COALESCE(p.setor, p.departamento_desc, 'Sem Setor') as setor,
          SUM(pe.valor_total_venda) as total_valor,
          SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_codigo = p.codigo
        WHERE pe.data >= ${startDate}::date AND pe.data <= ${endDate}::date
        GROUP BY COALESCE(p.setor, p.departamento_desc, 'Sem Setor')
        ORDER BY total_valor DESC
      `,
      sql`
        SELECT 
          COALESCE(p.setor, p.departamento_desc, 'Sem Setor') as setor,
          pe.produto_codigo as produto_id,
          COALESCE(p.nome, pe.produto_descricao) as produto_nome,
          COALESCE(p.unidade, pe.unidade_venda, 'un') as unidade,
          SUM(pe.valor_total_venda) as total_valor,
          SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_codigo = p.codigo
        WHERE pe.data >= ${startDate}::date AND pe.data <= ${endDate}::date
        GROUP BY setor, pe.produto_codigo, produto_nome, unidade
        ORDER BY setor, total_valor DESC
      `
    ]);

    const totalGeral = parseFloat(totalResult[0]?.total_valor || 0);
    console.log(`✅ Perdas carregadas. Total: R$ ${totalGeral.toFixed(2)}`);

    return Response.json({
      period: { start: startDate, end: endDate },
      data: {
        lossesBySector: bySector.map(s => ({
          setor: s.setor,
          total_valor: parseFloat(s.total_valor || 0),
          total_quantidade: parseFloat(s.total_quantidade || 0)
        })),
        lossesByProduct: productDetails.map(p => ({
          produto_id: p.produto_id,
          produto_nome: p.produto_nome || `Produto #${p.produto_id}`,
          setor: p.setor || 'Sem Setor',
          unidade: p.unidade || 'un',
          total_valor: parseFloat(p.total_valor || 0),
          total_quantidade: parseFloat(p.total_quantidade || 0)
        })),
        lossesBySectorProduct: bySectorProduct.map(p => ({
          setor: p.setor,
          produto_id: p.produto_id,
          produto_nome: p.produto_nome || `Produto #${p.produto_id}`,
          unidade: p.unidade || 'un',
          total_valor: parseFloat(p.total_valor || 0),
          total_quantidade: parseFloat(p.total_quantidade || 0)
        })),
        rawData: rawData.map(r => ({
          data: r.data,
          valor_reais: parseFloat(r.valor_reais || 0),
          quantidade: parseFloat(r.quantidade || 0)
        })),
        totalGeral
      },
      compareData: null
    });

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
    console.error('Nome do erro:', error.name);
    
    return Response.json({ 
      error: error.message,
      errorName: error.name,
      stack: error.stack
    }, { status: 500 });
  }
});