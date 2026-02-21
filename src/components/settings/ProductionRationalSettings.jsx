import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Save, RotateCcw, Info, ChevronDown, ChevronUp, FlaskConical, Lightbulb, ShieldAlert, HelpCircle, TrendingUp, Sigma, Calculator, BarChart3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

function HelpTooltip({ children }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center text-slate-400 hover:text-slate-600 transition-colors ml-1 align-middle">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed p-3 bg-slate-800 text-slate-100 border-0">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const DEFAULTS = {
  planejamento_semanas_historico: 8,
  planejamento_postura: 'equilibrado',
  planejamento_sugestao_sem_dados: 10,
};

// k = fator de nível de serviço (quantos desvios padrão de buffer adicionar)
const POSTURAS = [
  {
    key: 'conservador',
    label: 'Conservador',
    k: 1.0,
    nivelServico: '84%',
    desc: 'Buffer = 1,0 × σ. Nível de serviço de 84%. Indica menor margem de segurança. Ideal para produtos muito perecíveis onde excesso vira perda certa.',
    color: 'blue',
  },
  {
    key: 'equilibrado',
    label: 'Equilibrado',
    k: 1.28,
    nivelServico: '90%',
    desc: 'Buffer = 1,28 × σ. Nível de serviço de 90%. Padrão recomendado para a maioria dos produtos.',
    color: 'green',
  },
  {
    key: 'agressivo',
    label: 'Agressivo',
    k: 1.65,
    nivelServico: '95%',
    desc: 'Buffer = 1,65 × σ. Nível de serviço de 95%. Margem de segurança alta. Bom para produtos com baixa perecibilidade e alta demanda variável.',
    color: 'orange',
  },
];

// Simulação de preview com a nova fórmula PCP
function FormulaPreview({ params }) {
  const postura = POSTURAS.find(p => p.key === params.planejamento_postura) || POSTURAS[1];
  const k = postura.k;

  const cenarios = [
    {
      label: 'Produto estável (baixa variação)',
      semanas: [98, 101, 99, 100, 102, 98, 101, 100],
      taxaPerda: 0.08,
      confianca: 'Alta', corConf: 'text-green-700 bg-green-50',
    },
    {
      label: 'Produto com variação moderada',
      semanas: [85, 110, 90, 115, 88, 108, 92, 105],
      taxaPerda: 0.12,
      confianca: 'Alta', corConf: 'text-green-700 bg-green-50',
    },
    {
      label: 'Produto imprevisível (alta variação)',
      semanas: [60, 130, 70, 140, 55, 145, 65, 135],
      taxaPerda: 0.15,
      confianca: 'Alta', corConf: 'text-green-700 bg-green-50',
    },
    {
      label: 'Histórico curto (4 semanas)',
      semanas: [80, 90, 85, 88],
      taxaPerda: 0.10,
      confianca: 'Média', corConf: 'text-yellow-700 bg-yellow-50',
    },
    {
      label: 'Produto novo — sem nenhum dado',
      semanas: [],
      taxaPerda: 0,
      confianca: 'Sem histórico', corConf: 'text-slate-600 bg-slate-100',
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">
        Simulação com diferentes perfis de produto (mesmo buffer % pode virar valores muito diferentes):
      </p>
      {cenarios.map((s, i) => {
        if (s.semanas.length === 0) {
          return (
            <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div>
                <span className="font-medium text-slate-700">{s.label}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.corConf}`}>{s.confianca}</span>
              </div>
              <span className="font-bold text-slate-600">{params.planejamento_sugestao_sem_dados} un. (padrão)</span>
            </div>
          );
        }

        // MMP: pesos 1, 2, 3, ..., n (mais recente = maior peso)
        const n = s.semanas.length;
        const sumW = (n * (n + 1)) / 2;
        const mmp = s.semanas.reduce((acc, v, i) => acc + v * (i + 1), 0) / sumW;

        // Desvio padrão
        const avg = s.semanas.reduce((a, b) => a + b, 0) / n;
        const variance = s.semanas.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / Math.max(1, n - 1);
        const sigma = Math.sqrt(variance);
        const buffer = k * sigma;

        // Produção
        const demandaComBuffer = mmp + buffer;
        const taxaSafe = Math.min(s.taxaPerda, 0.9);
        const prod = Math.ceil(demandaComBuffer / (1 - taxaSafe));
        const pct = (((prod - avg) / avg) * 100).toFixed(0);
        const sign = pct > 0 ? '+' : '';

        return (
          <div key={i} className="rounded-lg border px-3 py-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div>
                <span className="font-medium text-slate-700">{s.label}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.corConf}`}>{s.confianca}</span>
              </div>
              <span className="font-bold text-slate-900">{prod} un. <span className="text-slate-400 font-normal">({sign}{pct}%)</span></span>
            </div>
            <div className="text-[10px] text-slate-400 flex gap-3">
              <span>MMP: {mmp.toFixed(1)}</span>
              <span>σ: {sigma.toFixed(1)}</span>
              <span>Buffer: {buffer.toFixed(1)} ({k}×σ)</span>
              <span>Perda: {(s.taxaPerda * 100).toFixed(0)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProductionRationalSettings({ isAdmin }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useState(DEFAULTS);
  const [original, setOriginal] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMethod, setShowMethod] = useState(false);

  useQuery({
    queryKey: ['config', 'planejamento_pcp_v1'],
    queryFn: async () => {
      const keys = Object.keys(DEFAULTS);
      const results = await Promise.all(
        keys.map(k =>
          base44.functions.invoke('getConfig', { chave: k })
            .then(r => ({ chave: k, valor: r.data?.valor }))
            .catch(() => ({ chave: k, valor: null }))
        )
      );
      const loaded = {};
      results.forEach(({ chave, valor }) => {
        if (valor !== null && valor !== undefined) {
          if (chave === 'planejamento_postura') loaded[chave] = valor;
          else loaded[chave] = parseFloat(valor);
        }
      });
      return loaded;
    },
    onSuccess: (data) => {
      const merged = { ...DEFAULTS, ...data };
      setParams(merged);
      setOriginal(merged);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (p) => {
      await Promise.all(
        Object.entries(p).map(([chave, valor]) =>
          base44.functions.invoke('saveConfig', { chave, valor: String(valor) })
        )
      );
    },
    onSuccess: () => {
      setHasChanges(false);
      setOriginal({ ...params });
      queryClient.invalidateQueries(['planningData']);
      toast.success("✅ Configurações salvas! As sugestões serão recalculadas.");
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  const set = (chave, valor) => {
    setParams(prev => ({ ...prev, [chave]: valor }));
    setHasChanges(true);
  };

  if (!isAdmin) return null;

  const posturaAtual = POSTURAS.find(p => p.key === params.planejamento_postura) || POSTURAS[1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-purple-600" />
          Racional da Sugestão de Produção (PCP)
        </CardTitle>
        <CardDescription>
          Método baseado em Planejamento e Controle da Produção com Média Móvel Ponderada e buffer estatístico
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-7">

        {/* Como funciona — expansível */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors text-sm font-semibold text-purple-800"
            onClick={() => setShowMethod(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Como o sistema calcula a sugestão?
            </div>
            {showMethod ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showMethod && (
            <div className="p-4 bg-white space-y-4 text-sm text-slate-700">

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">A</div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Média Móvel Ponderada (MMP)</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ao invés de tratar todas as semanas igualmente, o sistema dá <strong>peso maior para as semanas mais recentes</strong>.
                    Se você configurou 8 semanas, a semana mais recente vale 8×, a anterior 7×, e assim por diante.
                    Isso captura tendências de forma automática — se as vendas estão crescendo, a sugestão já reflete isso.
                  </p>
                  <div className="mt-2 bg-slate-50 rounded px-3 py-2 text-xs font-mono text-slate-600">
                    MMP = (v₁×1 + v₂×2 + ... + vₙ×n) ÷ (1+2+...+n)
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">B</div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Buffer Estatístico (k × σ)</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O buffer de segurança é calculado com base na <strong>variabilidade real de cada produto</strong>.
                    σ (desvio padrão) mede o quanto as vendas oscilam semana a semana.
                    Um produto estável tem σ pequeno → buffer pequeno. Um produto imprevisível tem σ grande → buffer maior.
                    O fator k define o nível de serviço: k=1,28 significa que em 90% das semanas a produção será suficiente.
                  </p>
                  <div className="mt-2 bg-slate-50 rounded px-3 py-2 text-xs font-mono text-slate-600">
                    Buffer = k × σ_vendas
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">C</div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Ajuste do Calendário</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Se houver feriados ou eventos cadastrados na semana planejada, a MMP é multiplicada pelo impacto configurado.
                    Semanas históricas com eventos excepcionais recebem peso reduzido para não distorcer a média base.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">D</div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Ajuste pela Taxa de Perda</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A produção precisa cobrir tanto a demanda esperada quanto as perdas históricas.
                    A taxa de perda é calculada como <strong>mediana</strong> das semanas anteriores — isso a torna robusta contra semanas atípicas.
                  </p>
                  <div className="mt-2 bg-slate-50 rounded px-3 py-2 text-xs font-mono text-slate-600">
                    Produção = (MMP_ajustada × cal + Buffer) ÷ (1 − taxa_perda)
                  </div>
                </div>
              </div>

              <Alert className="border-blue-200 bg-blue-50 mt-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-xs">
                  <strong>Por que isso é melhor que um buffer % fixo?</strong> Um buffer de 5% em 20 unidades = apenas 1 unidade a mais.
                  Já um produto que varia ±30 unidades por semana precisa de muito mais segurança.
                  O buffer estatístico se adapta automaticamente a cada produto.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Semanas de histórico */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-800">
            Semanas de histórico
            <HelpTooltip>
              <p className="font-semibold mb-1">📅 Janela de análise</p>
              <p>Define quantas semanas o sistema olha para calcular a MMP e o desvio padrão.</p>
              <p className="mt-2"><strong>Mais semanas:</strong> estimativa mais estável, menos sensível a variações recentes.</p>
              <p className="mt-2"><strong>Menos semanas:</strong> reage mais rápido a mudanças de demanda, mas com mais ruído.</p>
              <p className="mt-2 opacity-75">Mínimo de 4 semanas para o cálculo do desvio padrão ser confiável.</p>
            </HelpTooltip>
          </Label>
          <p className="text-xs text-slate-500">
            Semanas usadas para calcular a Média Móvel Ponderada e o desvio padrão de cada produto.
          </p>
          <div className="flex items-center gap-4 pt-1">
            <Slider
              min={4} max={16} step={1}
              value={[params.planejamento_semanas_historico]}
              onValueChange={([v]) => set('planejamento_semanas_historico', v)}
              className="flex-1"
            />
            <span className="text-sm font-bold text-slate-900 tabular-nums min-w-[52px] text-right">
              {params.planejamento_semanas_historico} sem.
            </span>
          </div>
        </div>

        {/* Postura (nível de serviço) */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-semibold text-slate-800">
              Nível de serviço (postura)
              <HelpTooltip>
                <p className="font-semibold mb-1">📊 Nível de serviço estatístico</p>
                <p>Define o fator k aplicado ao desvio padrão no cálculo do buffer.</p>
                <p className="mt-2"><strong>k = 1,0 (84%):</strong> em 84% das semanas a produção será suficiente. Menor desperdício, maior risco de falta.</p>
                <p className="mt-2"><strong>k = 1,28 (90%):</strong> equilíbrio entre segurança e desperdício. Recomendado para a maioria.</p>
                <p className="mt-2"><strong>k = 1,65 (95%):</strong> em 95% das semanas não faltará. Mais seguro, porém mais desperdício.</p>
              </HelpTooltip>
            </Label>
            <p className="text-xs text-slate-500 mt-0.5">
              Quanto maior o nível de serviço, menor a chance de faltar produto — mas maior o buffer produzido.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {POSTURAS.map(p => {
              const isActive = params.planejamento_postura === p.key;
              const borderColor = {
                blue:   isActive ? 'border-blue-500 bg-blue-50'   : 'border-slate-200 hover:border-blue-300',
                green:  isActive ? 'border-green-500 bg-green-50'  : 'border-slate-200 hover:border-green-300',
                orange: isActive ? 'border-orange-500 bg-orange-50': 'border-slate-200 hover:border-orange-300',
              }[p.color];
              const labelColor = {
                blue: 'text-blue-700', green: 'text-green-700', orange: 'text-orange-700',
              }[p.color];

              return (
                <button
                  key={p.key}
                  onClick={() => set('planejamento_postura', p.key)}
                  className={`text-left rounded-lg border-2 p-3 transition-all ${borderColor}`}
                >
                  <span className={`text-sm font-bold block ${isActive ? labelColor : 'text-slate-700'}`}>
                    {p.label}
                  </span>
                  <span className={`text-xs font-semibold block mb-1 ${isActive ? labelColor : 'text-slate-500'}`}>
                    k = {p.k} · {p.nivelServico}
                  </span>
                  <span className="text-xs text-slate-500 leading-relaxed">{p.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Resumo da postura selecionada */}
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
            <Sigma className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Com a postura <strong>{posturaAtual.label}</strong>: Buffer = <strong>{posturaAtual.k} × σ_demanda</strong> — nível de serviço de <strong>{posturaAtual.nivelServico}</strong>
            </span>
          </div>
        </div>

        {/* Sugestão sem dados */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <Label className="text-sm font-semibold text-slate-800">
              Sugestão padrão para produtos sem histórico
              <HelpTooltip>
                <p className="font-semibold mb-1">🆕 Produto novo ou sem dados</p>
                <p>Sem nenhum dado histórico, o sistema não tem como calcular a MMP nem o σ. Esse valor é usado como ponto de partida.</p>
                <p className="mt-2">O produto aparecerá com badge "Sem histórico" no planejamento para que o gestor saiba que deve ajustar manualmente.</p>
                <p className="mt-2 opacity-75">Assim que houver pelo menos 2 semanas de dados, o sistema começa a usar o histórico real.</p>
              </HelpTooltip>
            </Label>
          </div>
          <p className="text-xs text-slate-500">
            Valor fixo sugerido quando o produto não tem nenhum registro de venda ou perda.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Input
              type="number"
              min={0}
              value={params.planejamento_sugestao_sem_dados}
              onChange={(e) => set('planejamento_sugestao_sem_dados', parseFloat(e.target.value) || 0)}
              className="w-28 text-center"
            />
            <span className="text-sm text-slate-500">unidades / semana</span>
          </div>
        </div>

        {/* Prévia */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
            onClick={() => setShowPreview(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Prévia — como a sugestão varia por perfil de produto
            </div>
            {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPreview && (
            <div className="p-4">
              <FormulaPreview params={params} />
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
          <Button
            variant="ghost" size="sm"
            onClick={() => { setParams(DEFAULTS); setHasChanges(true); }}
            className="text-slate-600"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar padrões
          </Button>
          <div className="flex gap-2">
            {hasChanges && original && (
              <Button variant="outline" size="sm" onClick={() => { setParams(original); setHasChanges(false); }}>
                Cancelar
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(params)}
              disabled={!hasChanges || saveMutation.isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isLoading ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        </div>

        {hasChanges && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Alterações não salvas. O planejamento será recalculado ao salvar.
          </p>
        )}

      </CardContent>
    </Card>
  );
}
