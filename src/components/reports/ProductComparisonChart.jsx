import React, { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, getHours, getDay, getWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GROUPING_OPTIONS = [
  { value: 'hour', label: 'Por hora' },
  { value: 'day', label: 'Por dia' },
  { value: 'weekday', label: 'Por dia da semana' },
  { value: 'week', label: 'Por semana' },
  { value: 'month', label: 'Por mês' }
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PRODUCT_COLORS = ['#3b82f6', '#f59e0b', '#22c55e']; // Azul, Laranja, Verde

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-semibold text-slate-900">
              R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const formatYAxis = (value) => {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value}`;
};

export default function ProductComparisonChart({ productsData }) {
  const [groupBy, setGroupBy] = useState('day');

  const chartData = useMemo(() => {
    if (!productsData || productsData.length === 0) {
      return [];
    }

    // Coletar todas as datas únicas
    const allDatesSet = new Set();
    productsData.forEach(product => {
      product.evolution.forEach(item => {
        const dateStr = item.data.split('T')[0];
        allDatesSet.add(dateStr);
      });
    });

    const allDates = Array.from(allDatesSet).sort();

    // Criar estrutura de dados agrupados
    const groupedData = {};

    productsData.forEach((product, productIndex) => {
      product.evolution.forEach(item => {
        try {
          const dateStr = item.data.split('T')[0];
          const fullDate = parseISO(item.data);
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
              const month = format(fullDate, 'yyyy-MM');
              groupKey = month;
              groupLabel = format(fullDate, 'MMM/yy', { locale: ptBR });
              break;

            default:
              groupKey = dateStr;
              groupLabel = format(fullDate, 'dd/MM', { locale: ptBR });
          }

          if (!groupedData[groupKey]) {
            groupedData[groupKey] = {
              key: groupKey,
              label: groupLabel,
              products: {}
            };
          }

          const productKey = `product${productIndex}`;
          if (!groupedData[groupKey].products[productKey]) {
            groupedData[groupKey].products[productKey] = 0;
          }

          groupedData[groupKey].products[productKey] += parseFloat(item.valor || 0);
        } catch (error) {
          console.error('Erro ao processar:', error);
        }
      });
    });

    // Converter para array
    const chartArray = Object.values(groupedData)
      .map(group => {
        const dataPoint = {
          date: group.label,
          sortKey: group.key
        };

        productsData.forEach((_, index) => {
          dataPoint[`product${index}`] = group.products[`product${index}`] || 0;
        });

        return dataPoint;
      })
      .sort((a, b) => {
        if (groupBy === 'weekday' || groupBy === 'hour') {
          return parseInt(a.sortKey) - parseInt(b.sortKey);
        }
        return a.sortKey.localeCompare(b.sortKey);
      });

    return chartArray;
  }, [productsData, groupBy]);

  if (!productsData || productsData.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        Nenhum produto selecionado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controle de Agrupamento */}
      <div className="flex justify-end">
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

      {/* Gráfico */}
      <div className="w-full h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
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
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
            />
            
            {/* Linhas para cada produto */}
            {productsData.map((product, index) => (
              <Line 
                key={index}
                type="monotone" 
                dataKey={`product${index}`}
                stroke={PRODUCT_COLORS[index]}
                strokeWidth={index === 0 ? 3 : 2}
                name={product.produto.nome}
                dot={{ fill: PRODUCT_COLORS[index], r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
