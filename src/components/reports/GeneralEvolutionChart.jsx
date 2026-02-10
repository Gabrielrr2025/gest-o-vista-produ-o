import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, eachDayOfInterval } from 'date-fns';
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

export default function GeneralEvolutionChart({ 
  rawData, 
  compareRawData = null,
  dateRange,
  compareDateRange = null,
  type = 'sales'
}) {
  console.log('🔍 DEBUG GeneralEvolutionChart:', {
    rawDataLength: rawData?.length,
    rawDataSample: rawData?.[0],
    dateRange,
    type
  });

  if (!rawData || rawData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">
            Nenhum dado disponível para o período selecionado
          </p>
        </CardContent>
      </Card>
    );
  }

  // Gerar todos os dias do período
  const allDays = eachDayOfInterval({
    start: dateRange.from,
    end: dateRange.to
  });

  // Agregar dados por dia
  const chartData = allDays.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dateLabel = format(day, 'dd/MM', { locale: ptBR });
    
    // Somar valores do dia atual
    const dayValue = rawData
      .filter(item => item.data === dateStr)
      .reduce((sum, item) => sum + parseFloat(item.valor_reais || 0), 0);

    const dataPoint = {
      date: dateLabel,
      value: dayValue
    };

    // Se tiver comparação, buscar valor do mesmo dia no período de comparação
    if (compareRawData && compareDateRange) {
      const compareDayIndex = allDays.indexOf(day);
      if (compareDayIndex !== -1) {
        const compareDays = eachDayOfInterval({
          start: compareDateRange.from,
          end: compareDateRange.to
        });
        
        if (compareDays[compareDayIndex]) {
          const compareDateStr = format(compareDays[compareDayIndex], 'yyyy-MM-dd');
          const compareValue = compareRawData
            .filter(item => item.data === compareDateStr)
            .reduce((sum, item) => sum + parseFloat(item.valor_reais || 0), 0);
          
          dataPoint.compareValue = compareValue;
        }
      }
    }

    return dataPoint;
  });

  console.log('📊 Dados processados para gráfico:', {
    chartDataLength: chartData.length,
    chartDataSample: chartData.slice(0, 3),
    totalValue: chartData.reduce((sum, d) => sum + d.value, 0)
  });

  const lineColor = type === 'sales' ? '#3b82f6' : '#ef4444';
  const compareLineColor = type === 'sales' ? '#f59e0b' : '#f97316';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Evolução Temporal - {type === 'sales' ? 'Vendas' : 'Perdas'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-80">
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
                name="Período Atual"
                dot={{ fill: lineColor, r: 3 }}
                activeDot={{ r: 5 }}
              />
              
              {/* Linha de comparação */}
              {compareRawData && (
                <Line 
                  type="monotone" 
                  dataKey="compareValue" 
                  stroke={compareLineColor}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Período Comparação"
                  dot={{ fill: compareLineColor, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
