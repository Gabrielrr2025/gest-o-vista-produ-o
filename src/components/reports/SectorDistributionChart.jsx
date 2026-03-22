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
          Percentual: <span className="font-semibold text-slate-900">{data.payload.pctDisplay}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const renderLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  const pct = percent * 100;
  if (pct < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
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

  // Adicionar percentual (nomeado pctDisplay para não conflitar com o percent nativo do Recharts)
  const chartDataWithPercent = chartData.map(item => ({
    ...item,
    pctDisplay: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
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
            <PieChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
              <Pie
                data={chartDataWithPercent}
                cx="50%"
                cy="45%"
                labelLine={false}
                label={renderLabel}
                outerRadius="42%"
                fill="#8884d8"
                dataKey="value"
              >
                {chartDataWithPercent.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                iconSize={10}
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                formatter={(value, entry) => (
                  <span style={{ fontSize: '12px', fontWeight: 500 }}>
                    {value}: <strong>R$ {(entry.payload.value / 1000).toFixed(1)}k</strong>
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