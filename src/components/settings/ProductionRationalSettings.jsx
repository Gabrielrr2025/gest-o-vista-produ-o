import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Save, RotateCcw, Info, ChevronDown, ChevronUp, FlaskConical, Lightbulb, ShieldAlert, HelpCircle } from "lucide-react";
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
  planejamento_buffer_pct: 5,
  planejamento_sugestao_sem_dados: 10,
};

const POSTURAS = [
  {
    key: 'conservador',
    label: 'Conservador',
    desc: 'Prefere não correr risco. Limita reações a tendências de crescimento. Bom para produtos com alta perecibilidade.',
    color: 'blue',
  },
  {
    key: 'equilibrado',
    label: 'Equilibrado',
    desc: 'Padrão recomendado. Reage a tendências de forma moderada.',
    color: 'green',
  },
  {
    key: 'agressivo',
    label: 'Agressivo',
    desc: 'Amplifica mais o crescimento de vendas. Bom para produtos com baixa perda e alta demanda variável.',
    color: 'orange',
  },
];

// Simulação para prévia
function FormulaPreview({ params }) {
  const buffer = params.planejamento_buffer_pct / 100;

  const growthCaps = {
    conservador: 0.05,
    equilibrado: 0.12,
    agressivo: 0.22,
  };
  const cap = growthCaps[params.planejamento_postura] || 0.12;

  const cenarios = [
    {
      label: 'Dados completos — Vendas ↑ Perdas ↓',
      vendaBase: 100, taxaPerda: 0.08, tendencia: 0.15,
      confianca: 'Alta', corConf: 'text-green-700 bg-green-50',
    },
    {
      label: 'Dados completos — Vendas → Perdas →',
      vendaBase: 100, taxaPerda: 0.12, tendencia: 0,
      confianca: 'Alta', corConf: 'text-green-700 bg-green-50',
    },
    {
      label: 'Sem histórico anual — só recência (4 sem.)',
      vendaBase: 80, taxaPerda: 0.12, tendencia: 0.05,
      confianca: 'Média', corConf: 'text-yellow-700 bg-yellow-50',
    },
    {
      label: 'Histórico muito curto (2 sem.)',
      vendaBase: 70, taxaPerda: 0.10, tendencia: 0, // sem tendência
      confianca: 'Baixa', corConf: 'text-orange-700 bg-orange-50',
    },
    {
      label: 'Produto novo — sem nenhum dado',
      vendaBase: 0, taxaPerda: 0, tendencia: 0,
      confianca: 'Sem histórico', corConf: 'text-slate-600 bg-slate-100',
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">
        Simulação com diferentes níveis de dados históricos disponíveis:
      </p>
      {cenarios.map((s, i) => {
        if (s.vendaBase === 0) {
          const sugestao = params.planejamento_sugestao_sem_dados;
          return (
            <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div>
                <span className="font-medium text-slate-700">{s.label}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.corConf}`}>{s.confianca}</span>
              </div>
              <span className="font-bold text-slate-600">{sugestao} un. (padrão)</span>
            </div>
          );
        }
        const tendAdj = Math.max(-cap, Math.min(cap, s.tendencia));
        const venda   = s.vendaBase * (1 + tendAdj);
        const taxaSafe = Math.min(s.taxaPerda, 0.9);
        const prod    = Math.ceil((venda / (1 - taxaSafe)) * (1 + buffer));
        const pct     = (((prod - s.vendaBase) / s.vendaBase) * 100).toFixed(0);
        const sign    = pct > 0 ? '+' : '';
        return (
          <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            <div>
              <span className="font-medium text-slate-700">{s.label}</span>
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.corConf}`}>{s.confianca}</span>
            </div>
            <span className="font-bold text-slate-900">{prod} un. <span className="text-slate-400 font-normal">({sign}{pct}%)</span></span>
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

  useQuery({
    queryKey: ['config', 'planejamento_racional_v3'],
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-purple-600" />
          Racional da Sugestão de Produção
        </CardTitle>
        <CardDescription>
          Como o sistema calcula a quantidade sugerida para cada produto
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-7">

        {/* Explicação rápida */}
        <Alert className="border-purple-200 bg-purple-50">
          <Info className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-purple-800 text-sm space-y-1.5">
            <p className="font-semibold">Como o sistema calcula:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li><strong>Prevê a venda</strong> combinando semanas recentes + mesmo período do ano anterior + base anual (quando disponíveis)</li>
              <li><strong>Calcula a taxa de perda</strong> histórica usando a mediana (robusta a semanas atípicas)</li>
              <li><strong>Produção = Venda prevista ÷ (1 − Taxa de perda) + Buffer</strong></li>
            </ol>
            <p className="text-xs opacity-75 pt-1">
              Se houver poucos dados, o sistema adapta o cálculo automaticamente e sinaliza o nível de confiança da sugestão.
            </p>
          </AlertDescription>
        </Alert>

        {/* Semanas de histórico */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-800">
            Semanas de histórico a considerar
            <HelpTooltip>
              <p className="font-semibold mb-1">📅 Janela de análise</p>
              <p>Define quantas semanas para trás o sistema olha ao calcular a média de vendas e detectar se as vendas estão subindo ou caindo.</p>
              <p className="mt-2"><strong>Exemplo:</strong> com 8 semanas, o sistema compara as últimas 4 semanas com as 4 anteriores para detectar tendências.</p>
              <p className="mt-2 opacity-75">Se o produto tiver menos semanas de dados do que o configurado, o sistema usa o que estiver disponível automaticamente.</p>
            </HelpTooltip>
          </Label>
          <p className="text-xs text-slate-500">
            Quantas semanas recentes são usadas para calcular a média e detectar tendências.
            O sistema usa o que tiver disponível se o produto for novo.
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

        {/* Postura */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-semibold text-slate-800">
              Postura de planejamento
              <HelpTooltip>
                <p className="font-semibold mb-1">🎯 Como reagir a tendências</p>
                <p>Quando as vendas estão claramente subindo ou caindo, o sistema pode amplificar mais ou menos essa tendência na sugestão.</p>
                <p className="mt-2"><strong>Conservador:</strong> reage pouco às tendências. Ideal para produtos muito perecíveis onde excesso vira perda.</p>
                <p className="mt-2"><strong>Equilibrado:</strong> reação moderada. Bom para a maioria dos produtos.</p>
                <p className="mt-2"><strong>Agressivo:</strong> amplifica bastante o crescimento. Melhor para produtos com longa validade e demanda variável.</p>
              </HelpTooltip>
            </Label>
            <p className="text-xs text-slate-500 mt-0.5">
              Define o quanto o sistema reage a tendências de crescimento ou queda de vendas.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {POSTURAS.map(p => {
              const isActive = params.planejamento_postura === p.key;
              const borderColor = {
                blue: isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300',
                green: isActive ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-green-300',
                orange: isActive ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-300',
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
                  <span className={`text-sm font-bold block mb-1 ${isActive ? labelColor : 'text-slate-700'}`}>
                    {p.label}
                  </span>
                  <span className="text-xs text-slate-500 leading-relaxed">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Buffer */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-800">
            Buffer de segurança
            <HelpTooltip>
              <p className="font-semibold mb-1">🛡️ Margem extra de proteção</p>
              <p>Após calcular a produção necessária para cobrir vendas + perdas históricas, o sistema ainda acrescenta esse percentual como margem de segurança.</p>
              <p className="mt-2"><strong>Exemplo com 5%:</strong> se o cálculo indicar 100 unidades, a sugestão final será 105.</p>
              <p className="mt-2"><strong>Quando usar mais:</strong> produtos com demanda muito imprevisível ou que frequentemente faltam.</p>
              <p className="mt-2"><strong>Quando usar menos:</strong> produtos com alta perecibilidade onde qualquer excesso vira perda garantida.</p>
            </HelpTooltip>
          </Label>
          <p className="text-xs text-slate-500">
            Margem extra adicionada após compensar as perdas. Protege contra variações inesperadas de demanda.
          </p>
          <div className="flex items-center gap-4 pt-1">
            <Slider
              min={0} max={20} step={1}
              value={[params.planejamento_buffer_pct]}
              onValueChange={([v]) => set('planejamento_buffer_pct', v)}
              className="flex-1"
            />
            <span className="text-sm font-bold text-slate-900 tabular-nums min-w-[40px] text-right">
              +{params.planejamento_buffer_pct}%
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
                <p>Quando um produto ainda não tem nenhum registro de venda ou perda, o sistema não tem base para calcular. Nesse caso, ele usa esse valor como ponto de partida.</p>
                <p className="mt-2">O produto aparecerá com o badge <strong>"Sem histórico"</strong> no planejamento para que o gestor saiba que a sugestão é genérica e deve ser ajustada manualmente.</p>
                <p className="mt-2 opacity-75">Assim que houver pelo menos 1 semana de dados, o sistema começa a usar o histórico real.</p>
              </HelpTooltip>
            </Label>
          </div>
          <p className="text-xs text-slate-500">
            Quando um produto não tem nenhum dado de venda ou perda ainda, o sistema sugere esta quantidade como ponto de partida.
            Aparece com badge "Sem histórico" no planejamento.
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
              Prévia — como a sugestão se comporta em cada situação
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
