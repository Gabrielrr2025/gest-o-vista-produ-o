import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';

export default function AssertivityVsSalesChart({ salesData, lossData, productionData }) {
  const chartData = useMemo(() => {
    const products = {};
    
    salesData.forEach(record => {
      const key = record.product_name;
      if (!products[key]) {
        products[key] = { name: key, vendas: 0, assertividade: 0 };
      }
      products[key].vendas += record.quantity || 0;
    });

    productionData.forEach(record => {
      const key = record.product_name;
      if (products[key] && record.assertiveness !== undefined) {
        products[key].assertividade = record.assertiveness;
      }
    });

    return Object.values(products)
      .filter(p => p.assertividade > 0 && p.vendas > 0)
      .map(p => ({
        x: p.vendas,
        y: p.assertividade,
        z: p.vendas / 10,
        name: p.name
      }));
  }, [salesData, productionData]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-800">Assertividade x Vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name="Vendas" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                label={{ value: 'Vendas', position: 'insideBottom', offset: -5, fontSize: 11 }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Assertividade" 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                domain={[0, 100]}
                label={{ value: 'Assertividade %', angle: -90, position: 'insideLeft', fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[50, 400]} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value, name) => {
                  if (name === 'x') return [value, 'Vendas'];
                  if (name === 'y') return [`${value}%`, 'Assertividade'];
                  return value;
                }}
              />
              <Scatter 
                name="Produtos" 
                data={chartData} 
                fill="#8b5cf6" 
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}