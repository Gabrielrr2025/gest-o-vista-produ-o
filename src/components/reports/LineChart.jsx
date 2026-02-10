import React from 'react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIOD_COLORS = [
  '#3b82f6', // Azul
  '#f59e0b', // Laranja
  '#22c55e', // Verde
  '#a855f7'  // Roxo
];

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

export default function LineChart({ periodsData = [], reportType = 'sales' }) {
  if (!periodsData || periodsData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Nenhum dado disponível para o período selecionado
      </div>
    );
  }

  // Consolidar todas as datas de todos os períodos
  const allDates = new Set();
  periodsData.forEach(period => {
    period.data.raw.forEach(item => {
      const dateKey = format(new Date(item.data), 'dd/MM', { locale: ptBR });
      allDates.add(dateKey);
    });
  });

  // Criar estrutura de dados para o gráfico
  const chartData = Array.from(allDates).sort((a, b) => {
    const [dayA, monthA] = a.split('/');
    const [dayB, monthB] = b.split('/');
    return monthA === monthB ? dayA - dayB : monthA - monthB;
  }).map(date => {
    const dataPoint = { date };
    
    // Para cada período, agregar os valores desta data
    periodsData.forEach((period, idx) => {
      let total = 0;
      period.data.raw.forEach(item => {
        const itemDate = format(new Date(item.data), 'dd/MM', { locale: ptBR });
        if (itemDate === date) {
          total += parseFloat(item.valor_reais || 0);
        }
      });
      dataPoint[`period${idx}`] = total;
    });
    
    return dataPoint;
  });

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
          
          {/* Renderizar uma linha para cada período */}
          {periodsData.map((period, idx) => (
            <Line 
              key={idx}
              type="monotone" 
              dataKey={`period${idx}`}
              stroke={PERIOD_COLORS[idx]}
              strokeWidth={2}
              name={period.label}
              dot={{ fill: PERIOD_COLORS[idx], r: 4 }}
              activeDot={{ r: 6 }}
              strokeDasharray={idx > 0 ? "5 5" : "0"} // Períodos de comparação com linha tracejada
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
