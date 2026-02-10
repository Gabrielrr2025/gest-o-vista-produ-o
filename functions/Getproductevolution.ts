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
      produtoId,
      startDate, 
      endDate,
      compareStartDate = null,
      compareEndDate = null,
      type = 'sales' // 'sales' ou 'losses'
    } = body;

    if (!produtoId || !startDate || !endDate) {
      return Response.json({ error: 'produtoId, startDate e endDate obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📈 Evolução ${type} do produto ${produtoId}: ${startDate} a ${endDate}`);

    // Buscar info do produto
    const produto = await sql`
      SELECT id, nome, setor, unidade
      FROM produtos
      WHERE id = ${produtoId}
    `;

    if (produto.length === 0) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    // ========================================
    // PERÍODO PRINCIPAL
    // ========================================

    let evolutionData = [];

    if (type === 'sales') {
      evolutionData = await sql`
        SELECT 
          v.data,
          SUM(v.valor_reais) as valor,
          SUM(v.quantidade) as quantidade
        FROM vendas v
        WHERE v.produto_id = ${produtoId}
          AND v.data BETWEEN ${startDate} AND ${endDate}
        GROUP BY v.data
        ORDER BY v.data
      `;
    } else if (type === 'losses') {
      evolutionData = await sql`
        SELECT 
          pe.data,
          SUM(pe.valor_reais) as valor,
          SUM(pe.quantidade) as quantidade
        FROM perdas pe
        WHERE pe.produto_id = ${produtoId}
          AND pe.data BETWEEN ${startDate} AND ${endDate}
        GROUP BY pe.data
        ORDER BY pe.data
      `;
    }

    console.log(`✅ ${evolutionData.length} pontos de dados`);

    // ========================================
    // PERÍODO DE COMPARAÇÃO
    // ========================================

    let compareEvolutionData = null;

    if (compareStartDate && compareEndDate) {
      console.log(`📈 Comparação: ${compareStartDate} a ${compareEndDate}`);

      if (type === 'sales') {
        compareEvolutionData = await sql`
          SELECT 
            v.data,
            SUM(v.valor_reais) as valor,
            SUM(v.quantidade) as quantidade
          FROM vendas v
          WHERE v.produto_id = ${produtoId}
            AND v.data BETWEEN ${compareStartDate} AND ${compareEndDate}
          GROUP BY v.data
          ORDER BY v.data
        `;
      } else if (type === 'losses') {
        compareEvolutionData = await sql`
          SELECT 
            pe.data,
            SUM(pe.valor_reais) as valor,
            SUM(pe.quantidade) as quantidade
          FROM perdas pe
          WHERE pe.produto_id = ${produtoId}
            AND pe.data BETWEEN ${compareStartDate} AND ${compareEndDate}
          GROUP BY pe.data
          ORDER BY pe.data
        `;
      }

      console.log(`✅ Comparação: ${compareEvolutionData.length} pontos`);
    }

    // ========================================
    // ESTATÍSTICAS
    // ========================================

    const totalValor = evolutionData.reduce((sum, d) => sum + parseFloat(d.valor), 0);
    const totalQuantidade = evolutionData.reduce((sum, d) => sum + parseFloat(d.quantidade), 0);
    const mediaValor = evolutionData.length > 0 ? totalValor / evolutionData.length : 0;

    let compareTotalValor = null;
    let variacao = null;

    if (compareEvolutionData) {
      compareTotalValor = compareEvolutionData.reduce((sum, d) => sum + parseFloat(d.valor), 0);
      variacao = compareTotalValor > 0 ? ((totalValor - compareTotalValor) / compareTotalValor) * 100 : null;
    }

    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      produto: produto[0],
      type,
      period: {
        start: startDate,
        end: endDate
      },
      comparePeriod: compareStartDate ? {
        start: compareStartDate,
        end: compareEndDate
      } : null,
      data: {
        evolution: evolutionData,
        stats: {
          totalValor,
          totalQuantidade,
          mediaValor,
          diasComDados: evolutionData.length
        }
      },
      compareData: compareEvolutionData ? {
        evolution: compareEvolutionData,
        stats: {
          totalValor: compareTotalValor,
          variacao
        }
      } : null
    });

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});
