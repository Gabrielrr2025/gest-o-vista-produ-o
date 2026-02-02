import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SalesVsLossChart({ salesData, lossData }) {
  const chartData = useMemo(() => {
    const grouped = {};
    
    salesData.forEach(record => {
      const key = record.date;
      if (!grouped[key]) {
        grouped[key] = { date: key, vendas: 0, perdas: 0 };
      }
      grouped[key].vendas += record.quantity || 0;
    });

    lossData.forEach(record => {
      const key = record.date;
      if (!grouped[key]) {
        grouped[key] = { date: key, vendas: 0, perdas: 0 };
      }
      grouped[key].perdas += record.quantity || 0;
    });

    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(item => ({
        ...item,
        date: format(parseISO(item.date), "dd/MM", { locale: ptBR })
      }));
  }, [salesData, lossData]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-800">Evolução: Vendas vs Perdas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="vendas" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Vendas"
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="perdas" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Perdas"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}