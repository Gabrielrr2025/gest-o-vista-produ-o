import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LossRateChart({ data, comparisonData = [] }) {
  // Calcular taxa de perda para cada ponto
  const dataWithRate = data.map(item => {
    const rate = item.sales > 0 ? ((item.losses / item.sales) * 100) : 0;
    return {
      periodKey: item.periodKey,
      periodLabel: item.periodLabel,
      rate: parseFloat(rate.toFixed(2))
    };
  });

  const comparisonWithRate = comparisonData.map(item => {
    const rate = item.sales > 0 ? ((item.losses / item.sales) * 100) : 0;
    return {
      periodKey: item.periodKey,
      periodLabel: item.periodLabel,
      comparisonRate: parseFloat(rate.toFixed(2))
    };
  });

  const combinedData = dataWithRate.map((item, index) => ({
    ...item,
    comparisonRate: comparisonWithRate[index]?.comparisonRate ?? null
  }));

  // Calcular média geral
  const averageRate = dataWithRate.length > 0
    ? dataWithRate.reduce((sum, item) => sum + item.rate, 0) / dataWithRate.length
    : 0;

  // Criar pontos coloridos (verde/vermelho)
  const dataWithColors = combinedData.map(item => ({
    ...item,
    isAboveAverage: item.rate > averageRate
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const comparisonEntry = payload.find((entry) => entry.dataKey === 'comparisonRate');
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-semibold text-slate-900 mb-2">{payload[0]?.payload?.periodLabel || label}</p>
          <p className="text-sm text-orange-600">
            Taxa: {payload[0]?.value?.toFixed(2)}%
          </p>
          {comparisonEntry && (
            <p className="text-sm text-amber-500">
              Comparação: {comparisonEntry?.value?.toFixed(2)}%
            </p>
          )}
          <p className="text-sm text-slate-500">
            Média: {averageRate.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const color = payload.isAboveAverage ? '#ef4444' : '#22c55e';
    
    return (
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Taxa de Perda no Período</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={dataWithColors} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="periodKey" 
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              tickFormatter={(value, index) => dataWithColors[index]?.periodLabel || value}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              label={{ value: 'Taxa (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="top" 
              height={36}
              iconType="line"
              wrapperStyle={{ fontSize: 14 }}
            />
            
            {/* Linha de referência (média) */}
            <ReferenceLine 
              y={averageRate} 
              stroke="#94a3b8" 
              strokeDasharray="5 5"
              label={{ 
                value: `Média: ${averageRate.toFixed(1)}%`, 
                position: 'right',
                fill: '#64748b',
                fontSize: 12
              }}
            />
            
            <Line 
              type="monotone" 
              dataKey="rate" 
              stroke="#F59E0B" 
              strokeWidth={2}
              name="Taxa de Perda"
              dot={<CustomDot />}
              activeDot={{ r: 7 }}
            />
            {comparisonData.length > 0 && (
              <Line 
                type="monotone" 
                dataKey="comparisonRate" 
                stroke="#fcd34d" 
                strokeWidth={2}
                name="Taxa (comparação)"
                strokeDasharray="6 4"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
