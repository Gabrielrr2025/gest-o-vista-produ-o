import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

function weightedMovingAverage(values) {
  if (values.length === 0) return 0;
  const n = values.length;
  let sumWeighted = 0;
  let sumWeights = 0;
  values.forEach((v, i) => {
    const peso = i + 1;
    sumWeighted += v * peso;
    sumWeights += peso;
  });
  return sumWeights > 0 ? sumWeighted / sumWeights : 0;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const POSTURA_CONFIG = {
  conservador: { k: 1.0,  label: 'Conservador', nivelServico: '84%' },
  equilibrado:  { k: 1.28, label: 'Equilibrado',  nivelServico: '90%' },
  agressivo:   { k: 1.65, label: 'Agressivo',    nivelServico: '95%' },
};

function getConfidenceLevel(semanasComDados) {
  if (semanasComDados === 0) return { nivel: 'sem_dados', label: 'Sem histórico', cor: 'gray' };
  if (semanasComDados >= 8)  return { nivel: 'alta',  label: 'Alta',  cor: 'green'  };
  if (semanasComDados >= 4)  return { nivel: 'media', label: 'Média', cor: 'yellow' };
  return                            { nivel: 'baixa', label: 'Baixa', cor: 'orange' };
}

function eventoAfetaSetor(eventSectors, produtoSetor) {
  if (!eventSectors) return false;
  const sectors = Array.isArray(eventSectors) ? eventSectors : [eventSectors];
  return sectors.includes('Todos') || sectors.includes(produtoSetor);
}

function calcImpactoSemana(eventos) {
  return eventos.reduce((mult, ev) => {
    const pct = parseFloat(ev.impact_percentage ?? '0') / 100;
    return mult * (1 + pct);
  }, 1.0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { startDate, endDate } = body;
    if (!startDate || !endDate)
      return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });

    const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
    if (!connectionString)
      return Response.json({ error: 'POSTGRES_CONNECTION_URL nao configurada' }, { status: 500 });

    const sql = neon(connectionString);

    // 1. Buscar configs
    const cfg = {};
    try {
      const configRows = await sql`
        SELECT chave, valor FROM configuracoes
        WHERE chave IN (
          'planejamento_semanas_historico',
          'planejamento_postura',
          'planejamento_sugestao_sem_dados'
        )
      `;
      configRows.forEach((r) => { cfg[r.chave] = r.valor; });
    } catch { /* usar defaults */ }

    const semanasHistorico = Math.max(4, parseInt(cfg['planejamento_semanas_historico'] ?? '8'));
    const posturaKey = cfg['planejamento_postura'] ?? 'equilibrado';
    const sugestaoSemDados = Math.max(0, parseFloat(cfg['planejamento_sugestao_sem_dados'] ?? '10'));
    const postura = POSTURA_CONFIG[posturaKey] ?? POSTURA_CONFIG.equilibrado;

    // 2. Janela de histórico
    const refDate = new Date(startDate);
    const recStart = new Date(refDate);
    recStart.setDate(recStart.getDate() - semanasHistorico * 7);
    const recStartStr = recStart.toISOString().split('T')[0];

    // 3. Buscar produtos ativos
    const base44Products = await base44.asServiceRole.entities.Product.filter({ active: true });
    const products = base44Products.map((p) => ({
      id: p.id,
      nome: p.name,
      setor: p.sector,
      unidade: p.unit || 'unidade',
      status: 'ativo',
      dias_producao: p.production_days || [],
      code: p.code,
    }));

    // 4. Buscar histórico de vendas e perdas diretamente das tabelas
    const [vendaHistorico, perdaHistorico, vendaSemanaAtual, perdaSemanaAtual] = await Promise.all([
      sql`
        SELECT produto_descricao as produto, produto_codigo, TO_CHAR(data, 'YYYY-MM-DD') as data, SUM(quantidade) as quantidade
        FROM vendas
        WHERE data >= ${recStartStr}::date AND data < ${startDate}::date
        GROUP BY produto_descricao, produto_codigo, data
        ORDER BY data
      `,
      sql`
        SELECT produto_descricao as produto, produto_codigo, TO_CHAR(data, 'YYYY-MM-DD') as data, SUM(quantidade) as quantidade
        FROM perdas
        WHERE data >= ${recStartStr}::date AND data < ${startDate}::date
        GROUP BY produto_descricao, produto_codigo, data
        ORDER BY data
      `,
      // Semana passada (seg-dom anterior)
      sql`
        SELECT produto_descricao as produto, produto_codigo, SUM(quantidade) as quantidade_total
        FROM vendas
        WHERE data >= (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int - 6)::date
          AND data <= (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int)::date
        GROUP BY produto_descricao, produto_codigo
      `,
      sql`
        SELECT produto_descricao as produto, produto_codigo, SUM(quantidade) as quantidade_total
        FROM perdas
        WHERE data >= (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int - 6)::date
          AND data <= (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int)::date
        GROUP BY produto_descricao, produto_codigo
      `
    ]);

    const salesRecencia = vendaHistorico.map((r) => ({
      produto_nome: r.produto, produto_codigo: r.produto_codigo, data: r.data, quantidade: r.quantidade
    }));
    const lossesRecencia = perdaHistorico.map((r) => ({
      produto_nome: r.produto, produto_codigo: r.produto_codigo, data: r.data, quantidade: r.quantidade
    }));
    const currentWeekSales = vendaSemanaAtual.map((r) => ({
      produto_nome: r.produto, produto_codigo: r.produto_codigo, quantidade_total: r.quantidade_total
    }));
    const currentWeekLoss = perdaSemanaAtual.map((r) => ({
      produto_nome: r.produto, produto_codigo: r.produto_codigo, quantidade_total: r.quantidade_total
    }));

    // 5. Eventos do calendário
    let allCalendarEvents = [];
    try {
      allCalendarEvents = await base44.asServiceRole.entities.CalendarEvent.list();
    } catch (e) {
      console.warn('Aviso: não foi possível buscar CalendarEvent:', e);
    }

    const normalizeDate = (d) => d ? d.split('T')[0] : '';

    const calendarHistorico = allCalendarEvents.filter((ev) => {
      const evDate = normalizeDate(ev.date);
      return evDate >= recStartStr && evDate < startDate && parseFloat(ev.impact_percentage ?? '0') !== 0;
    }).map((ev) => ({
      name: ev.name, date: normalizeDate(ev.date),
      impact_percentage: ev.impact_percentage, sectors: ev.sectors, type: ev.type,
    }));

    const calendarSemanaAlvo = allCalendarEvents.filter((ev) => {
      const evDate = normalizeDate(ev.date);
      return evDate >= startDate && evDate <= endDate;
    }).map((ev) => ({
      name: ev.name, date: normalizeDate(ev.date),
      impact_percentage: ev.impact_percentage, sectors: ev.sectors,
      type: ev.type, priority: ev.priority, notes: ev.notes || '',
    }));

    // 6. Processar por produto
    const productAnalysis = products.map((product) => {
      const pid = product.id;
      const nome = (product.nome || '').toLowerCase().trim();
      const code = product.code ? String(product.code) : null;

      let diasProducao = [];
      try {
        if (product.dias_producao) {
          if (Array.isArray(product.dias_producao)) diasProducao = product.dias_producao;
          else if (typeof product.dias_producao === 'string') diasProducao = JSON.parse(product.dias_producao);
          else diasProducao = Object.values(product.dias_producao);
        }
      } catch { diasProducao = []; }

      const matchRecord = (r) => {
        if (code && r.produto_codigo && String(r.produto_codigo) === code) return true;
        return (r.produto_nome || '').toLowerCase().trim() === nome;
      };

      const prodSalesRec  = salesRecencia.filter(matchRecord);
      const prodLossesRec = lossesRecencia.filter(matchRecord);

      const weeklyData = [];
      for (let i = 0; i < semanasHistorico; i++) {
        const wStart = new Date(recStart);
        wStart.setDate(wStart.getDate() + i * 7);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);
        const wStartStr = wStart.toISOString().split('T')[0];
        const wEndStr   = wEnd.toISOString().split('T')[0];

        const wSales = prodSalesRec
          .filter((s) => { const d = s.data?.toString().split('T')[0]; return d >= wStartStr && d <= wEndStr; })
          .reduce((acc, s) => acc + parseFloat(s.quantidade), 0);
        const wLoss = prodLossesRec
          .filter((l) => { const d = l.data?.toString().split('T')[0]; return d >= wStartStr && d <= wEndStr; })
          .reduce((acc, l) => acc + parseFloat(l.quantidade), 0);

        const eventosNaSemana = calendarHistorico.filter((ev) => {
          const evDate = ev.date?.toString().split('T')[0];
          return evDate >= wStartStr && evDate <= wEndStr && eventoAfetaSetor(ev.sectors, product.setor);
        });

        let pesoCalendario = 1.0;
        eventosNaSemana.forEach((ev) => {
          const absImpact = Math.abs(parseFloat(ev.impact_percentage ?? '0')) / 100;
          pesoCalendario = Math.min(pesoCalendario, Math.max(0.2, 1 - absImpact * 1.2));
        });

        weeklyData.push({ sales: wSales, losses: wLoss, hasData: (wSales + wLoss) > 0, pesoCalendario });
      }

      const semanasValidas = weeklyData.filter(w => w.hasData);
      const semanasComDados = semanasValidas.length;

      const vendasParaMMP = semanasValidas.map(w => w.sales * w.pesoCalendario);
      const mmpVendas = weightedMovingAverage(vendasParaMMP);

      const vendasBrutas = semanasValidas.map(w => w.sales);
      const perdasBrutas = semanasValidas.map(w => w.losses);
      const sigma  = stdDev(vendasBrutas);
      const buffer = postura.k * sigma;

      const eventosAlvo = calendarSemanaAlvo.filter((ev) =>
        eventoAfetaSetor(ev.sectors, product.setor) && parseFloat(ev.impact_percentage ?? '0') !== 0
      );
      const multiplicadorCalendario = calcImpactoSemana(eventosAlvo);
      const demandaPrevista  = mmpVendas * multiplicadorCalendario;
      const demandaComBuffer = demandaPrevista + buffer;

      const weekLossRates = semanasValidas
        .filter(w => (w.sales + w.losses) > 0)
        .map(w => w.losses / (w.sales + w.losses));
      const taxaPerdaFinal = median(weekLossRates);
      const taxaSafe = Math.min(taxaPerdaFinal, 0.90);

      let suggestedProduction = 0;
      let estrategiaDesc = '';

      if (semanasComDados === 0) {
        suggestedProduction = Math.ceil(sugestaoSemDados);
        estrategiaDesc = `Produto sem historico. Usando sugestao padrao de ${sugestaoSemDados} ${product.unidade}.`;
      } else {
        const prodBruta = taxaSafe < 1 ? demandaComBuffer / (1 - taxaSafe) : demandaComBuffer;
        suggestedProduction = Math.max(0, Math.ceil(prodBruta));
        const pctPerda = (taxaPerdaFinal * 100).toFixed(1);
        const sigmaRound = Math.round(sigma * 10) / 10;
        const bufRound = Math.round(buffer * 10) / 10;
        if (eventosAlvo.length > 0) {
          const sinal = multiplicadorCalendario >= 1 ? '+' : '';
          const pctCal = ((multiplicadorCalendario - 1) * 100).toFixed(0);
          const nomes = eventosAlvo.map((e) => e.name).join(', ');
          estrategiaDesc = `Com base nas últimas ${semanasComDados} semanas, a sugestão base era de ${Math.ceil(mmpVendas)} ${product.unidade}. Por causa do(s) evento(s) "${nomes}" na semana (${sinal}${pctCal}%), a sugestão foi ajustada para ${suggestedProduction} ${product.unidade} (incluindo buffer de segurança e taxa de perda de ${pctPerda}%).`;
        } else {
          estrategiaDesc = `Baseado nas últimas ${semanasComDados} semanas, média de ${Math.ceil(mmpVendas)} ${product.unidade}/sem. com variabilidade de ±${sigmaRound}. Buffer de segurança: ${bufRound} ${product.unidade}. Taxa de perda histórica: ${pctPerda}%.`;
        }
      }

      let salesTrend = 'stable';
      let lossesTrend = 'stable';
      if (semanasComDados >= 4) {
        const half = Math.max(1, Math.floor(vendasBrutas.length / 2));
        const mRec = mean(vendasBrutas.slice(vendasBrutas.length - half));
        const mOld = mean(vendasBrutas.slice(0, half));
        const g = mOld > 0 ? (mRec - mOld) / mOld : 0;
        salesTrend = g > 0.08 ? 'growing' : g < -0.08 ? 'decreasing' : 'stable';
        const lRec = mean(perdasBrutas.slice(perdasBrutas.length - half));
        const lOld = mean(perdasBrutas.slice(0, half));
        const lg = lOld > 0 ? (lRec - lOld) / lOld : 0;
        lossesTrend = lg > 0.08 ? 'growing' : lg < -0.08 ? 'decreasing' : 'stable';
      }

      const avgSales    = mean(vendasBrutas);
      const avgLosses   = mean(perdasBrutas);
      const avgLossRate = taxaPerdaFinal * 100;

      const currentSales  = parseFloat(currentWeekSales.find(matchRecord)?.quantidade_total ?? '0');
      const currentLosses = parseFloat(currentWeekLoss.find(matchRecord)?.quantidade_total ?? '0');
      const currentLossRate = (currentSales + currentLosses) > 0
        ? (currentLosses / (currentSales + currentLosses)) * 100 : 0;

      const confianca = getConfidenceLevel(semanasComDados);

      const eventosImpacto = eventosAlvo.map((ev) => ({
        nome: ev.name, data: ev.date, tipo: ev.type,
        impacto_pct: parseFloat(ev.impact_percentage),
        prioridade: ev.priority, notas: ev.notes || '',
      }));
      const eventosInfo = calendarSemanaAlvo.filter((ev) =>
        eventoAfetaSetor(ev.sectors, product.setor) && parseFloat(ev.impact_percentage ?? '0') === 0
      ).map((ev) => ({
        nome: ev.name, data: ev.date, tipo: ev.type, impacto_pct: 0,
        prioridade: ev.priority, notas: ev.notes || '',
      }));

      return {
        produto_id:      pid,
        produto_nome:    product.nome,
        setor:           product.setor,
        unidade:         product.unidade,
        production_days: diasProducao,
        avg_sales:     Math.round(avgSales    * 100) / 100,
        avg_losses:    Math.round(avgLosses   * 100) / 100,
        avg_loss_rate: Math.round(avgLossRate * 10)  / 10,
        current_sales:     currentSales,
        current_losses:    currentLosses,
        current_loss_rate: Math.round(currentLossRate * 10) / 10,
        sales_trend:  salesTrend,
        losses_trend: lossesTrend,
        confianca:       confianca.nivel,
        confianca_label: confianca.label,
        confianca_cor:   confianca.cor,
        semanas_com_dados: semanasComDados,
        eventos_semana:      eventosImpacto,
        eventos_semana_info: eventosInfo,
        multiplicador_calendario: Math.round(multiplicadorCalendario * 1000) / 1000,
        calc_details: {
          mmp_vendas:               Math.round(mmpVendas          * 100) / 100,
          sigma_demanda:            Math.round(sigma               * 100) / 100,
          k_fator:                  postura.k,
          nivel_servico:            postura.nivelServico,
          buffer_valor:             Math.round(buffer              * 100) / 100,
          multiplicador_calendario: Math.round(multiplicadorCalendario * 1000) / 1000,
          demanda_prevista:         Math.round(demandaPrevista     * 100) / 100,
          demanda_com_buffer:       Math.round(demandaComBuffer    * 100) / 100,
          taxa_perda_pct:           Math.round(taxaPerdaFinal      * 1000) / 10,
          semanas_com_dados:        semanasComDados,
        },
        suggested_production: suggestedProduction,
        suggestion: estrategiaDesc,
      };
    });

    return Response.json({
      products: productAnalysis,
      period: { start: startDate, end: endDate },
      config_used: {
        semanas_historico:  semanasHistorico,
        postura:            postura.label,
        k_fator:            postura.k,
        nivel_servico:      postura.nivelServico,
        sugestao_sem_dados: sugestaoSemDados,
      }
    });

  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});