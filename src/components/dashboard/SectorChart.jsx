import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const sectorColorValues = {
  "Padaria": "#f59e0b",
  "Salgados": "#f97316",
  "Confeitaria": "#ec4899",
  "Minimercado": "#3b82f6",
  "Restaurante": "#10b981",
  "Frios": "#06b6d4"
};

export default function SectorChart({ salesData, lossData, title = "Desempenho por Setor" }) {
  const chartData = React.useMemo(() => {
    const sectors = {};
    
    salesData.forEach(record => {
      if (!sectors[record.sector]) {
        sectors[record.sector] = { sector: record.sector, vendas: 0, perdas: 0 };
      }
      sectors[record.sector].vendas += record.quantity || 0;
    });

    lossData.forEach(record => {
      if (!sectors[record.sector]) {
        sectors[record.sector] = { sector: record.sector, vendas: 0, perdas: 0 };
      }
      sectors[record.sector].perdas += record.quantity || 0;
    });

    return Object.values(sectors);
  }, [salesData, lossData]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="sector" 
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="vendas" name="Vendas" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={sectorColorValues[entry.sector] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}