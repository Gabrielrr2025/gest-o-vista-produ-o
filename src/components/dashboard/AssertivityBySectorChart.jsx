import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SECTORS } from "../common/SectorBadge";

const sectorColorValues = {
  "Padaria": "#f59e0b",
  "Salgados": "#f97316",
  "Confeitaria": "#ec4899",
  "Minimercado": "#3b82f6",
  "Restaurante": "#10b981",
  "Frios": "#06b6d4"
};

export default function AssertivityBySectorChart({ salesData, lossData, productionData }) {
  const chartData = useMemo(() => {
    return SECTORS.map(sector => {
      const sectorProduction = productionData.filter(p => p.sector === sector && p.assertiveness !== undefined);
      const avgAssertiveness = sectorProduction.length > 0
        ? sectorProduction.reduce((sum, p) => sum + (p.assertiveness || 0), 0) / sectorProduction.length
        : 0;

      return {
        sector,
        assertividade: parseFloat(avgAssertiveness.toFixed(1))
      };
    }).filter(s => s.assertividade > 0);
  }, [productionData]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-800">Assertividade por Setor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
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
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value) => `${value}%`}
              />
              <Bar dataKey="assertividade" name="Assertividade" radius={[4, 4, 0, 0]}>
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