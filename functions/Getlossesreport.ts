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

    // DEBUG: Verificar se há dados no período
    const debugCount = await sql`
      SELECT COUNT(*) as total
      FROM perdas
      WHERE data BETWEEN ${startDate} AND ${endDate}
    `;
    console.log(`📊 Debug: ${debugCount[0].total} registros de perdas encontrados no período`);

    // ========================================
    // QUERIES SIMPLIFICADAS
    // ========================================

    // 1. Perdas por setor (com LEFT JOIN para evitar erro)
    const lossesBySector = await sql`
      SELECT 
        COALESCE(p.setor, 'Sem Setor') as setor,
        SUM(pe.valor_reais) as total_valor,
        SUM(pe.quantidade) as total_quantidade
      FROM perdas pe
      LEFT JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.setor
      ORDER BY total_valor DESC
    `;

    // 2. Perdas por produto (TOP N)
    const lossesByProduct = await sql`
      SELECT 
        p.id as produto_id,
        COALESCE(p.nome, 'Produto #' || pe.produto_id::text) as produto_nome,
        COALESCE(p.setor, 'Sem Setor') as setor,
        COALESCE(p.unidade, 'un') as unidade,
        SUM(pe.valor_reais) as total_valor,
        SUM(pe.quantidade) as total_quantidade
      FROM perdas pe
      LEFT JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.id, p.nome, p.setor, p.unidade, pe.produto_id
      ORDER BY total_valor DESC
      LIMIT ${topN}
    `;

    // 3. Perdas por setor E produto (para drill-down)
    const lossesBySectorProduct = await sql`
      SELECT 
        COALESCE(p.setor, 'Sem Setor') as setor,
        p.id as produto_id,
        COALESCE(p.nome, 'Produto #' || pe.produto_id::text) as produto_nome,
        COALESCE(p.unidade, 'un') as unidade,
        SUM(pe.valor_reais) as total_valor,
        SUM(pe.quantidade) as total_quantidade
      FROM perdas pe
      LEFT JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.setor, p.id, p.nome, p.unidade, pe.produto_id
      ORDER BY p.setor, total_valor DESC
    `;

    // 4. Dados brutos agregados por data (CORRIGIDO)
    const rawLossesData = await sql`
      SELECT 
        pe.data,
        SUM(pe.valor_reais) as valor_reais,
        SUM(pe.quantidade) as quantidade
      FROM perdas pe
      WHERE pe.data BETWEEN ${startDate} AND ${endDate}
      GROUP BY pe.data
      ORDER BY pe.data
    `;

    // 5. Total geral
    const totalGeral = lossesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor || 0), 0);

    console.log(`✅ Perdas processadas: ${lossesBySector.length} setores, ${lossesByProduct.length} produtos, Total: R$ ${totalGeral.toFixed(2)}`);

    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      period: {
        start: startDate,
        end: endDate
      },
      data: {
        lossesBySector: lossesBySector.map(s => ({
          setor: s.setor,
          total_valor: parseFloat(s.total_valor || 0),
          total_quantidade: parseFloat(s.total_quantidade || 0)
        })),
        lossesByProduct: lossesByProduct.map(p => ({
          produto_id: p.produto_id,
          produto_nome: p.produto_nome,
          setor: p.setor,
          unidade: p.unidade,
          total_valor: parseFloat(p.total_valor || 0),
          total_quantidade: parseFloat(p.total_quantidade || 0)
        })),
        lossesBySectorProduct: lossesBySectorProduct.map(p => ({
          setor: p.setor,
          produto_id: p.produto_id,
          produto_nome: p.produto_nome,
          unidade: p.unidade,
          total_valor: parseFloat(p.total_valor || 0),
          total_quantidade: parseFloat(p.total_quantidade || 0)
        })),
        rawData: rawLossesData.map(r => ({
          data: r.data,
          valor_reais: parseFloat(r.valor_reais || 0),
          quantidade: parseFloat(r.quantidade || 0)
        })),
        totalGeral
      },
      compareData: null // Simplificado - sem comparação por enquanto
    });

  } catch (error) {
    console.error('❌ ERRO getLossesReport:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      details: error.stack,
      hint: 'Verifique se: 1) A tabela perdas existe, 2) Os produto_id existem na tabela produtos, 3) As colunas data, valor_reais, quantidade existem'
    }, { status: 500 });
  }
});
