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
      compareStartDate = null,
      compareEndDate = null,
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
    // PERÍODO PRINCIPAL
    // ========================================

    // Perdas por setor (agregado)
    const lossesBySector = await sql`
      SELECT 
        p.setor,
        SUM(pe.valor_reais) as total_valor,
        SUM(pe.quantidade) as total_quantidade
      FROM perdas pe
      JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.setor
      ORDER BY total_valor DESC
    `;

    // Buscar vendas do mesmo período para calcular taxa de perda
    const salesBySector = await sql`
      SELECT 
        p.setor,
        SUM(v.valor_reais) as total_valor
      FROM vendas v
      JOIN produtos p ON v.produto_id = p.id
      WHERE v.data BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.setor
    `;

    // Enriquecer perdas com taxa de perda (%)
    const lossesBySectorWithRate = lossesBySector.map(loss => {
      const sales = salesBySector.find(s => s.setor === loss.setor);
      const salesValue = sales ? parseFloat(sales.total_valor) : 0;
      const lossValue = parseFloat(loss.total_valor);
      const lossRate = salesValue > 0 ? (lossValue / salesValue) * 100 : 0;

      return {
        ...loss,
        total_vendas: salesValue,
        taxa_perda: lossRate
      };
    });

    // Perdas por produto (TOP N - maior perda em R$)
    const lossesByProduct = await sql`
      SELECT 
        p.id as produto_id,
        p.nome as produto_nome,
        p.setor,
        p.unidade,
        SUM(pe.valor_reais) as total_valor,
        SUM(pe.quantidade) as total_quantidade
      FROM perdas pe
      JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.id, p.nome, p.setor, p.unidade
      ORDER BY total_valor DESC
      LIMIT ${topN}
    `;

    // Enriquecer produtos com taxa de perda individual
    const salesByProductIds = await sql`
      SELECT 
        p.id as produto_id,
        SUM(v.valor_reais) as total_valor
      FROM vendas v
      JOIN produtos p ON v.produto_id = p.id
      WHERE v.data BETWEEN ${startDate} AND ${endDate}
        AND p.id IN (${lossesByProduct.map(p => p.produto_id).join(',')})
      GROUP BY p.id
    `;

    const lossesByProductWithRate = lossesByProduct.map(loss => {
      const sales = salesByProductIds.find(s => s.produto_id === loss.produto_id);
      const salesValue = sales ? parseFloat(sales.total_valor) : 0;
      const lossValue = parseFloat(loss.total_valor);
      const lossRate = salesValue > 0 ? (lossValue / salesValue) * 100 : 0;

      return {
        ...loss,
        total_vendas: salesValue,
        taxa_perda: lossRate
      };
    });

    // Perdas por setor E produto (para drill-down)
    const lossesBySectorProduct = await sql`
      SELECT 
        p.setor,
        p.id as produto_id,
        p.nome as produto_nome,
        p.unidade,
        SUM(pe.valor_reais) as total_valor,
        SUM(pe.quantidade) as total_quantidade
      FROM perdas pe
      JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data BETWEEN ${startDate} AND ${endDate}
      GROUP BY p.setor, p.id, p.nome, p.unidade
      ORDER BY p.setor, total_valor DESC
    `;

    // Total geral
    const totalGeral = lossesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor), 0);

    console.log(`✅ ${lossesBySector.length} setores, ${lossesByProduct.length} produtos`);

    // ========================================
    // PERÍODO DE COMPARAÇÃO
    // ========================================

    let compareData = null;

    if (compareStartDate && compareEndDate) {
      console.log(`💸 Comparação: ${compareStartDate} a ${compareEndDate}`);

      const compareLossesBySector = await sql`
        SELECT 
          p.setor,
          SUM(pe.valor_reais) as total_valor,
          SUM(pe.quantidade) as total_quantidade
        FROM perdas pe
        JOIN produtos p ON pe.produto_id = p.id
        WHERE pe.data BETWEEN ${compareStartDate} AND ${compareEndDate}
        GROUP BY p.setor
      `;

      const compareSalesBySector = await sql`
        SELECT 
          p.setor,
          SUM(v.valor_reais) as total_valor
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN ${compareStartDate} AND ${compareEndDate}
        GROUP BY p.setor
      `;

      const compareLossesBySectorWithRate = compareLossesBySector.map(loss => {
        const sales = compareSalesBySector.find(s => s.setor === loss.setor);
        const salesValue = sales ? parseFloat(sales.total_valor) : 0;
        const lossValue = parseFloat(loss.total_valor);
        const lossRate = salesValue > 0 ? (lossValue / salesValue) * 100 : 0;

        return {
          ...loss,
          total_vendas: salesValue,
          taxa_perda: lossRate
        };
      });

      const compareTotalGeral = compareLossesBySector.reduce((sum, s) => sum + parseFloat(s.total_valor), 0);

      compareData = {
        lossesBySector: compareLossesBySectorWithRate,
        totalGeral: compareTotalGeral
      };
    }

    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      period: {
        start: startDate,
        end: endDate
      },
      comparePeriod: compareStartDate ? {
        start: compareStartDate,
        end: compareEndDate
      } : null,
      data: {
        lossesBySector: lossesBySectorWithRate,
        lossesByProduct: lossesByProductWithRate,
        lossesBySectorProduct,
        totalGeral
      },
      compareData
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
