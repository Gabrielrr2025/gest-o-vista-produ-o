import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SalesLossChart({ data, comparisonData = [] }) {
  const combinedData = data.map((item, index) => ({
    periodKey: item.periodKey,
    periodLabel: item.periodLabel,
    sales: item.sales,
    losses: item.losses,
    comparisonSales: comparisonData[index]?.sales ?? null,
    comparisonLosses: comparisonData[index]?.losses ?? null
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-semibold text-slate-900 mb-2">{payload[0]?.payload?.periodLabel || label}</p>
          {payload.map((entry) => (
            <p key={entry.dataKey} className={`text-sm ${entry.color ? '' : 'text-slate-600'}`} style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toFixed(2)} KG
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vendas e Perdas no Período</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={combinedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="periodKey" 
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              tickFormatter={(value, index) => combinedData[index]?.periodLabel || value}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              label={{ value: 'Quantidade (KG)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="top" 
              height={36}
              iconType="line"
              wrapperStyle={{ fontSize: 14 }}
            />
            <Line 
              type="monotone" 
              dataKey="sales" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Vendas"
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="losses" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Perdas"
              dot={{ fill: '#ef4444', r: 4 }}
              activeDot={{ r: 6 }}
            />
            {comparisonData.length > 0 && (
              <>
                <Line 
                  type="monotone" 
                  dataKey="comparisonSales" 
                  stroke="#93c5fd" 
                  strokeWidth={2}
                  name="Vendas (comparação)"
                  strokeDasharray="6 4"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="comparisonLosses" 
                  stroke="#fca5a5" 
                  strokeWidth={2}
                  name="Perdas (comparação)"
                  strokeDasharray="6 4"
                  dot={false}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
