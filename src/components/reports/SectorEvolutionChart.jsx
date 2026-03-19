import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, getHours, getDay, getWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown } from 'lucide-react';

const GROUPING_OPTIONS = [
  { value: 'hour', label: 'Por hora' },
  { value: 'day', label: 'Por dia' },
  { value: 'weekday', label: 'Por dia da semana' },
  { value: 'week', label: 'Por semana' },
  { value: 'month', label: 'Por mês' }
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const formatYAxis = (value) => {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value}`;
};

// Modal de detalhes do período clicado
function PeriodDetailModal({ isOpen, onClose, periodLabel, salesItems, lossItems, groupBy }) {
  // Agrupar por produto
  const salesByProduct = useMemo(() => {
    const map = {};
    salesItems.forEach(item => {
      const nome = item.produto || item.produto_nome || 'Desconhecido';
      if (!map[nome]) map[nome] = 0;
      map[nome] += parseFloat(item.valor_reais || 0);
    });
    return Object.entries(map)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [salesItems]);

  const lossByProduct = useMemo(() => {
    const map = {};
    lossItems.forEach(item => {
      const nome = item.produto || item.produto_nome || 'Desconhecido';
      if (!map[nome]) map[nome] = 0;
      map[nome] += parseFloat(item.valor_reais || 0);
    });
    return Object.entries(map)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [lossItems]);

  const totalVendas = salesItems.reduce((s, i) => s + parseFloat(i.valor_reais || 0), 0);
  const totalPerdas = lossItems.reduce((s, i) => s + parseFloat(i.valor_reais || 0), 0);
  const taxaPerda = totalVendas > 0 ? (totalPerdas / totalVendas) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Detalhes — {periodLabel}
          </DialogTitle>
        </DialogHeader>

        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700 font-semibold uppercase">Vendas</p>
            <p className="text-xl font-bold text-green-900">
              R$ {totalVendas >= 1000 ? `${(totalVendas / 1000).toFixed(1)}k` : totalVendas.toFixed(2)}
            </p>
            <p className="text-xs text-green-600">{salesItems.length} registros</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700 font-semibold uppercase">Perdas</p>
            <p className="text-xl font-bold text-red-900">
              R$ {totalPerdas >= 1000 ? `${(totalPerdas / 1000).toFixed(1)}k` : totalPerdas.toFixed(2)}
            </p>
            <p className="text-xs text-red-600">{lossItems.length} registros</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700 font-semibold uppercase">Taxa Perda</p>
            <p className="text-xl font-bold text-amber-900">{taxaPerda.toFixed(1)}%</p>
            <p className="text-xs text-amber-600">do faturado</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Top produtos vendas */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <p className="text-sm font-semibold text-slate-700">Produtos Vendidos</p>
            </div>
            {salesByProduct.length === 0 ? (
              <p className="text-xs text-slate-400">Sem dados</p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {salesByProduct.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-green-50 rounded px-2.5 py-1.5">
                    <span className="text-xs text-slate-700 flex-1 truncate">{p.nome}</span>
                    <span className="text-xs font-semibold text-green-700 ml-2 whitespace-nowrap">
                      R$ {p.valor >= 1000 ? `${(p.valor / 1000).toFixed(1)}k` : p.valor.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top produtos perdas */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <p className="text-sm font-semibold text-slate-700">Produtos com Perda</p>
            </div>
            {lossByProduct.length === 0 ? (
              <p className="text-xs text-slate-400">Sem perdas registradas</p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {lossByProduct.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-red-50 rounded px-2.5 py-1.5">
                    <span className="text-xs text-slate-700 flex-1 truncate">{p.nome}</span>
                    <span className="text-xs font-semibold text-red-700 ml-2 whitespace-nowrap">
                      R$ {p.valor >= 1000 ? `${(p.valor / 1000).toFixed(1)}k` : p.valor.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SectorEvolutionChart({ 
  rawData,
  rawLossesData,
  sector,
  type = 'sales'
}) {
  const [groupBy, setGroupBy] = useState('day');
  const [modalData, setModalData] = useState(null); // { label, salesItems, lossItems }

  // Filtrar dados de vendas do setor
  const sectorSalesData = useMemo(() => {
    if (!rawData || !sector) return [];
    return rawData.filter(item => item.setor === sector);
  }, [rawData, sector]);

  // Perdas do setor (já filtradas por setor no rawLossesData via setor field)
  const sectorLossesData = useMemo(() => {
    if (!rawLossesData || !sector) return [];
    return rawLossesData.filter(item => item.setor === sector);
  }, [rawLossesData, sector]);

  // Mapa de rawItems por groupKey para o modal
  const rawItemsByKey = useMemo(() => {
    const salesMap = {};
    const lossMap = {};

    sectorSalesData.forEach(item => {
      const dateStr = (item.data || '').slice(0, 10);
      const [year, month, day] = dateStr.split('-').map(Number);
      const fullDate = new Date(year, month - 1, day);
      let groupKey;

      switch (groupBy) {
        case 'hour': groupKey = `${getHours(fullDate)}`; break;
        case 'day': groupKey = dateStr; break;
        case 'weekday': groupKey = `${getDay(fullDate)}`; break;
        case 'week': groupKey = `${getWeek(fullDate, { weekStartsOn: 1 })}`; break;
        case 'month': groupKey = dateStr.slice(0, 7); break;
        default: groupKey = dateStr;
      }

      if (!salesMap[groupKey]) salesMap[groupKey] = [];
      salesMap[groupKey].push(item);
    });

    sectorLossesData.forEach(item => {
      const dateStr = (item.data || '').slice(0, 10);
      const [year, month, day] = dateStr.split('-').map(Number);
      const fullDate = new Date(year, month - 1, day);
      let groupKey;

      switch (groupBy) {
        case 'hour': groupKey = `${getHours(fullDate)}`; break;
        case 'day': groupKey = dateStr; break;
        case 'weekday': groupKey = `${getDay(fullDate)}`; break;
        case 'week': groupKey = `${getWeek(fullDate, { weekStartsOn: 1 })}`; break;
        case 'month': groupKey = dateStr.slice(0, 7); break;
        default: groupKey = dateStr;
      }

      if (!lossMap[groupKey]) lossMap[groupKey] = [];
      lossMap[groupKey].push(item);
    });

    return { salesMap, lossMap };
  }, [sectorSalesData, sectorLossesData, groupBy]);

  const chartData = useMemo(() => {
    if (!sectorSalesData || sectorSalesData.length === 0) return [];

    const salesByGroup = {};

    sectorSalesData.forEach(item => {
      try {
        const dateStr = (item.data || '').slice(0, 10);
        const [year, month, day] = dateStr.split('-').map(Number);
        const fullDate = new Date(year, month - 1, day);
        let groupKey, groupLabel;

        switch (groupBy) {
          case 'hour':
            const hour = getHours(fullDate);
            groupKey = `${hour}`;
            groupLabel = `${hour.toString().padStart(2, '0')}h`;
            break;
          case 'day':
            groupKey = dateStr;
            groupLabel = format(fullDate, 'dd/MM', { locale: ptBR });
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
            groupLabel = format(fullDate, 'MMM/yy', { locale: ptBR });
            break;
          default:
            groupKey = dateStr;
            groupLabel = format(fullDate, 'dd/MM', { locale: ptBR });
        }

        if (!salesByGroup[groupKey]) {
          salesByGroup[groupKey] = { key: groupKey, label: groupLabel, vendas: 0, perdas: 0 };
        }
        salesByGroup[groupKey].vendas += parseFloat(item.valor_reais || 0);
      } catch (e) {}
    });

    sectorLossesData.forEach(item => {
      try {
        const dateStr = (item.data || '').slice(0, 10);
        const [year, month, day] = dateStr.split('-').map(Number);
        const fullDate = new Date(year, month - 1, day);
        let groupKey;

        switch (groupBy) {
          case 'hour': groupKey = `${getHours(fullDate)}`; break;
          case 'day': groupKey = dateStr; break;
          case 'weekday': groupKey = `${getDay(fullDate)}`; break;
          case 'week': groupKey = `${getWeek(fullDate, { weekStartsOn: 1 })}`; break;
          case 'month': groupKey = dateStr.slice(0, 7); break;
          default: groupKey = dateStr;
        }

        if (salesByGroup[groupKey]) {
          salesByGroup[groupKey].perdas += parseFloat(item.valor_reais || 0);
        }
      } catch (e) {}
    });

    return Object.values(salesByGroup)
      .map(group => ({ date: group.label, sortKey: group.key, vendas: group.vendas, perdas: group.perdas }))
      .sort((a, b) => {
        if (groupBy === 'weekday' || groupBy === 'hour') return parseInt(a.sortKey) - parseInt(b.sortKey);
        return a.sortKey.localeCompare(b.sortKey);
      });
  }, [sectorSalesData, sectorLossesData, groupBy]);

  const handleChartClick = (data) => {
    if (!data || !data.activePayload) return;
    const point = data.activePayload[0]?.payload;
    if (!point) return;
    const key = point.sortKey;
    const { salesMap, lossMap } = rawItemsByKey;
    setModalData({
      label: point.date,
      salesItems: salesMap[key] || [],
      lossItems: lossMap[key] || [],
    });
  };

  if (!sector) return null;

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">Nenhum dado disponível para {sector}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Evolução - {sector}</CardTitle>
              <Badge variant="outline">{sector}</Badge>
            </div>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUPING_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-400 mt-1">Clique em um ponto do gráfico para ver detalhes</p>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                onClick={handleChartClick}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                  angle={groupBy === 'day' ? -45 : 0}
                  textAnchor={groupBy === 'day' ? 'end' : 'middle'}
                  height={groupBy === 'day' ? 60 : 30}
                />
                <YAxis
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  labelFormatter={(label) => `${label} — clique para detalhes`}
                />
                <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} iconType="circle" />
                <Line
                  type="monotone"
                  dataKey="vendas"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Vendas"
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff', fill: '#10b981' }}
                />
                <Line
                  type="monotone"
                  dataKey="perdas"
                  stroke="#ef4444"
                  strokeWidth={3}
                  name="Perdas"
                  dot={{ fill: '#ef4444', r: 4 }}
                  activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff', fill: '#ef4444' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {modalData && (
        <PeriodDetailModal
          isOpen={!!modalData}
          onClose={() => setModalData(null)}
          periodLabel={modalData.label}
          salesItems={modalData.salesItems}
          lossItems={modalData.lossItems}
          groupBy={groupBy}
        />
      )}
    </>
  );
}