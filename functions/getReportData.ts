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
      reportType = 'sales'
    } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate e endDate são obrigatórios' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📊 Relatório ${reportType}: ${startDate} a ${endDate}, setor: ${sector}`);

    // ========================================
    // QUERY PRINCIPAL (simplificada)
    // ========================================

    let mainData = [];

    if (reportType === 'sales') {
      if (sector === 'all') {
        mainData = await sql`
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
          WHERE v.data BETWEEN ${startDate} AND ${endDate}
          GROUP BY v.data, p.id, p.nome, p.setor, p.unidade
          ORDER BY v.data, p.nome
        `;
      } else {
        mainData = await sql`
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
          WHERE v.data BETWEEN ${startDate} AND ${endDate}
            AND p.setor = ${sector}
          GROUP BY v.data, p.id, p.nome, p.setor, p.unidade
          ORDER BY v.data, p.nome
        `;
      }
    } else if (reportType === 'losses') {
      if (sector === 'all') {
        mainData = await sql`
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
          WHERE pe.data BETWEEN ${startDate} AND ${endDate}
          GROUP BY pe.data, p.id, p.nome, p.setor, p.unidade
          ORDER BY pe.data, p.nome
        `;
      } else {
        mainData = await sql`
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
          WHERE pe.data BETWEEN ${startDate} AND ${endDate}
            AND p.setor = ${sector}
          GROUP BY pe.data, p.id, p.nome, p.setor, p.unidade
          ORDER BY pe.data, p.nome
        `;
      }
    }

    console.log(`✅ ${mainData.length} registros encontrados`);

    // ========================================
    // COMPARAÇÃO (se solicitado)
    // ========================================

    let compareData = null;

    if (compareStartDate && compareEndDate) {
      console.log(`📊 Buscando comparação: ${compareStartDate} a ${compareEndDate}`);

      if (reportType === 'sales') {
        if (sector === 'all') {
          compareData = await sql`
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
            WHERE v.data BETWEEN ${compareStartDate} AND ${compareEndDate}
            GROUP BY v.data, p.id, p.nome, p.setor, p.unidade
          `;
        } else {
          compareData = await sql`
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
            WHERE v.data BETWEEN ${compareStartDate} AND ${compareEndDate}
              AND p.setor = ${sector}
            GROUP BY v.data, p.id, p.nome, p.setor, p.unidade
          `;
        }
      } else if (reportType === 'losses') {
        if (sector === 'all') {
          compareData = await sql`
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
            WHERE pe.data BETWEEN ${compareStartDate} AND ${compareEndDate}
            GROUP BY pe.data, p.id, p.nome, p.setor, p.unidade
          `;
        } else {
          compareData = await sql`
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
            WHERE pe.data BETWEEN ${compareStartDate} AND ${compareEndDate}
              AND p.setor = ${sector}
            GROUP BY pe.data, p.id, p.nome, p.setor, p.unidade
          `;
        }
      }

      console.log(`✅ ${compareData.length} registros de comparação`);
    }

    // ========================================
    // PROCESSAR TOTAIS
    // ========================================

    // Total por setor
    const totalBySecor = {};
    mainData.forEach(row => {
      const s = row.setor;
      if (!totalBySecor[s]) totalBySecor[s] = { quantidade: 0, valor_reais: 0 };
      totalBySecor[s].quantidade += parseFloat(row.quantidade || 0);
      totalBySecor[s].valor_reais += parseFloat(row.valor_reais || 0);
    });

    // Total por produto
    const totalByProduct = {};
    mainData.forEach(row => {
      const pid = row.produto_id;
      if (!totalByProduct[pid]) {
        totalByProduct[pid] = {
          nome: row.produto_nome,
          setor: row.setor,
          unidade: row.unidade,
          quantidade: 0,
          valor_reais: 0
        };
      }
      totalByProduct[pid].quantidade += parseFloat(row.quantidade || 0);
      totalByProduct[pid].valor_reais += parseFloat(row.valor_reais || 0);
    });

    // Total geral
    const totalGeral = {
      quantidade: Object.values(totalBySecor).reduce((sum, s) => sum + s.quantidade, 0),
      valor_reais: Object.values(totalBySecor).reduce((sum, s) => sum + s.valor_reais, 0)
    };

    // Processar comparação
    let totalBySectorCompare = null;
    let totalByProductCompare = null;
    let totalGeralCompare = null;

    if (compareData) {
      totalBySectorCompare = {};
      compareData.forEach(row => {
        const s = row.setor;
        if (!totalBySectorCompare[s]) totalBySectorCompare[s] = { quantidade: 0, valor_reais: 0 };
        totalBySectorCompare[s].quantidade += parseFloat(row.quantidade || 0);
        totalBySectorCompare[s].valor_reais += parseFloat(row.valor_reais || 0);
      });

      totalByProductCompare = {};
      compareData.forEach(row => {
        const pid = row.produto_id;
        if (!totalByProductCompare[pid]) {
          totalByProductCompare[pid] = {
            nome: row.produto_nome,
            setor: row.setor,
            unidade: row.unidade,
            quantidade: 0,
            valor_reais: 0
          };
        }
        totalByProductCompare[pid].quantidade += parseFloat(row.quantidade || 0);
        totalByProductCompare[pid].valor_reais += parseFloat(row.valor_reais || 0);
      });

      totalGeralCompare = {
        quantidade: Object.values(totalBySectorCompare).reduce((sum, s) => sum + s.quantidade, 0),
        valor_reais: Object.values(totalBySectorCompare).reduce((sum, s) => sum + s.valor_reais, 0)
      };
    }

    // ========================================
    // RESPOSTA
    // ========================================

    return Response.json({
      period: { start: startDate, end: endDate },
      comparePeriod: compareStartDate ? { start: compareStartDate, end: compareEndDate } : null,
      reportType,
      filters: { sector },
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
    console.error('❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});
