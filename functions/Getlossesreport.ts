import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
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

    // ========================================
    // VERSÃO SUPER SIMPLES - SEM JOINS
    // ========================================

    // Executar todas as queries em paralelo
    const [totalResult, rawData, productDetails, bySector, bySectorProduct] = await Promise.all([
      sql`
        SELECT SUM(valor_reais) as total_valor
        FROM perdas
        WHERE data >= ${startDate}::date AND data <= ${endDate}::date
      `,
      sql`
        SELECT data, SUM(valor_reais) as valor_reais, SUM(quantidade) as quantidade
        FROM perdas
        WHERE data >= ${startDate}::date AND data <= ${endDate}::date
        GROUP BY data
        ORDER BY data
      `,
      sql`
        SELECT 
          pe.produto_id, p.nome as produto_nome, p.setor, p.unidade,
          SUM(pe.valor_reais) as total_valor, SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_id = p.id
        WHERE pe.data >= ${startDate}::date AND pe.data <= ${endDate}::date
        GROUP BY pe.produto_id, p.nome, p.setor, p.unidade
        ORDER BY total_valor DESC
        LIMIT ${topN}
      `,
      sql`
        SELECT 
          COALESCE(p.setor, 'Sem Setor') as setor,
          SUM(pe.valor_reais) as total_valor, SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_id = p.id
        WHERE pe.data >= ${startDate}::date AND pe.data <= ${endDate}::date
        GROUP BY p.setor
        ORDER BY total_valor DESC
      `,
      sql`
        SELECT 
          COALESCE(p.setor, 'Sem Setor') as setor, pe.produto_id,
          p.nome as produto_nome, p.unidade,
          SUM(pe.valor_reais) as total_valor, SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        LEFT JOIN produtos p ON pe.produto_id = p.id
        WHERE pe.data >= ${startDate}::date AND pe.data <= ${endDate}::date
        GROUP BY p.setor, pe.produto_id, p.nome, p.unidade
        ORDER BY p.setor, total_valor DESC
      `
    ]);

    const totalGeral = parseFloat(totalResult[0]?.total_valor || 0);
    console.log(`✅ Queries paralelas concluídas. Total: R$ ${totalGeral.toFixed(2)}`);



    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      period: {
        start: startDate,
        end: endDate
      },
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
        totalGeral: totalGeral
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