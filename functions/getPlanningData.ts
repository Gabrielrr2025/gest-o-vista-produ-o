import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { neon } from 'npm:@neondatabase/serverless@0.9.0';

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// Postura define como reagir a tendências e quanto peso dar ao ano anterior
const POSTURA_CONFIG = {
  conservador: { growthCap: 0.05, lossCap: 0.08, desc: 'Conservador' },
  equilibrado:  { growthCap: 0.12, lossCap: 0.15, desc: 'Equilibrado' },
  agressivo:   { growthCap: 0.22, lossCap: 0.25, desc: 'Agressivo'  },
};

// Nível de confiança baseado em quantas semanas de dados existem
function getConfidenceLevel(semanasComDados: number, temAnoAnterior: boolean): {
  nivel: 'alta' | 'media' | 'baixa' | 'sem_dados';
  label: string;
  cor: string;
} {
  if (semanasComDados === 0) return { nivel: 'sem_dados', label: 'Sem histórico',   cor: 'gray'   };
  if (semanasComDados >= 6 && temAnoAnterior) return { nivel: 'alta',  label: 'Alta',         cor: 'green'  };
  if (semanasComDados >= 4)                   return { nivel: 'media', label: 'Média',         cor: 'yellow' };
  return                                             { nivel: 'baixa', label: 'Baixa',         cor: 'orange' };
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

    // Defaults seguros
    const semanasHistorico  = Math.max(2, parseInt(cfg['planejamento_semanas_historico'] ?? '8'));
    const posturaKey        = (cfg['planejamento_postura'] ?? 'equilibrado') as keyof typeof POSTURA_CONFIG;
    const bufferPct         = Math.max(0, Math.min(0.30, parseFloat(cfg['planejamento_buffer_pct'] ?? '5') / 100));
    const sugestaoSemDados  = Math.max(0, parseFloat(cfg['planejamento_sugestao_sem_dados'] ?? '10'));
    const postura           = POSTURA_CONFIG[posturaKey] ?? POSTURA_CONFIG.equilibrado;

    console.log('⚙️', { semanasHistorico, posturaKey, bufferPct, sugestaoSemDados });

    // ── 2. Janelas de datas ──────────────────────────────────────────────────
    const refDate = new Date(startDate);

    // Recência: puxa até N semanas atrás
    const recStart = new Date(refDate);
    recStart.setDate(recStart.getDate() - semanasHistorico * 7);
    const recStartStr = recStart.toISOString().split('T')[0];

    // Mesmo período do ano anterior: janela de 3 semanas centrada na semana equivalente
    // (±1 semana para suavizar variações de calendário)
    const anoAntCenter = new Date(refDate);
    anoAntCenter.setFullYear(anoAntCenter.getFullYear() - 1);
    const anoAntStart = new Date(anoAntCenter);
    anoAntStart.setDate(anoAntStart.getDate() - 7);
    const anoAntEnd = new Date(anoAntCenter);
    anoAntEnd.setDate(anoAntEnd.getDate() + 13);
    const anoAntStartStr = anoAntStart.toISOString().split('T')[0];
    const anoAntEndStr   = anoAntEnd.toISOString().split('T')[0];

    // Base 12 meses
    const base12Start = new Date(refDate);
    base12Start.setMonth(base12Start.getMonth() - 12);
    const base12StartStr = base12Start.toISOString().split('T')[0];

    // ── 3. Queries ───────────────────────────────────────────────────────────
    const products = await sql`
      SELECT id, nome, setor, unidade, status, dias_producao
      FROM produtos WHERE status = 'ativo'
      ORDER BY setor, nome
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

    // Mesmo período ano anterior
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

    // Base 12 meses
    const salesBase12m = await sql`
      SELECT p.id as produto_id, SUM(v.quantidade) as total
      FROM vendas v JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= ${base12StartStr} AND v.data < ${startDate}
      GROUP BY p.id
    `;

    // Semana atual (exibição no painel)
    const currentWeekSales = await sql`
      SELECT p.id as produto_id, SUM(v.quantidade) as quantidade_total
      FROM vendas v JOIN produtos p ON v.produto_id = p.id
      WHERE v.data >= ${startDate} AND v.data <= ${endDate}
      GROUP BY p.id
    `;
    const currentWeekLoss = await sql`
      SELECT p.id as produto_id, SUM(pe.quantidade) as quantidade_total
      FROM perdas pe JOIN produtos p ON pe.produto_id = p.id
      WHERE pe.data >= ${startDate} AND pe.data <= ${endDate}
      GROUP BY p.id
    `;

    // ── 4. Processar por produto ─────────────────────────────────────────────
    const productAnalysis = products.map((product: any) => {
      const pid = product.id;

      // Parse dias de produção
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

      // ── Agrupar vendas e perdas por semana ────────────────────────────────
      type WeekData = { sales: number; losses: number; hasData: boolean };
      const weeklyData: WeekData[] = [];

      for (let i = 0; i < semanasHistorico; i++) {
        const wStart = new Date(recStart);
        wStart.setDate(wStart.getDate() + i * 7);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);

        const wSales = prodSalesRec
          .filter((s: any) => { const d = new Date(s.data); return d >= wStart && d <= wEnd; })
          .reduce((acc: number, s: any) => acc + parseFloat(s.quantidade), 0);
        const wLoss  = prodLossesRec
          .filter((l: any) => { const d = new Date(l.data); return d >= wStart && d <= wEnd; })
          .reduce((acc: number, l: any) => acc + parseFloat(l.quantidade), 0);

        weeklyData.push({ sales: wSales, losses: wLoss, hasData: (wSales + wLoss) > 0 });
      }

      // Semanas com dados efetivos
      const semanasComDados = weeklyData.filter(w => w.hasData).length;
      const weekSaleTotals  = weeklyData.filter(w => w.hasData).map(w => w.sales);
      const allWeekSales    = weeklyData.map(w => w.sales); // inclui zeros para tendência

      // ── Mesmo período ano anterior ────────────────────────────────────────
      const totalVendaAnoAnt  = parseFloat(salesAnoAnt.find( (s: any) => s.produto_id === pid)?.total ?? '0');
      const totalPerdaAnoAnt  = parseFloat(lossesAnoAnt.find((l: any) => l.produto_id === pid)?.total ?? '0');
      const mediaVendaAnoAnt  = totalVendaAnoAnt  / 3; // janela de 3 semanas
      const mediaPerdaAnoAnt  = totalPerdaAnoAnt  / 3;
      const temAnoAnterior    = totalVendaAnoAnt  > 0;

      // ── Base 12 meses ─────────────────────────────────────────────────────
      const total12m     = parseFloat(salesBase12m.find((s: any) => s.produto_id === pid)?.total ?? '0');
      const mediaBase12m = total12m / 52;
      const tem12m       = total12m > 0;

      // ── Nível de confiança ────────────────────────────────────────────────
      const confianca = getConfidenceLevel(semanasComDados, temAnoAnterior);

      // ── PASSO A: Previsão de vendas ───────────────────────────────────────
      let vendaPrevista = 0;
      let estrategiaUsada = '';
      let pesosUsados = { rec: 0, ano: 0, base: 0 };

      if (semanasComDados === 0) {
        // Sem nenhum dado → usa valor padrão configurado
        vendaPrevista  = sugestaoSemDados;
        estrategiaUsada = `Sem histórico. Usando sugestão padrão de ${sugestaoSemDados} ${product.unidade}.`;

      } else if (semanasComDados <= 3) {
        // Poucos dados → usa apenas a média do que existe, sem tendência
        vendaPrevista  = mean(weekSaleTotals);
        estrategiaUsada = `Histórico inicial (${semanasComDados} sem.). Usando média simples sem tendência.`;
        pesosUsados = { rec: 1, ano: 0, base: 0 };

      } else {
        // Dados suficientes → blend completo
        const mediaRecencia = mean(weekSaleTotals);

        if (temAnoAnterior && tem12m) {
          // Blend completo: recência + ano anterior + base 12m
          // Pesos variam por postura
          const wRec  = posturaKey === 'conservador' ? 0.45 : posturaKey === 'agressivo' ? 0.70 : 0.60;
          const wAno  = posturaKey === 'conservador' ? 0.40 : posturaKey === 'agressivo' ? 0.20 : 0.30;
          const wBase = 1 - wRec - wAno;
          vendaPrevista  = wRec * mediaRecencia + wAno * mediaVendaAnoAnt + wBase * mediaBase12m;
          pesosUsados    = { rec: wRec, ano: wAno, base: wBase };
          estrategiaUsada = `Blend completo: ${Math.round(wRec*100)}% recência + ${Math.round(wAno*100)}% mesmo período ano ant. + ${Math.round(wBase*100)}% base 12m.`;

        } else if (!temAnoAnterior && tem12m) {
          // Sem ano anterior → recência + base 12m
          const wRec  = posturaKey === 'conservador' ? 0.65 : posturaKey === 'agressivo' ? 0.85 : 0.75;
          const wBase = 1 - wRec;
          vendaPrevista  = wRec * mediaRecencia + wBase * mediaBase12m;
          pesosUsados    = { rec: wRec, ano: 0, base: wBase };
          estrategiaUsada = `Sem histórico anual. Blend: ${Math.round(wRec*100)}% recência + ${Math.round(wBase*100)}% base 12m.`;

        } else if (temAnoAnterior && !tem12m) {
          // Sem base 12m → recência + ano anterior
          const wRec = posturaKey === 'conservador' ? 0.50 : posturaKey === 'agressivo' ? 0.75 : 0.65;
          const wAno = 1 - wRec;
          vendaPrevista  = wRec * mediaRecencia + wAno * mediaVendaAnoAnt;
          pesosUsados    = { rec: wRec, ano: wAno, base: 0 };
          estrategiaUsada = `Blend: ${Math.round(wRec*100)}% recência + ${Math.round(wAno*100)}% mesmo período ano ant.`;

        } else {
          // Apenas recência
          vendaPrevista  = mediaRecencia;
          pesosUsados    = { rec: 1, ano: 0, base: 0 };
          estrategiaUsada = `Apenas recência (${semanasComDados} semanas).`;
        }

        // A5. Ajuste por tendência de crescimento (só com 4+ semanas)
        if (semanasComDados >= 4) {
          const half       = Math.max(1, Math.floor(allWeekSales.length / 2));
          const mediaRec   = mean(allWeekSales.slice(allWeekSales.length - half));
          const mediaOld   = mean(allWeekSales.slice(0, half));
          const growthRate = mediaOld > 0 ? (mediaRec - mediaOld) / mediaOld : 0;

          // Amplifica tendência conforme postura, limitado pelo cap configurado
          const rawAdj    = growthRate;
          const adjFinal  = Math.max(-postura.growthCap, Math.min(postura.growthCap, rawAdj));
          vendaPrevista   = vendaPrevista * (1 + adjFinal);
        }
      }

      // ── Tendência (para exibição) ─────────────────────────────────────────
      let salesTrend: 'growing' | 'decreasing' | 'stable' = 'stable';
      let lossesTrend: 'growing' | 'decreasing' | 'stable' = 'stable';
      let growthRateDisplay = 0;

      if (semanasComDados >= 4) {
        const half       = Math.max(1, Math.floor(allWeekSales.length / 2));
        const mediaRec   = mean(allWeekSales.slice(allWeekSales.length - half));
        const mediaOld   = mean(allWeekSales.slice(0, half));
        growthRateDisplay = mediaOld > 0 ? (mediaRec - mediaOld) / mediaOld : 0;

        salesTrend = growthRateDisplay >  0.08 ? 'growing'
                   : growthRateDisplay < -0.08 ? 'decreasing'
                   : 'stable';

        const allWeekLosses = weeklyData.map(w => w.losses);
        const lossRec = mean(allWeekLosses.slice(allWeekLosses.length - half));
        const lossOld = mean(allWeekLosses.slice(0, half));
        const lossGrowth = lossOld > 0 ? (lossRec - lossOld) / lossOld : 0;
        lossesTrend = lossGrowth >  0.08 ? 'growing'
                    : lossGrowth < -0.08 ? 'decreasing'
                    : 'stable';
      }

      // ── PASSO B: Taxa de perda (mediana) ─────────────────────────────────
      const weekLossRates: number[] = weeklyData
        .filter(w => (w.sales + w.losses) > 0)
        .map(w => w.losses / (w.sales + w.losses));

      let taxaPerdaFinal = 0;

      if (weekLossRates.length === 0 && temAnoAnterior && (mediaVendaAnoAnt + mediaPerdaAnoAnt) > 0) {
        // Sem taxa recente → usa apenas o ano anterior
        taxaPerdaFinal = mediaPerdaAnoAnt / (mediaVendaAnoAnt + mediaPerdaAnoAnt);

      } else if (weekLossRates.length > 0 && temAnoAnterior && (mediaVendaAnoAnt + mediaPerdaAnoAnt) > 0) {
        // Blend: 70% recência + 30% ano anterior
        const taxaRec = median(weekLossRates);
        const taxaAno = mediaPerdaAnoAnt / (mediaVendaAnoAnt + mediaPerdaAnoAnt);
        taxaPerdaFinal = 0.70 * taxaRec + 0.30 * taxaAno;

      } else {
        // Apenas recência (ou zero)
        taxaPerdaFinal = median(weekLossRates);
      }

      // Cap seguro para evitar divisão por zero
      const taxaSafe = Math.min(taxaPerdaFinal, 0.90);

      // ── PASSO C: Produção final ───────────────────────────────────────────
      // Fórmula: VendaPrevista ÷ (1 - TaxaPerda) × (1 + Buffer)
      const prodBase        = vendaPrevista > 0 && taxaSafe < 1
                              ? vendaPrevista / (1 - taxaSafe)
                              : vendaPrevista;
      const prodFinal       = prodBase * (1 + bufferPct);
      const suggestedProduction = Math.max(0, Math.ceil(prodFinal));

      // ── Médias para exibição ──────────────────────────────────────────────
      const avgSales  = mean(weekSaleTotals);
      const avgLosses = mean(weeklyData.filter(w => w.hasData).map(w => w.losses));
      const avgLossRate = taxaPerdaFinal * 100;

      const currentSales  = parseFloat(currentWeekSales.find((s: any) => s.produto_id === pid)?.quantidade_total ?? '0');
      const currentLosses = parseFloat(currentWeekLoss.find( (l: any) => l.produto_id === pid)?.quantidade_total ?? '0');
      const currentLossRate = (currentSales + currentLosses) > 0
        ? (currentLosses / (currentSales + currentLosses)) * 100 : 0;

      // ── Texto da sugestão ─────────────────────────────────────────────────
      let suggestion = estrategiaUsada;
      if (semanasComDados > 0) {
        const pctBuffer = (bufferPct * 100).toFixed(0);
        const pctPerda  = (taxaPerdaFinal * 100).toFixed(1);
        suggestion = `${estrategiaUsada} Taxa de perda: ${pctPerda}%. Buffer: +${pctBuffer}%.`;
      }

      return {
        produto_id:      pid,
        produto_nome:    product.nome,
        setor:           product.setor,
        unidade:         product.unidade,
        production_days: diasProducao,

        // Médias exibição
        avg_sales:     Math.round(avgSales  * 100) / 100,
        avg_losses:    Math.round(avgLosses * 100) / 100,
        avg_loss_rate: Math.round(avgLossRate * 10) / 10,

        // Semana atual
        current_sales:     currentSales,
        current_losses:    currentLosses,
        current_loss_rate: Math.round(currentLossRate * 10) / 10,

        // Tendências
        sales_trend:  salesTrend,
        losses_trend: lossesTrend,
        sales_growth_rate: Math.round(growthRateDisplay * 1000) / 10,

        // Confiança
        confianca: confianca.nivel,
        confianca_label: confianca.label,
        confianca_cor:   confianca.cor,
        semanas_com_dados: semanasComDados,
        tem_ano_anterior: temAnoAnterior,

        // Detalhes do cálculo (para painel transparente)
        calc_details: {
          venda_prevista:        Math.round(vendaPrevista       * 100) / 100,
          taxa_perda_pct:        Math.round(taxaPerdaFinal      * 1000) / 10,
          prod_base:             Math.round(prodBase            * 100) / 100,
          buffer_pct:            bufferPct * 100,
          media_recencia:        Math.round(avgSales            * 100) / 100,
          media_ano_anterior:    Math.round(mediaVendaAnoAnt    * 100) / 100,
          media_base12m:         Math.round(mediaBase12m        * 100) / 100,
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
