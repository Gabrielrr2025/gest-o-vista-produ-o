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
      compareStartDate, 
      compareEndDate,
      sector = 'all',
      productId = null,
      reportType = 'sales' // 'sales', 'losses', 'performance'
    } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate são obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📊 Gerando relatório: ${reportType}, período: ${startDate} a ${endDate}`);

    // ========================================
    // PERÍODO PRINCIPAL
    // ========================================

    let mainQuery = '';
    let mainParams = [startDate, endDate];
    
    if (reportType === 'sales') {
      mainQuery = `
        SELECT 
          v.data,
          p.id as produto_id,
          p.nome as produto_nome,
          p.setor,
          p.unidade,
          SUM(v.quantidade) as quantidade,
          SUM(v.valor_reais) as valor_reais
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN $1 AND $2
      `;
    } else if (reportType === 'losses') {
      mainQuery = `
        SELECT 
          pe.data,
          p.id as produto_id,
          p.nome as produto_nome,
          p.setor,
          p.unidade,
          SUM(pe.quantidade) as quantidade,
          SUM(pe.valor_reais) as valor_reais
        FROM perdas pe
        JOIN produtos p ON pe.produto_id = p.id
        WHERE pe.data BETWEEN $1 AND $2
      `;
    } else if (reportType === 'performance') {
      // Performance: vendas + perdas + planejamento
      mainQuery = `
        SELECT 
          v.data,
          p.id as produto_id,
          p.nome as produto_nome,
          p.setor,
          p.unidade,
          COALESCE(SUM(v.quantidade), 0) as vendas,
          COALESCE((SELECT SUM(pe.quantidade) 
                    FROM perdas pe 
                    WHERE pe.produto_id = p.id 
                      AND pe.data = v.data), 0) as perdas,
          COALESCE((SELECT SUM(pl.quantidade_planejada) 
                    FROM planejamento pl 
                    WHERE pl.produto_id = p.id 
                      AND pl.data = v.data), 0) as planejado
        FROM vendas v
        JOIN produtos p ON v.produto_id = p.id
        WHERE v.data BETWEEN $1 AND $2
      `;
    }

    // Aplicar filtros adicionais
    if (sector !== 'all') {
      mainQuery += ` AND p.setor = $${mainParams.length + 1}`;
      mainParams.push(sector);
    }

    if (productId) {
      mainQuery += ` AND p.id = $${mainParams.length + 1}`;
      mainParams.push(productId);
    }

    mainQuery += ` GROUP BY v.data, p.id, p.nome, p.setor, p.unidade ORDER BY v.data, p.nome`;

    const mainData = await sql(mainQuery, mainParams);

    console.log(`✅ ${mainData.length} registros no período principal`);

    // ========================================
    // PERÍODO DE COMPARAÇÃO (se fornecido)
    // ========================================

    let compareData = null;

    if (compareStartDate && compareEndDate) {
      console.log(`📊 Comparando com período: ${compareStartDate} a ${compareEndDate}`);

      let compareQuery = mainQuery.replace('v.data BETWEEN $1 AND $2', 'v.data BETWEEN $1 AND $2');
      let compareParams = [compareStartDate, compareEndDate];

      if (sector !== 'all') {
        compareParams.push(sector);
      }
      if (productId) {
        compareParams.push(productId);
      }

      compareData = await sql(compareQuery, compareParams);

      console.log(`✅ ${compareData.length} registros no período de comparação`);
    }

    // ========================================
    // AGREGAÇÕES E TOTAIS
    // ========================================

    // Total por setor
    const totalBySecor = {};
    const totalBySectorCompare = {};

    mainData.forEach(row => {
      const sector = row.setor;
      if (!totalBySecor[sector]) {
        totalBySecor[sector] = { quantidade: 0, valor_reais: 0 };
      }
      totalBySecor[sector].quantidade += parseFloat(row.quantidade || row.vendas || 0);
      totalBySecor[sector].valor_reais += parseFloat(row.valor_reais || 0);
    });

    if (compareData) {
      compareData.forEach(row => {
        const sector = row.setor;
        if (!totalBySectorCompare[sector]) {
          totalBySectorCompare[sector] = { quantidade: 0, valor_reais: 0 };
        }
        totalBySectorCompare[sector].quantidade += parseFloat(row.quantidade || row.vendas || 0);
        totalBySectorCompare[sector].valor_reais += parseFloat(row.valor_reais || 0);
      });
    }

    // Total por produto
    const totalByProduct = {};
    const totalByProductCompare = {};

    mainData.forEach(row => {
      const productId = row.produto_id;
      if (!totalByProduct[productId]) {
        totalByProduct[productId] = {
          nome: row.produto_nome,
          setor: row.setor,
          unidade: row.unidade,
          quantidade: 0,
          valor_reais: 0
        };
      }
      totalByProduct[productId].quantidade += parseFloat(row.quantidade || row.vendas || 0);
      totalByProduct[productId].valor_reais += parseFloat(row.valor_reais || 0);
    });

    if (compareData) {
      compareData.forEach(row => {
        const productId = row.produto_id;
        if (!totalByProductCompare[productId]) {
          totalByProductCompare[productId] = {
            nome: row.produto_nome,
            setor: row.setor,
            unidade: row.unidade,
            quantidade: 0,
            valor_reais: 0
          };
        }
        totalByProductCompare[productId].quantidade += parseFloat(row.quantidade || row.vendas || 0);
        totalByProductCompare[productId].valor_reais += parseFloat(row.valor_reais || 0);
      });
    }

    // Total geral
    const totalGeral = {
      quantidade: Object.values(totalBySecor).reduce((sum, s) => sum + s.quantidade, 0),
      valor_reais: Object.values(totalBySecor).reduce((sum, s) => sum + s.valor_reais, 0)
    };

    const totalGeralCompare = compareData ? {
      quantidade: Object.values(totalBySectorCompare).reduce((sum, s) => sum + s.quantidade, 0),
      valor_reais: Object.values(totalBySectorCompare).reduce((sum, s) => sum + s.valor_reais, 0)
    } : null;

    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      period: {
        start: startDate,
        end: endDate
      },
      comparePeriod: compareStartDate && compareEndDate ? {
        start: compareStartDate,
        end: compareEndDate
      } : null,
      reportType,
      filters: {
        sector,
        productId
      },
      data: {
        raw: mainData,
        totalBySecor,
        totalByProduct,
        totalGeral
      },
      compareData: compareData ? {
        raw: compareData,
        totalBySecor: totalBySectorCompare,
        totalByProduct: totalByProductCompare,
        totalGeral: totalGeralCompare
      } : null
    });

  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error.message);
    console.error('Stack:', error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});
