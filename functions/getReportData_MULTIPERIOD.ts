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
      periods = [], // Array de períodos: [{ startDate, endDate, label }]
      reportType = 'sales',
      sector = 'all'
    } = body;

    // Validar que há pelo menos 1 período
    if (!periods || periods.length === 0) {
      return Response.json({ error: 'Pelo menos 1 período é obrigatório' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📊 Relatório ${reportType}: ${periods.length} período(s), setor: ${sector}`);

    // Buscar dados para cada período
    const periodsData = [];

    for (const period of periods) {
      const { startDate, endDate, label } = period;
      
      console.log(`📅 Buscando: ${label} (${startDate} a ${endDate})`);

      let data = [];

      // Query baseada no tipo de relatório
      if (reportType === 'sales') {
        if (sector === 'all') {
          data = await sql`
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
          data = await sql`
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
          data = await sql`
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
          data = await sql`
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

      console.log(`✅ ${data.length} registros encontrados para ${label}`);

      // Processar totais deste período
      const totalBySecor = {};
      const totalByProduct = {};

      data.forEach(row => {
        // Por setor
        const s = row.setor;
        if (!totalBySecor[s]) totalBySecor[s] = { quantidade: 0, valor_reais: 0 };
        totalBySecor[s].quantidade += parseFloat(row.quantidade || 0);
        totalBySecor[s].valor_reais += parseFloat(row.valor_reais || 0);

        // Por produto
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

      periodsData.push({
        label,
        period: { start: startDate, end: endDate },
        data: {
          raw: data,
          totalBySecor,
          totalByProduct,
          totalGeral
        }
      });
    }

    console.log(`✅ Dados processados para ${periodsData.length} período(s)`);

    return Response.json({
      reportType,
      filters: { sector },
      periods: periodsData
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
