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
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    
    if (!connectionString) {
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });
    }

    const sql = neon(connectionString);

    console.log(`📋 Buscando dados de planejamento: ${startDate} a ${endDate}`);

    // Calcular data de 4 semanas atrás (28 dias)
    const startDateObj = new Date(startDate);
    const fourWeeksAgo = new Date(startDateObj);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

    console.log(`📅 Buscando histórico desde: ${fourWeeksAgoStr}`);

    // Query 1: Buscar todos os produtos ativos com dias de produção
    const productsQuery = `
      SELECT id, nome, setor, unidade, status, dias_producao
      FROM produtos
      WHERE status = 'ativo'
      ORDER BY setor, nome
    `;
    const products = await sql(productsQuery);

    console.log(`✅ ${products.length} produtos ativos encontrados`);

    // Query 2: Buscar vendas das últimas 4 semanas (para calcular médias)
    const salesHistoryQuery = `
      SELECT 
        p.id as produto_id,
        p.nome as produto_nome,
        v.data,
        v.quantidade
      FROM vendas v
      JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= $1 AND v.data < $2
      ORDER BY v.data DESC
    `;
    const salesHistory = await sql(salesHistoryQuery, [fourWeeksAgoStr, startDate]);

    console.log(`📊 ${salesHistory.length} registros de vendas encontrados (últimas 4 semanas)`);

    // Query 3: Buscar perdas das últimas 4 semanas
    const lossHistoryQuery = `
      SELECT 
        p.id as produto_id,
        p.nome as produto_nome,
        pe.data,
        pe.quantidade
      FROM perdas pe
      JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data >= $1 AND pe.data < $2
      ORDER BY pe.data DESC
    `;
    const lossHistory = await sql(lossHistoryQuery, [fourWeeksAgoStr, startDate]);

    console.log(`📉 ${lossHistory.length} registros de perdas encontrados (últimas 4 semanas)`);

    // Query 4: Buscar vendas e perdas da semana ATUAL (para comparação)
    const currentWeekSalesQuery = `
      SELECT 
        p.id as produto_id,
        SUM(v.quantidade) as quantidade_total
      FROM vendas v
      JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= $1 AND v.data <= $2
      GROUP BY p.id
    `;
    const currentWeekSales = await sql(currentWeekSalesQuery, [startDate, endDate]);

    const currentWeekLossQuery = `
      SELECT 
        p.id as produto_id,
        SUM(pe.quantidade) as quantidade_total
      FROM perdas pe
      JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data >= $1 AND pe.data <= $2
      GROUP BY p.id
    `;
    const currentWeekLoss = await sql(currentWeekLossQuery, [startDate, endDate]);

    // Mapear dias da semana (terça a segunda)
    const weekDays = ['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo', 'Segunda'];
    
    // Processar dados para cada produto
    const productAnalysis = products.map(product => {
      const productId = product.id;
      
      // Parsear dias de produção
      let diasProducao = [];
      try {
        if (product.dias_producao) {
          if (Array.isArray(product.dias_producao)) {
            diasProducao = product.dias_producao;
          } else if (typeof product.dias_producao === 'string') {
            diasProducao = JSON.parse(product.dias_producao);
          } else if (typeof product.dias_producao === 'object') {
            diasProducao = product.dias_producao;
          }
        }
      } catch (e) {
        console.log(`⚠️ Erro ao parsear dias_producao do produto ${product.nome}:`, e);
        diasProducao = [];
      }

      // Agrupar vendas por semana (últimas 4 semanas)
      const productSales = salesHistory.filter(s => s.produto_id === productId);
      const productLosses = lossHistory.filter(l => l.produto_id === productId);

      // Calcular total por semana (dividir em 4 períodos de 7 dias)
      const weeklyData = [];
      for (let i = 0; i < 4; i++) {
        const weekStart = new Date(fourWeeksAgo);
        weekStart.setDate(weekStart.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekSales = productSales
          .filter(s => {
            const saleDate = new Date(s.data);
            return saleDate >= weekStart && saleDate <= weekEnd;
          })
          .reduce((sum, s) => sum + parseFloat(s.quantidade), 0);

        const weekLosses = productLosses
          .filter(l => {
            const lossDate = new Date(l.data);
            return lossDate >= weekStart && lossDate <= weekEnd;
          })
          .reduce((sum, l) => sum + parseFloat(l.quantidade), 0);

        weeklyData.push({ sales: weekSales, losses: weekLosses });
      }

      // Calcular médias das últimas 4 semanas
      const avgSales = weeklyData.reduce((sum, w) => sum + w.sales, 0) / 4;
      const avgLosses = weeklyData.reduce((sum, w) => sum + w.losses, 0) / 4;

      // Vendas e perdas da semana ATUAL (para tendência)
      const currentSales = currentWeekSales.find(s => s.produto_id === productId)?.quantidade_total || 0;
      const currentLosses = currentWeekLoss.find(l => l.produto_id === productId)?.quantidade_total || 0;

      // Determinar tendências
      const salesTrend = currentSales > avgSales * 1.1 ? 'growing' 
                       : currentSales < avgSales * 0.9 ? 'decreasing' 
                       : 'stable';

      const lossesTrend = currentLosses > avgLosses * 1.1 ? 'growing'
                        : currentLosses < avgLosses * 0.9 ? 'decreasing'
                        : 'stable';

      // APLICAR LÓGICA DE SUGESTÃO (conforme definimos)
      let suggestedProduction = 0;
      let suggestion = '';

      // Cenário 1: Perda subiu E venda NÃO subiu
      if (lossesTrend === 'growing' && salesTrend !== 'growing') {
        suggestedProduction = avgSales + avgLosses;
        suggestion = 'Perdas aumentaram. Manter produção conservadora.';
      }
      // Cenário 2: Venda subiu E perda subiu
      else if (salesTrend === 'growing' && lossesTrend === 'growing') {
        suggestedProduction = avgSales + avgLosses;
        suggestion = 'Vendas e perdas crescendo. Produzir conforme média.';
      }
      // Cenário 3: Venda subiu E perda caiu (MELHOR CENÁRIO!)
      else if (salesTrend === 'growing' && (lossesTrend === 'decreasing' || lossesTrend === 'stable')) {
        suggestedProduction = avgSales + (avgSales * 0.10) + avgLosses;
        suggestion = 'Ótimo! Vendas crescendo e perdas controladas. Aumentar produção.';
      }
      // Cenário 4: Outros casos
      else {
        suggestedProduction = avgSales + avgLosses;
        suggestion = 'Produção estável conforme média histórica.';
      }

      // Arredondar para cima
      suggestedProduction = Math.ceil(suggestedProduction);

      // Calcular taxa de perda
      const avgLossRate = avgSales > 0 ? (avgLosses / avgSales) * 100 : 0;
      const currentLossRate = currentSales > 0 ? (parseFloat(currentLosses) / parseFloat(currentSales)) * 100 : 0;

      return {
        produto_id: productId,
        produto_nome: product.nome,
        setor: product.setor,
        unidade: product.unidade,
        production_days: diasProducao, // Array dos dias de produção
        
        // Médias das últimas 4 semanas
        avg_sales: Math.round(avgSales * 100) / 100,
        avg_losses: Math.round(avgLosses * 100) / 100,
        avg_loss_rate: Math.round(avgLossRate * 10) / 10,
        
        // Semana atual (para comparação)
        current_sales: parseFloat(currentSales),
        current_losses: parseFloat(currentLosses),
        current_loss_rate: Math.round(currentLossRate * 10) / 10,
        
        // Tendências
        sales_trend: salesTrend,
        losses_trend: lossesTrend,
        
        // Sugestão
        suggested_production: suggestedProduction,
        suggestion: suggestion
      };
    });

    console.log(`✅ Análise completa para ${productAnalysis.length} produtos`);

    return Response.json({
      products: productAnalysis,
      period: {
        start: startDate,
        end: endDate,
        history_start: fourWeeksAgoStr
      }
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});