import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUp, ArrowDown } from "lucide-react";

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

export default function ProductEvolution({ 
  produto,
  evolutionData, 
  compareEvolutionData = null,
  stats,
  compareStats = null,
  type = 'sales'
}) {
  if (!evolutionData || evolutionData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">
            Selecione um produto para ver a evolução
          </p>
        </CardContent>
      </Card>
    );
  }

  // Preparar dados para o gráfico
  const chartData = evolutionData.map(item => ({
    date: format(new Date(item.data), 'dd/MM', { locale: ptBR }),
    value: parseFloat(item.valor)
  }));

  // Adicionar dados de comparação se existir
  if (compareEvolutionData && compareEvolutionData.length > 0) {
    compareEvolutionData.forEach(item => {
      const dateStr = format(new Date(item.data), 'dd/MM', { locale: ptBR });
      const existing = chartData.find(d => d.date === dateStr);
      if (existing) {
        existing.compareValue = parseFloat(item.valor);
      } else {
        chartData.push({
          date: dateStr,
          value: 0,
          compareValue: parseFloat(item.valor)
        });
      }
    });
  }

  // Ordenar por data
  chartData.sort((a, b) => {
    const [dayA, monthA] = a.date.split('/');
    const [dayB, monthB] = b.date.split('/');
    return monthA === monthB ? dayA - dayB : monthA - monthB;
  });

  const lineColor = type === 'sales' ? '#3b82f6' : '#ef4444';
  const compareLineColor = type === 'sales' ? '#f59e0b' : '#f97316';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Evolução - {produto?.nome}</span>
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <div className="text-slate-600">Total Período:</div>
                <div className="font-bold text-slate-900">
                  R$ {stats.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              {compareStats && compareStats.variacao !== null && (
                <div className={`flex items-center gap-1 ${
                  compareStats.variacao > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {compareStats.variacao > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  <span className="font-bold">{Math.abs(compareStats.variacao).toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}
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
                dot={{ fill: lineColor, r: 4 }}
                activeDot={{ r: 6 }}
              />
              
              {/* Linha de comparação */}
              {compareEvolutionData && (
                <Line 
                  type="monotone" 
                  dataKey="compareValue" 
                  stroke={compareLineColor}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Período Comparação"
                  dot={{ fill: compareLineColor, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Estatísticas adicionais */}
        {stats && (
          <div className="mt-4 grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
            <div className="text-center">
              <div className="text-xs text-slate-600">Média Diária</div>
              <div className="text-lg font-bold text-slate-900">
                R$ {stats.mediaValor.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-600">Quantidade Total</div>
              <div className="text-lg font-bold text-slate-900">
                {stats.totalQuantidade.toFixed(1)} {produto?.unidade}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-600">Dias com Vendas</div>
              <div className="text-lg font-bold text-slate-900">
                {stats.diasComDados}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
