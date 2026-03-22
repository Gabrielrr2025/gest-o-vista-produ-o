import React, { useMemo, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
// rawSalesData / rawLossesData vêm do Reports pai já carregados
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { format, getDay, getWeek } from "date-fns";
import { Flag } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
const GROUPING_OPTIONS = [
  { value: 'day', label: 'Por dia' },
  { value: 'hour', label: 'Por hora' },
  { value: 'weekday', label: 'Por dia da semana' },
  { value: 'week', label: 'Por semana' },
  { value: 'month', label: 'Por mês' }
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ProductComparisonModal({ 
  isOpen, 
  onClose, 
  initialProduct,
  initialDateRange,
  rawSalesData = [],
  rawLossesData = [],
  type = 'sales'
}) {
  const [groupBy, setGroupBy] = useState('day');

  // Normalizar produto_id (FavoriteProduct usa product_id, outros usam produto_id)
  const productId = initialProduct?.produto_id || initialProduct?.product_id;

  // Filtrar rawData pelo produto selecionado
  const productNome = (initialProduct?.produto_nome || '').toLowerCase().trim();

  const rawSalesFiltered = useMemo(() => {
    if (!productNome) return [];
    return rawSalesData.filter(r => (r.produto || '').toLowerCase().trim() === productNome);
  }, [rawSalesData, productNome]);

  const rawLossesFiltered = useMemo(() => {
    if (!productNome) return [];
    return rawLossesData.filter(r => (r.produto || '').toLowerCase().trim() === productNome);
  }, [rawLossesData, productNome]);

  // Se não há dados nos rawData passados pelo pai (ex: produto favorito fora do período), buscar via API
  const needsFetch = isOpen && !!productNome && rawSalesFiltered.length === 0 && !!initialDateRange?.from && !!initialDateRange?.to;
  const fetchedDataQuery = useQuery({
    queryKey: ['productModalData', productNome, initialDateRange?.from, initialDateRange?.to],
    queryFn: async () => {
      const { format: fmt } = await import('date-fns');
      const startDate = fmt(initialDateRange.from, 'yyyy-MM-dd');
      const endDate = fmt(initialDateRange.to, 'yyyy-MM-dd');
      const [salesRes, lossRes] = await Promise.all([
        base44.functions.invoke('getSalesReport', { startDate, endDate, topN: 500 }),
        base44.functions.invoke('Getlossesreport', { startDate, endDate, topN: 500 }).catch(() => ({ data: { data: { rawData: [] } } })),
      ]);
      return {
        salesRaw: salesRes.data?.data?.rawData || [],
        lossesRaw: lossRes.data?.data?.rawData || [],
      };
    },
    enabled: needsFetch,
    staleTime: 5 * 60 * 1000,
  });

  const salesData = useMemo(() => {
    if (rawSalesFiltered.length > 0) return rawSalesFiltered;
    if (!fetchedDataQuery.data) return [];
    return fetchedDataQuery.data.salesRaw.filter(r => (r.produto || '').toLowerCase().trim() === productNome);
  }, [rawSalesFiltered, fetchedDataQuery.data, productNome]);

  const lossesData = useMemo(() => {
    if (rawLossesFiltered.length > 0) return rawLossesFiltered;
    if (!fetchedDataQuery.data) return [];
    return fetchedDataQuery.data.lossesRaw.filter(r => (r.produto || '').toLowerCase().trim() === productNome);
  }, [rawLossesFiltered, fetchedDataQuery.data, productNome]);

  // Totais
  const salesStats = useMemo(() => ({
    totalValor: salesData.reduce((s, r) => s + parseFloat(r.valor_reais || 0), 0),
    totalQuantidade: salesData.reduce((s, r) => s + parseFloat(r.quantidade || 0), 0),
  }), [salesData]);

  const lossesStats = useMemo(() => ({
    totalValor: lossesData.reduce((s, r) => s + parseFloat(r.valor_reais || 0), 0),
    totalQuantidade: lossesData.reduce((s, r) => s + parseFloat(r.quantidade || 0), 0),
  }), [lossesData]);

  // Buscar marcos do produto — por product_id (Base44 ID) ou por nome (fallback quando produto_id é código numérico do banco)
  const isBase44Id = productId && /^[a-f0-9]{24}$/i.test(String(productId));
  const milestonesQuery = useQuery({
    queryKey: ['milestones', productId, productNome],
    queryFn: async () => {
      if (isBase44Id) {
        return base44.entities.ProductMilestone.filter({ product_id: productId });
      }
      // produto_id é código numérico do banco → buscar por nome
      const all = await base44.entities.ProductMilestone.list('-created_date', 200);
      return all.filter(m => (m.product_name || '').toLowerCase().trim() === productNome);
    },
    enabled: isOpen && !!(productId || productNome),
  });
  const milestonesForChart = milestonesQuery.data || [];

  // Processar dados com agrupamento
  const chartData = useMemo(() => {
    if (salesData.length === 0 && lossesData.length === 0) return [];

    const dataByGroup = {};

    // Função auxiliar para agrupar dados
    const groupData = (data, valueKey, valorField) => {
      data.forEach(row => {
        try {
          const dateStr = (typeof row.data === 'string' ? row.data : '').slice(0, 10);
          const [year, month, day] = dateStr.split('-').map(Number);
          const fullDate = new Date(year, month - 1, day);
          let groupKey;
          let groupLabel;

          switch (groupBy) {
            case 'hour':
              groupKey = '0';
              groupLabel = '00h';
              break;
            case 'day':
              groupKey = dateStr;
              groupLabel = format(fullDate, 'dd/MM');
              break;
            case 'weekday':
              const weekday = getDay(fullDate);
              groupKey = `${weekday}`;
              groupLabel = WEEKDAY_NAMES[weekday];
              break;
            case 'week':
              const week = getWeek(fullDate, { weekStartsOn: 1 });
              groupKey = `${week}`;
              groupLabel = `Semana ${week}`;
              break;
            case 'month':
              groupKey = dateStr.slice(0, 7);
              groupLabel = format(fullDate, 'MMM/yy');
              break;
            default:
              groupKey = dateStr;
              groupLabel = format(fullDate, 'dd/MM');
          }

          if (!dataByGroup[groupKey]) {
            dataByGroup[groupKey] = { key: groupKey, label: groupLabel, vendas: 0, perdas: 0, compareVendas: 0, comparePerdas: 0 };
          }

          dataByGroup[groupKey][valueKey] += parseFloat(row[valorField] || 0);
        } catch (error) {
          // ignorar linha inválida
        }
      });
    };

    groupData(salesData, 'vendas', 'valor_reais');
    groupData(lossesData, 'perdas', 'valor_reais');

    // Se agrupamento por dia, garantir que dias de marcos existam no eixo mesmo sem dados
    if (groupBy === 'day') {
      (milestonesForChart || []).forEach(m => {
        const d = m.date?.split('T')[0];
        if (!d) return;
        const [y, mo, dy] = d.split('-').map(Number);
        const fullDate = new Date(y, mo - 1, dy);
        if (!dataByGroup[d]) {
          dataByGroup[d] = { key: d, label: format(fullDate, 'dd/MM'), vendas: 0, perdas: 0 };
        }
      });
    }

    return Object.values(dataByGroup)
      .map(group => ({ data: group.label, sortKey: group.key, vendas: group.vendas, perdas: group.perdas }))
      .sort((a, b) => {
        if (groupBy === 'weekday' || groupBy === 'hour') return parseInt(a.sortKey) - parseInt(b.sortKey);
        return a.sortKey.localeCompare(b.sortKey);
      });
  }, [salesData, lossesData, groupBy, milestonesForChart]);

  // Calcular quais marcos caem dentro do período atual e no agrupamento 'day'
  const milestoneLabels = useMemo(() => {
    if (groupBy !== 'day' || !milestonesForChart.length) return {};
    const result = {};
    milestonesForChart.forEach(m => {
      const d = m.date?.split('T')[0];
      if (!d) return;
      const [y, mo, dy] = d.split('-').map(Number);
      const label = format(new Date(y, mo - 1, dy), 'dd/MM');
      result[label] = m;
    });
    return result;
  }, [milestonesForChart, groupBy]);

  if (!initialProduct) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {initialProduct.produto_nome}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-base">{initialProduct.setor}</Badge>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card Vendas */}
            <Card className="bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 border-2 border-green-300 shadow-xl">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-green-700 font-semibold mb-1 uppercase tracking-wide">
                      Vendas Totais
                    </p>
                    <p className="text-3xl font-bold text-green-900">
                      R$ {((salesStats?.totalValor || 0) / 1000).toFixed(1)}k
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {(salesStats?.totalQuantidade || 0).toFixed(1)} {initialProduct.unidade}
                    </p>

                  </div>
                  <div className="bg-green-200 p-2 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-green-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card Perdas */}
            <Card className="bg-gradient-to-br from-red-50 via-red-100 to-rose-100 border-2 border-red-300 shadow-xl">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-red-700 font-semibold mb-1 uppercase tracking-wide">
                      Perdas Totais
                    </p>
                    <p className="text-3xl font-bold text-red-900">
                      R$ {((lossesStats?.totalValor || 0) / 1000).toFixed(1)}k
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {(lossesStats?.totalQuantidade || 0).toFixed(1)} {initialProduct.unidade}
                    </p>
                  </div>
                  <div className="bg-red-200 p-2 rounded-lg">
                    <TrendingDown className="w-8 h-8 text-red-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card Taxa de Perda */}
            <Card className="bg-gradient-to-br from-amber-50 via-amber-100 to-orange-100 border-2 border-amber-300 shadow-xl">
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs text-amber-700 font-semibold mb-1 uppercase tracking-wide">
                    Taxa de Perda
                  </p>
                  <p className="text-3xl font-bold text-amber-900">
                    {salesStats?.totalValor > 0 
                      ? ((lossesStats?.totalValor || 0) / salesStats.totalValor * 100).toFixed(1)
                      : '0.0'}%
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    do valor vendido
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico com Controles */}
          {chartData.length > 0 ? (
            <Card className="shadow-lg">
              <CardContent className="pt-6">
                {/* Header com controles */}
                <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Evolução de Vendas e Perdas
                    </h3>

                  </div>

                  {/* Agrupamento */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">Agrupar:</Label>
                    <Select value={groupBy} onValueChange={setGroupBy}>
                      <SelectTrigger className="w-40 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {GROUPING_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Gráfico */}
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="colorVendasProd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="colorCompareVendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.15}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="data" 
                      angle={groupBy === 'day' ? -45 : 0}
                      textAnchor={groupBy === 'day' ? 'end' : 'middle'}
                      height={groupBy === 'day' ? 80 : 50}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                    />
                    <Legend iconType="circle" />
                    
                    {/* Dados principais */}
                    <Bar 
                      dataKey="vendas" 
                      name="Vendas" 
                      fill="url(#colorVendasProd)"
                      radius={[8, 8, 0, 0]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="perdas" 
                      name="Perdas" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', r: 4, strokeWidth: 2, stroke: '#fff' }}
                    />
                    {/* Marcos temporais */}
                    {groupBy === 'day' && Object.entries(milestoneLabels).map(([label, milestone]) => (
                      <ReferenceLine
                        key={milestone.id}
                        x={label}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        label={{
                          value: `🚩 ${milestone.title}`,
                          position: 'top',
                          fontSize: 11,
                          fill: '#b45309',
                          fontWeight: 600,
                        }}
                      />
                    ))}
                    </ComposedChart>
                </ResponsiveContainer>

                {/* Lista de marcos no período */}
                {groupBy === 'day' && Object.keys(milestoneLabels).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" /> Marcos no período
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(milestoneLabels).map(([label, milestone]) => (
                        <div key={milestone.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                          <span className="text-xs font-bold text-amber-700">{label}</span>
                          <span className="text-xs text-amber-600">—</span>
                          <span className="text-xs font-medium text-amber-800">{milestone.title}</span>
                          {milestone.notes && (
                            <span className="text-xs text-amber-500 italic">({milestone.notes})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Nenhum dado disponível para o período selecionado
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}