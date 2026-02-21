import React from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = [
  '#3b82f6', // Azul
  '#f59e0b', // Laranja
  '#22c55e', // Verde
  '#ef4444', // Vermelho
  '#a855f7', // Roxo
  '#ec4899'  // Rosa
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-700 mb-1">{data.name}</p>
        <p className="text-sm text-slate-600">
          Valor: <span className="font-semibold text-slate-900">
            R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          Percentual: <span className="font-semibold text-slate-900">{data.payload.percent}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const renderLabel = (entry) => {
  return `${entry.percent}%`;
};

export default function PieChartReport({ data, reportType = 'sales' }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Nenhum dado disponível para o período selecionado
      </div>
    );
  }

  // Transformar dados para formato do Recharts
  const chartData = Object.entries(data).map(([setor, values]) => ({
    name: setor,
    value: parseFloat(values.valor_reais || 0)
  }));

  // Calcular total para percentuais
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // Adicionar percentual
  const chartDataWithPercent = chartData.map(item => ({
    ...item,
    percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
  }));

  // Ordenar por valor (maior para menor)
  chartDataWithPercent.sort((a, b) => b.value - a.value);

  const title = reportType === 'sales' ? 'Distribuição de Faturamento' : 'Distribuição de Perdas';

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">
        {title} por Setor
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={chartDataWithPercent}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartDataWithPercent.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry) => (
                <span className="text-sm">
                  {value}: R$ {entry.payload.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
