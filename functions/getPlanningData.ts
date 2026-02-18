import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const POSTURA_CONFIG = {
  conservador: { growthCap: 0.05, desc: 'Conservador' },
  equilibrado:  { growthCap: 0.12, desc: 'Equilibrado' },
  agressivo:   { growthCap: 0.22, desc: 'Agressivo'  },
};

function getConfidenceLevel(semanasComDados: number, temAnoAnterior: boolean) {
  if (semanasComDados === 0) return { nivel: 'sem_dados', label: 'Sem histórico', cor: 'gray' };
  if (semanasComDados >= 6 && temAnoAnterior) return { nivel: 'alta',  label: 'Alta',  cor: 'green'  };
  if (semanasComDados >= 4)                   return { nivel: 'media', label: 'Média', cor: 'yellow' };
  return                                             { nivel: 'baixa', label: 'Baixa', cor: 'orange' };
}

// Verifica se um evento do calendário afeta um determinado setor
function eventoAfetaSetor(eventSectors: string[] | string | null, produtoSetor: string): boolean {
  if (!eventSectors) return false;
  const sectors = Array.isArray(eventSectors) ? eventSectors : [eventSectors];
  return sectors.includes('Todos') || sectors.includes(produtoSetor);
}

// Calcula o impacto total de uma lista de eventos na semana (multiplicador)
// Ex: evento +30% e evento -20% → multiplicador = 1.30 * 0.80 = 1.04
function calcImpactoSemana(eventos: any[]): number {
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
      return Response.json({ error: 'POSTGRES_CONNECTION_URL não configurada' }, { status: 500 });

    const sql = neon(connectionString);

    // ── 1. Parâmetros configuráveis ──────────────────────────────────────────
    const configRows = await sql`
      SELECT chave, valor FROM configuracoes
      WHERE chave IN (
        'planejamento_semanas_historico',
        'planejamento_postura',
        'planejamento_buffer_pct',
        'planejamento_sugestao_sem_dados'
      )
    `;
    const cfg: Record<string, string> = {};
    configRows.forEach((r: any) => { cfg[r.chave] = r.valor; });

    const semanasHistorico = Math.max(2, parseInt(cfg['planejamento_semanas_historico'] ?? '8'));
    const posturaKey       = (cfg['planejamento_postura'] ?? 'equilibrado') as keyof typeof POSTURA_CONFIG;
    const bufferPct        = Math.max(0, Math.min(0.30, parseFloat(cfg['planejamento_buffer_pct'] ?? '5') / 100));
    const sugestaoSemDados = Math.max(0, parseFloat(cfg['planejamento_sugestao_sem_dados'] ?? '10'));
    const postura          = POSTURA_CONFIG[posturaKey] ?? POSTURA_CONFIG.equilibrado;

    // ── 2. Janelas de datas ──────────────────────────────────────────────────
    const refDate = new Date(startDate);

    const recStart = new Date(refDate);
    recStart.setDate(recStart.getDate() - semanasHistorico * 7);
    const recStartStr = recStart.toISOString().split('T')[0];

    // Mesmo período ano anterior (janela de 3 semanas centrada)
    const anoAntCenter = new Date(refDate);
    anoAntCenter.setFullYear(anoAntCenter.getFullYear() - 1);
    const anoAntStart = new Date(anoAntCenter); anoAntStart.setDate(anoAntStart.getDate() - 7);
    const anoAntEnd   = new Date(anoAntCenter); anoAntEnd.setDate(anoAntEnd.getDate() + 13);
    const anoAntStartStr = anoAntStart.toISOString().split('T')[0];
    const anoAntEndStr   = anoAntEnd.toISOString().split('T')[0];

    // Base 12 meses
    const base12Start = new Date(refDate);
    base12Start.setMonth(base12Start.getMonth() - 12);
    const base12StartStr = base12Start.toISOString().split('T')[0];

    // ── 3. Queries ───────────────────────────────────────────────────────────
    const products = await sql`
      SELECT id, nome, setor, unidade, status, dias_producao
      FROM produtos WHERE status = 'ativo' ORDER BY setor, nome
    `;

    const salesRecencia = await sql`
      SELECT p.id as produto_id, v.data, v.quantidade
      FROM vendas v JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= ${recStartStr} AND v.data < ${startDate}
    `;
    const lossesRecencia = await sql`
      SELECT p.id as produto_id, pe.data, pe.quantidade
      FROM perdas pe JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data >= ${recStartStr} AND pe.data < ${startDate}
    `;

    const salesAnoAnt = await sql`
      SELECT p.id as produto_id, SUM(v.quantidade) as total
      FROM vendas v JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= ${anoAntStartStr} AND v.data <= ${anoAntEndStr}
      GROUP BY p.id
    `;
    const lossesAnoAnt = await sql`
      SELECT p.id as produto_id, SUM(pe.quantidade) as total
      FROM perdas pe JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data >= ${anoAntStartStr} AND pe.data <= ${anoAntEndStr}
      GROUP BY p.id
    `;

    const salesBase12m = await sql`
      SELECT p.id as produto_id, SUM(v.quantidade) as total
      FROM vendas v JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= ${base12StartStr} AND v.data < ${startDate}
      GROUP BY p.id
    `;

    const currentWeekSales = await sql`
      SELECT p.id as produto_id, SUM(v.quantidade) as quantidade_total
      FROM vendas v JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= ${startDate} AND v.data <= ${endDate} GROUP BY p.id
    `;
    const currentWeekLoss = await sql`
      SELECT p.id as produto_id, SUM(pe.quantidade) as quantidade_total
      FROM perdas pe JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data >= ${startDate} AND pe.data <= ${endDate} GROUP BY p.id
    `;

    // ── CALENDÁRIO: eventos históricos + semana alvo ─────────────────────────
    // Histórico: para ponderar semanas com eventos excepcionais
    const calendarHistorico = await sql`
      SELECT name, date, impact_percentage, sectors, type, priority
      FROM calendar_events
      WHERE date >= ${recStartStr} AND date < ${startDate}
      AND impact_percentage != 0
      ORDER BY date
    `;

    // Semana alvo: eventos que impactam a semana que estamos planejando
    const calendarSemanaAlvo = await sql`
      SELECT name, date, impact_percentage, sectors, type, priority, notes
      FROM calendar_events
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date
    `;

    console.log(`📅 ${calendarHistorico.length} eventos históricos, ${calendarSemanaAlvo.length} eventos na semana alvo`);

    // ── 4. Processar por produto ─────────────────────────────────────────────
    const productAnalysis = products.map((product: any) => {
      const pid = product.id;

      let diasProducao: string[] = [];
      try {
        if (product.dias_producao) {
          if (Array.isArray(product.dias_producao))           diasProducao = product.dias_producao;
          else if (typeof product.dias_producao === 'string') diasProducao = JSON.parse(product.dias_producao);
          else                                                 diasProducao = Object.values(product.dias_producao);
        }
      } catch { diasProducao = []; }

      const prodSalesRec  = salesRecencia.filter( (s: any) => s.produto_id === pid);
      const prodLossesRec = lossesRecencia.filter((l: any) => l.produto_id === pid);

      // ── Agrupar por semana com peso do calendário ─────────────────────────
      // Semanas com eventos de alto impacto recebem peso reduzido na média
      // (não queremos que a semana da Páscoa contamine a média "normal")
      type WeekData = { sales: number; losses: number; hasData: boolean; peso: number; eventos: string[] };
      const weeklyData: WeekData[] = [];

      for (let i = 0; i < semanasHistorico; i++) {
        const wStart = new Date(recStart);
        wStart.setDate(wStart.getDate() + i * 7);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);
        const wStartStr = wStart.toISOString().split('T')[0];
        const wEndStr   = wEnd.toISOString().split('T')[0];

        const wSales = prodSalesRec
          .filter((s: any) => { const d = new Date(s.data); return d >= wStart && d <= wEnd; })
          .reduce((acc: number, s: any) => acc + parseFloat(s.quantidade), 0);
        const wLoss = prodLossesRec
          .filter((l: any) => { const d = new Date(l.data); return d >= wStart && d <= wEnd; })
          .reduce((acc: number, l: any) => acc + parseFloat(l.quantidade), 0);

        // Eventos do calendário nessa semana histórica que afetam este produto
        const eventosNaSemana = calendarHistorico.filter((ev: any) =>
          ev.date >= wStartStr && ev.date <= wEndStr &&
          eventoAfetaSetor(ev.sectors, product.setor)
        );

        // Peso reduzido proporcionalmente ao impacto do evento
        // Evento de ±50% → peso 0.3 (quase ignorado)
        // Evento de ±20% → peso 0.6
        // Sem eventos → peso 1.0
        let peso = 1.0;
        eventosNaSemana.forEach((ev: any) => {
          const absImpact = Math.abs(parseFloat(ev.impact_percentage ?? '0')) / 100;
          peso = Math.min(peso, Math.max(0.2, 1 - absImpact * 1.2));
        });

        weeklyData.push({
          sales: wSales,
          losses: wLoss,
          hasData: (wSales + wLoss) > 0,
          peso,
          eventos: eventosNaSemana.map((ev: any) => ev.name),
        });
      }

      const semanasComDados = weeklyData.filter(w => w.hasData).length;

      // ── Médias ponderadas pelo calendário ─────────────────────────────────
      const pesoTotal = weeklyData.filter(w => w.hasData).reduce((s, w) => s + w.peso, 0);
      const mediaVendasPonderada = pesoTotal > 0
        ? weeklyData.filter(w => w.hasData).reduce((s, w) => s + w.sales * w.peso, 0) / pesoTotal
        : 0;

      // Para tendência (últimas N/2 vs primeiras N/2) sem ponderação do calendário
      const allWeekSales  = weeklyData.map(w => w.sales);
      const allWeekLosses = weeklyData.map(w => w.losses);

      // ── Mesmo período ano anterior ────────────────────────────────────────
      const totalVendaAnoAnt  = parseFloat(salesAnoAnt.find( (s: any) => s.produto_id === pid)?.total ?? '0');
      const totalPerdaAnoAnt  = parseFloat(lossesAnoAnt.find((l: any) => l.produto_id === pid)?.total ?? '0');
      const mediaVendaAnoAnt  = totalVendaAnoAnt / 3;
      const mediaPerdaAnoAnt  = totalPerdaAnoAnt / 3;
      const temAnoAnterior    = totalVendaAnoAnt > 0;

      const total12m     = parseFloat(salesBase12m.find((s: any) => s.produto_id === pid)?.total ?? '0');
      const mediaBase12m = total12m / 52;
      const tem12m       = total12m > 0;

      const confianca = getConfidenceLevel(semanasComDados, temAnoAnterior);

      // ── PASSO A: Previsão de vendas ───────────────────────────────────────
      let vendaPrevista = 0;
      let estrategiaUsada = '';
      let pesosUsados = { rec: 0, ano: 0, base: 0 };

      if (semanasComDados === 0) {
        vendaPrevista   = sugestaoSemDados;
        estrategiaUsada = `Sem histórico. Usando sugestão padrão de ${sugestaoSemDados} ${product.unidade}.`;

      } else if (semanasComDados <= 3) {
        vendaPrevista   = mediaVendasPonderada;
        estrategiaUsada = `Histórico inicial (${semanasComDados} sem.). Média simples sem tendência.`;
        pesosUsados = { rec: 1, ano: 0, base: 0 };

      } else {
        if (temAnoAnterior && tem12m) {
          const wRec  = posturaKey === 'conservador' ? 0.45 : posturaKey === 'agressivo' ? 0.70 : 0.60;
          const wAno  = posturaKey === 'conservador' ? 0.40 : posturaKey === 'agressivo' ? 0.20 : 0.30;
          const wBase = 1 - wRec - wAno;
          vendaPrevista   = wRec * mediaVendasPonderada + wAno * mediaVendaAnoAnt + wBase * mediaBase12m;
          pesosUsados     = { rec: wRec, ano: wAno, base: wBase };
          estrategiaUsada = `Blend completo: ${Math.round(wRec*100)}% recência + ${Math.round(wAno*100)}% mesmo período ano ant. + ${Math.round(wBase*100)}% base 12m.`;
        } else if (!temAnoAnterior && tem12m) {
          const wRec  = posturaKey === 'conservador' ? 0.65 : posturaKey === 'agressivo' ? 0.85 : 0.75;
          const wBase = 1 - wRec;
          vendaPrevista   = wRec * mediaVendasPonderada + wBase * mediaBase12m;
          pesosUsados     = { rec: wRec, ano: 0, base: wBase };
          estrategiaUsada = `Sem histórico anual. Blend: ${Math.round(wRec*100)}% recência + ${Math.round(wBase*100)}% base 12m.`;
        } else if (temAnoAnterior && !tem12m) {
          const wRec = posturaKey === 'conservador' ? 0.50 : posturaKey === 'agressivo' ? 0.75 : 0.65;
          const wAno = 1 - wRec;
          vendaPrevista   = wRec * mediaVendasPonderada + wAno * mediaVendaAnoAnt;
          pesosUsados     = { rec: wRec, ano: wAno, base: 0 };
          estrategiaUsada = `Blend: ${Math.round(wRec*100)}% recência + ${Math.round(wAno*100)}% mesmo período ano ant.`;
        } else {
          vendaPrevista   = mediaVendasPonderada;
          pesosUsados     = { rec: 1, ano: 0, base: 0 };
          estrategiaUsada = `Apenas recência (${semanasComDados} semanas).`;
        }

        // Ajuste por tendência
        if (semanasComDados >= 4) {
          const half     = Math.max(1, Math.floor(allWeekSales.length / 2));
          const mediaRec = mean(allWeekSales.slice(allWeekSales.length - half));
          const mediaOld = mean(allWeekSales.slice(0, half));
          const growth   = mediaOld > 0 ? (mediaRec - mediaOld) / mediaOld : 0;
          const adjFinal = Math.max(-postura.growthCap, Math.min(postura.growthCap, growth));
          vendaPrevista  = vendaPrevista * (1 + adjFinal);
        }
      }

      // ── CALENDÁRIO: ajuste da semana alvo ────────────────────────────────
      // Filtra eventos da semana alvo que afetam este produto
      const eventosAlvo = calendarSemanaAlvo.filter((ev: any) =>
        eventoAfetaSetor(ev.sectors, product.setor) && parseFloat(ev.impact_percentage ?? '0') !== 0
      );

      const multiplicadorCalendario = calcImpactoSemana(eventosAlvo);
      const vendaPrevistaComCalendario = vendaPrevista * multiplicadorCalendario;

      // Info dos eventos para exibição no frontend
      const eventosImpacto = eventosAlvo.map((ev: any) => ({
        nome: ev.name,
        data: ev.date,
        tipo: ev.type,
        impacto_pct: parseFloat(ev.impact_percentage),
        prioridade: ev.priority,
        notas: ev.notes || '',
      }));

      // Há também eventos sem impacto numérico mas que o usuário registrou (apenas informativos)
      const eventosInfo = calendarSemanaAlvo.filter((ev: any) =>
        eventoAfetaSetor(ev.sectors, product.setor) && parseFloat(ev.impact_percentage ?? '0') === 0
      ).map((ev: any) => ({
        nome: ev.name,
        data: ev.date,
        tipo: ev.type,
        impacto_pct: 0,
        prioridade: ev.priority,
        notas: ev.notes || '',
      }));

      // ── Tendência ─────────────────────────────────────────────────────────
      let salesTrend: 'growing' | 'decreasing' | 'stable' = 'stable';
      let lossesTrend: 'growing' | 'decreasing' | 'stable' = 'stable';
      let growthRateDisplay = 0;

      if (semanasComDados >= 4) {
        const half     = Math.max(1, Math.floor(allWeekSales.length / 2));
        const mediaRec = mean(allWeekSales.slice(allWeekSales.length - half));
        const mediaOld = mean(allWeekSales.slice(0, half));
        growthRateDisplay = mediaOld > 0 ? (mediaRec - mediaOld) / mediaOld : 0;

        salesTrend = growthRateDisplay >  0.08 ? 'growing' : growthRateDisplay < -0.08 ? 'decreasing' : 'stable';

        const lossRec  = mean(allWeekLosses.slice(allWeekLosses.length - half));
        const lossOld  = mean(allWeekLosses.slice(0, half));
        const lossG    = lossOld > 0 ? (lossRec - lossOld) / lossOld : 0;
        lossesTrend    = lossG > 0.08 ? 'growing' : lossG < -0.08 ? 'decreasing' : 'stable';
      }

      // ── PASSO B: Taxa de perda (mediana) ─────────────────────────────────
      const weekLossRates: number[] = weeklyData
        .filter(w => (w.sales + w.losses) > 0)
        .map(w => w.losses / (w.sales + w.losses));

      let taxaPerdaFinal = 0;
      if (weekLossRates.length === 0 && temAnoAnterior && (mediaVendaAnoAnt + mediaPerdaAnoAnt) > 0) {
        taxaPerdaFinal = mediaPerdaAnoAnt / (mediaVendaAnoAnt + mediaPerdaAnoAnt);
      } else if (weekLossRates.length > 0 && temAnoAnterior && (mediaVendaAnoAnt + mediaPerdaAnoAnt) > 0) {
        const taxaRec = median(weekLossRates);
        const taxaAno = mediaPerdaAnoAnt / (mediaVendaAnoAnt + mediaPerdaAnoAnt);
        taxaPerdaFinal = 0.70 * taxaRec + 0.30 * taxaAno;
      } else {
        taxaPerdaFinal = median(weekLossRates);
      }

      // ── PASSO C: Produção final ───────────────────────────────────────────
      const taxaSafe    = Math.min(taxaPerdaFinal, 0.90);
      const prodBase    = vendaPrevistaComCalendario > 0 && taxaSafe < 1
                          ? vendaPrevistaComCalendario / (1 - taxaSafe)
                          : vendaPrevistaComCalendario;
      const prodFinal   = prodBase * (1 + bufferPct);
      const suggestedProduction = Math.max(0, Math.ceil(prodFinal));

      // Médias para exibição
      const avgSales    = mean(weeklyData.filter(w => w.hasData).map(w => w.sales));
      const avgLosses   = mean(weeklyData.filter(w => w.hasData).map(w => w.losses));
      const avgLossRate = taxaPerdaFinal * 100;

      const currentSales  = parseFloat(currentWeekSales.find((s: any) => s.produto_id === pid)?.quantidade_total ?? '0');
      const currentLosses = parseFloat(currentWeekLoss.find( (l: any) => l.produto_id === pid)?.quantidade_total ?? '0');
      const currentLossRate = (currentSales + currentLosses) > 0
        ? (currentLosses / (currentSales + currentLosses)) * 100 : 0;

      // Texto da sugestão
      let suggestion = estrategiaUsada;
      if (semanasComDados > 0) {
        const pctBuffer = (bufferPct * 100).toFixed(0);
        const pctPerda  = (taxaPerdaFinal * 100).toFixed(1);
        suggestion = `${estrategiaUsada} Taxa de perda: ${pctPerda}%. Buffer: +${pctBuffer}%.`;
        if (eventosImpacto.length > 0) {
          const pctCal = ((multiplicadorCalendario - 1) * 100).toFixed(0);
          const sinal  = multiplicadorCalendario >= 1 ? '+' : '';
          suggestion += ` Calendário: ${sinal}${pctCal}% (${eventosImpacto.map(e => e.nome).join(', ')}).`;
        }
      }

      return {
        produto_id:   pid,
        produto_nome: product.nome,
        setor:        product.setor,
        unidade:      product.unidade,
        production_days: diasProducao,

        avg_sales:     Math.round(avgSales    * 100) / 100,
        avg_losses:    Math.round(avgLosses   * 100) / 100,
        avg_loss_rate: Math.round(avgLossRate * 10)  / 10,

        current_sales:     currentSales,
        current_losses:    currentLosses,
        current_loss_rate: Math.round(currentLossRate * 10) / 10,

        sales_trend:      salesTrend,
        losses_trend:     lossesTrend,
        sales_growth_rate: Math.round(growthRateDisplay * 1000) / 10,

        confianca:         confianca.nivel,
        confianca_label:   confianca.label,
        confianca_cor:     confianca.cor,
        semanas_com_dados: semanasComDados,
        tem_ano_anterior:  temAnoAnterior,

        // Calendário
        eventos_semana:        eventosImpacto,  // com impacto numérico
        eventos_semana_info:   eventosInfo,      // apenas informativos
        multiplicador_calendario: Math.round(multiplicadorCalendario * 1000) / 1000,
        semanas_historico_com_eventos: weeklyData.filter(w => w.eventos.length > 0).length,

        calc_details: {
          venda_prevista_base:      Math.round(vendaPrevista               * 100) / 100,
          multiplicador_calendario: Math.round(multiplicadorCalendario     * 1000) / 1000,
          venda_prevista_final:     Math.round(vendaPrevistaComCalendario  * 100) / 100,
          taxa_perda_pct:           Math.round(taxaPerdaFinal              * 1000) / 10,
          prod_base:                Math.round(prodBase                    * 100) / 100,
          buffer_pct:               bufferPct * 100,
          media_recencia:           Math.round(avgSales                    * 100) / 100,
          media_ano_anterior:       Math.round(mediaVendaAnoAnt            * 100) / 100,
          media_base12m:            Math.round(mediaBase12m                * 100) / 100,
          pesos: {
            rec:  Math.round(pesosUsados.rec  * 100),
            ano:  Math.round(pesosUsados.ano  * 100),
            base: Math.round(pesosUsados.base * 100),
          },
          semanas_com_dados: semanasComDados,
        },

        suggested_production: suggestedProduction,
        suggestion,
      };
    });

    return Response.json({
      products: productAnalysis,
      period: { start: startDate, end: endDate },
      eventos_semana_geral: calendarSemanaAlvo,
      config_used: {
        semanas_historico: semanasHistorico,
        postura: postura.desc,
        buffer_pct: bufferPct * 100,
        sugestao_sem_dados: sugestaoSemDados,
      }
    });

  } catch (error: any) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});
