import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RevenueChart({ data, comparisonData = [], products }) {
  // Criar mapa de preços dos produtos
  const priceMap = {};
  products.forEach(product => {
    priceMap[product.id] = product.price || 0;
  });

  // Verificar se há produtos com preço
  const hasPrice = Object.values(priceMap).some(price => price > 0);
  
  if (!hasPrice) {
    return null; // Não mostrar o gráfico se não houver preços
  }

  // Calcular faturamento para cada período
  const dataWithRevenue = data.map((item, index) => ({
    periodKey: item.periodKey,
    periodLabel: item.periodLabel,
    revenue: item.revenue || 0,
    comparisonRevenue: comparisonData[index]?.revenue ?? null
  }));

  const totalRevenue = dataWithRevenue.reduce((sum, item) => sum + item.revenue, 0);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const comparisonEntry = payload.find((entry) => entry.dataKey === 'comparisonRevenue');
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-semibold text-slate-900 mb-2">{payload[0]?.payload?.periodLabel || label}</p>
          <p className="text-sm text-green-600">
            Faturamento: {formatCurrency(payload[0]?.value || 0)}
          </p>
          {comparisonEntry && (
            <p className="text-sm text-emerald-400">
              Comparação: {formatCurrency(comparisonEntry?.value || 0)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Faturamento no Período</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={dataWithRevenue} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="periodKey" 
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              tickFormatter={(value, index) => dataWithRevenue[index]?.periodLabel || value}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              label={{ value: 'Faturamento (R$)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="revenue" 
              fill="#10B981" 
              radius={[8, 8, 0, 0]}
              name="Faturamento"
            />
            {comparisonData.length > 0 && (
              <Bar 
                dataKey="comparisonRevenue" 
                fill="#6ee7b7" 
                radius={[8, 8, 0, 0]}
                name="Faturamento (comparação)"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
        
        {/* Total no rodapé */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="text-center">
            <span className="text-sm text-slate-600">Total: </span>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
