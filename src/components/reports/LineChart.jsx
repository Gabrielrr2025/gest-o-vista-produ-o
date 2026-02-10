import React from 'react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function LineChart({ 
  data, 
  compareData = null, 
  showSales = true, 
  showLosses = true,
  reportType = 'sales'
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Nenhum dado disponível para o período selecionado
      </div>
    );
  }

  // Agrupar dados por data e somar valores
  const aggregatedData = {};
  
  data.forEach(item => {
    const dateKey = format(new Date(item.data), 'dd/MM', { locale: ptBR });
    
    if (!aggregatedData[dateKey]) {
      aggregatedData[dateKey] = {
        date: dateKey,
        value: 0,
        compareValue: 0
      };
    }
    
    aggregatedData[dateKey].value += parseFloat(item.valor_reais || 0);
  });

  // Adicionar dados de comparação se existir
  if (compareData && compareData.length > 0) {
    compareData.forEach(item => {
      const dateKey = format(new Date(item.data), 'dd/MM', { locale: ptBR });
      
      if (!aggregatedData[dateKey]) {
        aggregatedData[dateKey] = {
          date: dateKey,
          value: 0,
          compareValue: 0
        };
      }
      
      aggregatedData[dateKey].compareValue += parseFloat(item.valor_reais || 0);
    });
  }

  const chartData = Object.values(aggregatedData).sort((a, b) => {
    // Ordenar por data
    const [dayA, monthA] = a.date.split('/');
    const [dayB, monthB] = b.date.split('/');
    return monthA === monthB ? dayA - dayB : monthA - monthB;
  });

  const lineColor = reportType === 'sales' ? '#3b82f6' : '#ef4444';
  const compareLineColor = reportType === 'sales' ? '#f59e0b' : '#f97316';
  const label = reportType === 'sales' ? 'Faturamento' : 'Perdas';

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart 
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            stroke="#64748b"
            style={{ fontSize: '12px' }}
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
          
          {/* Linha principal */}
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={lineColor}
            strokeWidth={2}
            name={`${label} (Período Atual)`}
            dot={{ fill: lineColor, r: 4 }}
            activeDot={{ r: 6 }}
          />
          
          {/* Linha de comparação */}
          {compareData && (
            <Line 
              type="monotone" 
              dataKey="compareValue" 
              stroke={compareLineColor}
              strokeWidth={2}
              strokeDasharray="5 5"
              name={`${label} (Período Comparação)`}
              dot={{ fill: compareLineColor, r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
