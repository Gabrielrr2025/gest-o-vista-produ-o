import React, { useMemo, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { format, subYears, parseISO, getHours, getDay, getWeek } from "date-fns";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import DateRangePicker from "./DateRangePicker";

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
  type = 'sales'
}) {
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [groupBy, setGroupBy] = useState('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareDateRange, setCompareDateRange] = useState(() => {
    if (!initialDateRange?.from || !initialDateRange?.to) return null;
    return {
      from: subYears(initialDateRange.from, 1),
      to: subYears(initialDateRange.to, 1)
    };
  });

  // Buscar evolução do produto (VENDAS - período principal)
  const salesEvolutionQuery = useQuery({
    queryKey: ['productEvolution', 'sales', initialProduct?.produto_id, dateRange],
    queryFn: async () => {
      if (!initialProduct || !dateRange?.from || !dateRange?.to) return null;

      const response = await base44.functions.invoke('Getproductevolution', {
        produtoId: initialProduct.produto_id,
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        type: 'sales'
      });
      
      return response.data;
    },
    enabled: isOpen && !!initialProduct && !!dateRange?.from && !!dateRange?.to
  });

  // Buscar evolução do produto (PERDAS - período principal)
  const lossesEvolutionQuery = useQuery({
    queryKey: ['productEvolution', 'losses', initialProduct?.produto_id, dateRange],
    queryFn: async () => {
      if (!initialProduct || !dateRange?.from || !dateRange?.to) return null;

      const response = await base44.functions.invoke('Getproductevolution', {
        produtoId: initialProduct.produto_id,
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        type: 'losses'
      });
      
      return response.data;
    },
    enabled: isOpen && !!initialProduct && !!dateRange?.from && !!dateRange?.to
  });

  // Buscar evolução do produto (VENDAS - período de comparação)
  const compareSalesQuery = useQuery({
    queryKey: ['productEvolution', 'sales', initialProduct?.produto_id, compareDateRange, 'compare'],
    queryFn: async () => {
      if (!initialProduct || !compareDateRange?.from || !compareDateRange?.to) return null;

      const response = await base44.functions.invoke('Getproductevolution', {
        produtoId: initialProduct.produto_id,
        startDate: format(compareDateRange.from, 'yyyy-MM-dd'),
        endDate: format(compareDateRange.to, 'yyyy-MM-dd'),
        type: 'sales'
      });
      
      return response.data;
    },
    enabled: isOpen && !!initialProduct && compareEnabled && !!compareDateRange?.from && !!compareDateRange?.to
  });

  // Buscar evolução do produto (PERDAS - período de comparação)
  const compareLossesQuery = useQuery({
    queryKey: ['productEvolution', 'losses', initialProduct?.produto_id, compareDateRange, 'compare'],
    queryFn: async () => {
      if (!initialProduct || !compareDateRange?.from || !compareDateRange?.to) return null;

      const response = await base44.functions.invoke('Getproductevolution', {
        produtoId: initialProduct.produto_id,
        startDate: format(compareDateRange.from, 'yyyy-MM-dd'),
        endDate: format(compareDateRange.to, 'yyyy-MM-dd'),
        type: 'losses'
      });
      
      return response.data;
    },
    enabled: isOpen && !!initialProduct && compareEnabled && !!compareDateRange?.from && !!compareDateRange?.to
  });

  // Processar dados com agrupamento
  const chartData = useMemo(() => {
    const salesData = salesEvolutionQuery.data?.data?.evolution || [];
    const lossesData = lossesEvolutionQuery.data?.data?.evolution || [];
    const compareSalesData = compareEnabled ? (compareSalesQuery.data?.data?.evolution || []) : [];
    const compareLossesData = compareEnabled ? (compareLossesQuery.data?.data?.evolution || []) : [];

    if (salesData.length === 0) return [];

    const dataByGroup = {};

    // Função auxiliar para agrupar dados
    const groupData = (data, targetMap, valueKey) => {
      data.forEach(row => {
        try {
          const dateStr = row.data.split('T')[0];
          const fullDate = parseISO(row.data);
          let groupKey;
          let groupLabel;

          switch (groupBy) {
            case 'hour':
              const hour = getHours(fullDate);
              groupKey = `${hour}`;
              groupLabel = `${hour.toString().padStart(2, '0')}h`;
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
              const month = format(fullDate, 'yyyy-MM');
              groupKey = month;
              groupLabel = format(fullDate, 'MMM/yy');
              break;

            default:
              groupKey = dateStr;
              groupLabel = format(fullDate, 'dd/MM');
          }

          if (!dataByGroup[groupKey]) {
            dataByGroup[groupKey] = {
              key: groupKey,
              label: groupLabel,
              vendas: 0,
              perdas: 0,
              compareVendas: 0,
              comparePerdas: 0
            };
          }

          dataByGroup[groupKey][valueKey] += parseFloat(row.valor || 0);
        } catch (error) {
          console.error('Erro ao processar dados:', error);
        }
      });
    };

    // Processar todos os dados
    groupData(salesData, dataByGroup, 'vendas');
    groupData(lossesData, dataByGroup, 'perdas');
    if (compareEnabled) {
      groupData(compareSalesData, dataByGroup, 'compareVendas');
      groupData(compareLossesData, dataByGroup, 'comparePerdas');
    }

    // Converter para array e ordenar
    const chartArray = Object.values(dataByGroup)
      .map(group => ({
        data: group.label,
        sortKey: group.key,
        vendas: group.vendas,
        perdas: group.perdas,
        compareVendas: group.compareVendas,
        comparePerdas: group.comparePerdas
      }))
      .sort((a, b) => {
        if (groupBy === 'weekday' || groupBy === 'hour') {
          return parseInt(a.sortKey) - parseInt(b.sortKey);
        }
        return a.sortKey.localeCompare(b.sortKey);
      });

    return chartArray;
  }, [salesEvolutionQuery.data, lossesEvolutionQuery.data, compareSalesQuery.data, compareLossesQuery.data, groupBy, compareEnabled]);

  const isLoading = salesEvolutionQuery.isLoading || lossesEvolutionQuery.isLoading;

  const salesStats = salesEvolutionQuery.data?.data?.stats;
  const lossesStats = lossesEvolutionQuery.data?.data?.stats;
  const compareSalesStats = compareSalesQuery.data?.data?.stats;
  const compareLossesStats = compareLossesQuery.data?.data?.stats;

  // Calcular variação
  const salesVariation = useMemo(() => {
    if (!compareEnabled || !salesStats || !compareSalesStats) return null;
    if (compareSalesStats.totalValor === 0) return null;
    return ((salesStats.totalValor - compareSalesStats.totalValor) / compareSalesStats.totalValor) * 100;
  }, [salesStats, compareSalesStats, compareEnabled]);

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
                    {salesVariation !== null && (
                      <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${
                        salesVariation > 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {salesVariation > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>
                          {salesVariation > 0 ? '+' : ''}
                          {salesVariation.toFixed(1)}% vs comparação
                        </span>
                      </div>
                    )}
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
          {isLoading ? (
            <Card className="shadow-lg">
              <CardContent className="py-16 text-center">
                <div className="text-slate-500">Carregando evolução do produto...</div>
              </CardContent>
            </Card>
          ) : chartData.length > 0 ? (
            <Card className="shadow-lg">
              <CardContent className="pt-6">
                {/* Header com controles */}
                <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Evolução de Vendas e Perdas
                    </h3>
                    {compareEnabled && (
                      <p className="text-sm text-slate-600 mt-1">
                        Comparação de períodos ativa
                      </p>
                    )}
                  </div>

                  {/* Controles em linha */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Período */}
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">Período:</Label>
                      <div className="relative z-50">
                        <DateRangePicker 
                          value={dateRange}
                          onChange={setDateRange}
                        />
                      </div>
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

                    {/* Comparação */}
                    <div className="flex items-center gap-2">
                      <Switch
                        id="compare"
                        checked={compareEnabled}
                        onCheckedChange={setCompareEnabled}
                      />
                      <Label htmlFor="compare" className="text-sm font-medium text-slate-700 cursor-pointer whitespace-nowrap">
                        Comparar
                      </Label>
                    </div>

                    {/* Período de comparação */}
                    {compareEnabled && (
                      <div className="relative z-50">
                        <DateRangePicker 
                          value={compareDateRange}
                          onChange={setCompareDateRange}
                        />
                      </div>
                    )}
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
                    
                    {/* Barras de comparação (se ativo) */}
                    {compareEnabled && (
                      <>
                        <Bar 
                          dataKey="compareVendas" 
                          name="Vendas (comparação)" 
                          fill="url(#colorCompareVendas)"
                          radius={[8, 8, 0, 0]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="comparePerdas" 
                          name="Perdas (comparação)" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: '#ef4444', r: 3 }}
                        />
                      </>
                    )}
                    
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
                  </ComposedChart>
                </ResponsiveContainer>
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