import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

function weightedMovingAverage(values: number[]): number {
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

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

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
  conservador: { k: 1.0,  label: 'Conservador', nivelServico: '84%' },
  equilibrado:  { k: 1.28, label: 'Equilibrado',  nivelServico: '90%' },
  agressivo:   { k: 1.65, label: 'Agressivo',    nivelServico: '95%' },
};

function getConfidenceLevel(semanasComDados: number) {
  if (semanasComDados === 0) return { nivel: 'sem_dados', label: 'Sem histórico', cor: 'gray' };
  if (semanasComDados >= 8)  return { nivel: 'alta',  label: 'Alta',  cor: 'green'  };
  if (semanasComDados >= 4)  return { nivel: 'media', label: 'Média', cor: 'yellow' };
  return                            { nivel: 'baixa', label: 'Baixa', cor: 'orange' };
}

function eventoAfetaSetor(eventSectors: string[] | string | null, produtoSetor: string): boolean {
  if (!eventSectors) return false;
  const sectors = Array.isArray(eventSectors) ? eventSectors : [eventSectors];
  return sectors.includes('Todos') || sectors.includes(produtoSetor);
}

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
      return Response.json({ error: 'POSTGRES_CONNECTION_URL nao configurada' }, { status: 500 });

    const sql = neon(connectionString);

    // 1. Buscar configs (tabela pode não existir - ignorar erro)
    const cfg: Record<string, string> = {};
    try {
      const configRows = await sql`
      SELECT chave, valor FROM configuracoes
      WHERE chave IN (
        'planejamento_semanas_historico',
        'planejamento_postura',
        'planejamento_sugestao_sem_dados'
      )
    `;
      configRows.forEach((r: any) => { cfg[r.chave] = r.valor; });
    } catch { /* tabela configuracoes não existe ainda - usar defaults */ }

    const semanasHistorico  = Math.max(4, parseInt(cfg['planejamento_semanas_historico'] ?? '8'));
    const posturaKey        = (cfg['planejamento_postura'] ?? 'equilibrado') as keyof typeof POSTURA_CONFIG;
    const sugestaoSemDados  = Math.max(0, parseFloat(cfg['planejamento_sugestao_sem_dados'] ?? '10'));
    const postura           = POSTURA_CONFIG[posturaKey] ?? POSTURA_CONFIG.equilibrado;

    // 2. Janela de histórico
    const refDate = new Date(startDate);
    const recStart = new Date(refDate);
    recStart.setDate(recStart.getDate() - semanasHistorico * 7);
    const recStartStr = recStart.toISOString().split('T')[0];

    // 3. Queries
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

    const calendarHistorico = await sql`
      SELECT name, date, impact_percentage, sectors, type
      FROM calendar_events
      WHERE date >= ${recStartStr} AND date < ${startDate}
      AND impact_percentage != 0
      ORDER BY date
    `;

    const calendarSemanaAlvo = await sql`
      SELECT name, date, impact_percentage, sectors, type, priority, notes
      FROM calendar_events
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date
    `;

    // 4. Processar por produto
    const productAnalysis = products.map((product: any) => {
      const pid = product.id;

      // dias_producao vem diretamente do SQL (salvo pelo Updateproduct/Createproduct)
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

      // Agrupar por semana
      type WeekData = { sales: number; losses: number; hasData: boolean; pesoCalendario: number; };
      const weeklyData: WeekData[] = [];

      for (let i = 0; i < semanasHistorico; i++) {
        const wStart = new Date(recStart);
        wStart.setDate(wStart.getDate() + i * 7);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);
        const wStartStr = wStart.toISOString().split('T')[0];
        const wEndStr   = wEnd.toISOString().split('T')[0];

        const wSales = prodSalesRec
          .filter((s: any) => { const d = s.data?.toString().split('T')[0]; return d >= wStartStr && d <= wEndStr; })
          .reduce((acc: number, s: any) => acc + parseFloat(s.quantidade), 0);
        const wLoss = prodLossesRec
          .filter((l: any) => { const d = l.data?.toString().split('T')[0]; return d >= wStartStr && d <= wEndStr; })
          .reduce((acc: number, l: any) => acc + parseFloat(l.quantidade), 0);

        // Peso reduzido para semanas com eventos excepcionais (não contaminar a média)
        const eventosNaSemana = calendarHistorico.filter((ev: any) => {
          const evDate = ev.date?.toString().split('T')[0];
          return evDate >= wStartStr && evDate <= wEndStr && eventoAfetaSetor(ev.sectors, product.setor);
        });

        let pesoCalendario = 1.0;
        eventosNaSemana.forEach((ev: any) => {
          const absImpact = Math.abs(parseFloat(ev.impact_percentage ?? '0')) / 100;
          pesoCalendario = Math.min(pesoCalendario, Math.max(0.2, 1 - absImpact * 1.2));
        });

        weeklyData.push({ sales: wSales, losses: wLoss, hasData: (wSales + wLoss) > 0, pesoCalendario });
      }

      const semanasValidas = weeklyData.filter(w => w.hasData);
      const semanasComDados = semanasValidas.length;

      // PASSO A: Média Móvel Ponderada (semana mais recente = peso maior)
      // Aplicamos também o peso do calendário para não distorcer com semanas atípicas
      const vendasParaMMP = semanasValidas.map(w => w.sales * w.pesoCalendario);
      const mmpVendas = weightedMovingAverage(vendasParaMMP);

      // PASSO B: Desvio Padrão → buffer inteligente
      // Produto estável → σ pequeno → buffer menor
      // Produto imprevisível → σ grande → buffer maior automaticamente
      const vendasBrutas  = semanasValidas.map(w => w.sales);
      const perdasBrutas  = semanasValidas.map(w => w.losses);
      const sigma  = stdDev(vendasBrutas);
      const buffer = postura.k * sigma;

      // PASSO C: Ajuste do calendário na semana alvo
      const eventosAlvo = calendarSemanaAlvo.filter((ev: any) =>
        eventoAfetaSetor(ev.sectors, product.setor) && parseFloat(ev.impact_percentage ?? '0') !== 0
      );
      const multiplicadorCalendario = calcImpactoSemana(eventosAlvo);
      const demandaPrevista   = mmpVendas * multiplicadorCalendario;
      const demandaComBuffer  = demandaPrevista + buffer;

      // PASSO D: Taxa de perda (mediana — robusta a semanas atípicas)
      const weekLossRates: number[] = semanasValidas
        .filter(w => (w.sales + w.losses) > 0)
        .map(w => w.losses / (w.sales + w.losses));
      const taxaPerdaFinal = median(weekLossRates);
      const taxaSafe = Math.min(taxaPerdaFinal, 0.90);

      // PASSO E: Produção bruta = Demanda com buffer ÷ (1 - taxa de perda)
      let suggestedProduction = 0;
      let estrategiaDesc = '';

      if (semanasComDados === 0) {
        suggestedProduction = Math.ceil(sugestaoSemDados);
        estrategiaDesc = `Produto sem historico. Usando sugestao padrao de ${sugestaoSemDados} ${product.unidade}.`;
      } else {
        const prodBruta = taxaSafe < 1 ? demandaComBuffer / (1 - taxaSafe) : demandaComBuffer;
        suggestedProduction = Math.max(0, Math.ceil(prodBruta));

        const pctPerda   = (taxaPerdaFinal * 100).toFixed(1);
        const sigmaRound = Math.round(sigma * 10) / 10;
        const bufRound   = Math.round(buffer * 10) / 10;
        estrategiaDesc = `MMP de ${semanasComDados} sem. | σ = ${sigmaRound} ${product.unidade} | Buffer = ${postura.k}×${sigmaRound} = ${bufRound} | Perda: ${pctPerda}%.`;
        if (eventosAlvo.length > 0) {
          const sinal  = multiplicadorCalendario >= 1 ? '+' : '';
          const pctCal = ((multiplicadorCalendario - 1) * 100).toFixed(0);
          estrategiaDesc += ` Calendario: ${sinal}${pctCal}% (${eventosAlvo.map((e: any) => e.name).join(', ')}).`;
        }
      }

      // Tendência (para exibição)
      let salesTrend: 'growing' | 'decreasing' | 'stable' = 'stable';
      let lossesTrend: 'growing' | 'decreasing' | 'stable' = 'stable';

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

      const currentSales  = parseFloat(currentWeekSales.find((s: any) => s.produto_id === pid)?.quantidade_total ?? '0');
      const currentLosses = parseFloat(currentWeekLoss.find( (l: any) => l.produto_id === pid)?.quantidade_total ?? '0');
      const currentLossRate = (currentSales + currentLosses) > 0
        ? (currentLosses / (currentSales + currentLosses)) * 100 : 0;

      const confianca = getConfidenceLevel(semanasComDados);

      const eventosImpacto = eventosAlvo.map((ev: any) => ({
        nome: ev.name, data: ev.date, tipo: ev.type,
        impacto_pct: parseFloat(ev.impact_percentage),
        prioridade: ev.priority, notas: ev.notes || '',
      }));
      const eventosInfo = calendarSemanaAlvo.filter((ev: any) =>
        eventoAfetaSetor(ev.sectors, product.setor) && parseFloat(ev.impact_percentage ?? '0') === 0
      ).map((ev: any) => ({
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

        current_sales:      currentSales,
        current_losses:     currentLosses,
        current_loss_rate:  Math.round(currentLossRate * 10) / 10,

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

  } catch (error: any) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});
