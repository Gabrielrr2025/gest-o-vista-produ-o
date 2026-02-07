import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getWeek, getYear, parse } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { weekNumber, year, sector = 'all' } = body;

    if (weekNumber === undefined || !year) {
      return Response.json({ error: 'Missing weekNumber or year' }, { status: 400 });
    }

    console.log(`📊 Buscando dados do Dashboard: semana=${weekNumber}, ano=${year}, setor=${sector}`);

    // Buscar dados das entidades em memória
    const [salesRecords, lossRecords] = await Promise.all([
      base44.asServiceRole.entities.SalesRecord.list(),
      base44.asServiceRole.entities.LossRecord.list()
    ]);

    // Filtrar e processar dados
    const filterByWeekYear = (record) => {
      const recordWeek = getWeek(parse(record.date, 'yyyy-MM-dd', new Date()), { weekStartsOn: 2 });
      const recordYear = getYear(parse(record.date, 'yyyy-MM-dd', new Date()));
      const matchWeek = recordWeek === weekNumber;
      const matchYear = recordYear === year;
      const matchSector = sector === 'all' || record.sector === sector;
      return matchWeek && matchYear && matchSector;
    };

    const currentWeekSales = salesRecords.filter(filterByWeekYear);
    const currentWeekLosses = lossRecords.filter(filterByWeekYear);

    // Top 5 mais vendidos
    const salesByProduct = new Map();
    currentWeekSales.forEach(sale => {
      const key = sale.product_name;
      if (!salesByProduct.has(key)) {
        salesByProduct.set(key, { produto: key, total_vendas: 0, total_valor: 0 });
      }
      const item = salesByProduct.get(key);
      item.total_vendas += sale.quantity;
      item.total_valor += (sale.quantity * 10); // Aproximação, sem preço real
    });

    const topSales = Array.from(salesByProduct.values())
      .sort((a, b) => b.total_vendas - a.total_vendas)
      .slice(0, 5);

    // Análise de perdas
    const lossesByProduct = new Map();
    currentWeekLosses.forEach(loss => {
      const key = loss.product_name;
      if (!lossesByProduct.has(key)) {
        lossesByProduct.set(key, { produto: key, perda: 0, venda: 0, setor: loss.sector });
      }
      const item = lossesByProduct.get(key);
      item.perda += loss.quantity;
    });

    // Adicionar vendas às perdas para referência
    currentWeekSales.forEach(sale => {
      const key = sale.product_name;
      if (lossesByProduct.has(key)) {
        const item = lossesByProduct.get(key);
        item.venda += sale.quantity;
      } else {
        lossesByProduct.set(key, {
          produto: key,
          perda: 0,
          venda: sale.quantity,
          setor: sale.sector
        });
      }
    });

    const lossAnalysis = Array.from(lossesByProduct.values())
      .filter(item => item.perda > 0)
      .sort((a, b) => b.perda - a.perda);

    // Dados das 4 semanas anteriores para comparação
    const prevWeeksFilter = (record) => {
      const recordWeek = getWeek(parse(record.date, 'yyyy-MM-dd', new Date()), { weekStartsOn: 2 });
      const recordYear = getYear(parse(record.date, 'yyyy-MM-dd', new Date()));
      const matchWeek = recordWeek < weekNumber && recordWeek >= (weekNumber - 4);
      const matchYear = recordYear === year;
      const matchSector = sector === 'all' || record.sector === sector;
      return matchWeek && matchYear && matchSector;
    };

    const prevWeeksSales = salesRecords.filter(prevWeeksFilter);
    const prevWeeksLosses = lossRecords.filter(prevWeeksFilter);

    const prevWeeksMap = new Map();
    prevWeeksSales.forEach(sale => {
      const key = `${sale.product_name}-${sale.sector}`;
      if (!prevWeeksMap.has(key)) {
        prevWeeksMap.set(key, { produto: sale.product_name, setor: sale.sector, total_perda: 0, total_venda: 0 });
      }
      const item = prevWeeksMap.get(key);
      item.total_venda += sale.quantity;
    });

    prevWeeksLosses.forEach(loss => {
      const key = `${loss.product_name}-${loss.sector}`;
      if (!prevWeeksMap.has(key)) {
        prevWeeksMap.set(key, { produto: loss.product_name, setor: loss.sector, total_perda: 0, total_venda: 0 });
      }
      const item = prevWeeksMap.get(key);
      item.total_perda += loss.quantity;
    });

    const previousWeeksAvg = Array.from(prevWeeksMap.values());

    // Dados de tendência (6 semanas anteriores)
    const trendFilter = (record) => {
      const recordWeek = getWeek(parse(record.date, 'yyyy-MM-dd', new Date()), { weekStartsOn: 2 });
      const recordYear = getYear(parse(record.date, 'yyyy-MM-dd', new Date()));
      const matchWeek = recordWeek >= (weekNumber - 6) && recordWeek < weekNumber;
      const matchYear = recordYear === year;
      const matchSector = sector === 'all' || record.sector === sector;
      return matchWeek && matchYear && matchSector;
    };

    const trendSales = salesRecords.filter(trendFilter);
    const trendLosses = lossRecords.filter(trendFilter);

    const trendMap = new Map();
    trendSales.forEach(sale => {
      const week = getWeek(parse(sale.date, 'yyyy-MM-dd', new Date()), { weekStartsOn: 2 });
      if (!trendMap.has(week)) {
        trendMap.set(week, { semana: week, vendas_qtd: 0, perdas_qtd: 0, vendas_valor: 0 });
      }
      const item = trendMap.get(week);
      item.vendas_qtd += sale.quantity;
      item.vendas_valor += (sale.quantity * 10);
    });

    trendLosses.forEach(loss => {
      const week = getWeek(parse(loss.date, 'yyyy-MM-dd', new Date()), { weekStartsOn: 2 });
      if (!trendMap.has(week)) {
        trendMap.set(week, { semana: week, vendas_qtd: 0, perdas_qtd: 0, vendas_valor: 0 });
      }
      const item = trendMap.get(week);
      item.perdas_qtd += loss.quantity;
    });

    const trendData = Array.from(trendMap.values()).sort((a, b) => a.semana - b.semana);

    return Response.json({
      topSales,
      lossAnalysis,
      previousWeeksAvg,
      trendData,
      week: weekNumber,
      year: year
    });
  } catch (error) {
    console.error('❌ Erro ao buscar dados do dashboard:', error.message);
    return Response.json({ 
      error: error.message,
      details: 'Erro ao processar dados do dashboard'
    }, { status: 500 });
  }
});