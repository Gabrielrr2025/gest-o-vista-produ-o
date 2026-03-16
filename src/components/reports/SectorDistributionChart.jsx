import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = [
  '#2563eb', // Azul vivo (Padaria)
  '#16a34a', // Verde escuro (Confeitaria)
  '#dc2626', // Vermelho (Salgados)
  '#d97706', // Âmbar (Frios)
  '#7c3aed', // Violeta (Restaurante)
  '#0891b2', // Ciano (Minimercado)
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-700 mb-1">{data.name}</p>
        <p className="text-sm text-slate-600">
          Valor: <span className="font-semibold text-slate-900">
            R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          Percentual: <span className="font-semibold text-slate-900">{data.payload.percent}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const renderLabel = ({ cx, cy, midAngle, outerRadius, percent }) => {
  // percent vem de 0 a 1 do Recharts (fração do total)
  const pct = percent * 100;
  if (pct < 4) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${pct.toFixed(1)}%`}
    </text>
  );
};

export default function SectorDistributionChart({ sectors, type = 'sales' }) {
  if (!sectors || sectors.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">
            Nenhum dado disponível
          </p>
        </CardContent>
      </Card>
    );
  }

  // Transformar dados para formato do Recharts
  const chartData = sectors.map(sector => ({
    name: sector.setor,
    value: parseFloat(sector.total_valor)
  }));

  // Calcular total para percentuais
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // Adicionar percentual
  const chartDataWithPercent = chartData.map(item => ({
    ...item,
    percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
  }));

  // Ordenar por valor (maior para menor)
  chartDataWithPercent.sort((a, b) => b.value - a.value);

  const title = type === 'sales' ? 
    'Distribuição de Faturamento por Setor' : 
    'Distribuição de Perdas por Setor';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
              <Pie
                data={chartDataWithPercent}
                cx="38%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartDataWithPercent.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="vertical"
                verticalAlign="middle" 
                align="right"
                iconSize={12}
                wrapperStyle={{
                  fontSize: '14px',
                  paddingLeft: '20px'
                }}
                formatter={(value, entry) => (
                  <span className="text-sm font-medium">
                    {value}: <span className="font-bold">R$ {(entry.payload.value / 1000).toFixed(1)}k</span>
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}