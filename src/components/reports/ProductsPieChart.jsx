import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = [
  '#2563eb', // Azul vivo
  '#dc2626', // Vermelho
  '#16a34a', // Verde escuro
  '#d97706', // Âmbar
  '#7c3aed', // Violeta
  '#0891b2', // Ciano
  '#64748b', // Cinza (Outros)
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const isOthers = data.name === 'Outros';
    
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-xs">
        <p className="text-sm font-semibold text-slate-700 mb-1">{data.name}</p>
        <p className="text-sm text-slate-600">
          Valor: <span className="font-semibold text-slate-900">
            R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          Percentual: <span className="font-semibold text-slate-900">{(data.payload.percent * 100).toFixed(1)}%</span>
        </p>
        
        {/* Se for "Outros", mostrar detalhamento */}
        {isOthers && data.payload.products && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-600 mb-1">Produtos incluídos:</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {data.payload.products.map((product, idx) => (
                <div key={idx} className="text-xs text-slate-600">
                  • {product.nome}: <span className="font-medium">
                    R$ {product.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, percent }) => {
  // percent aqui já vem entre 0 e 1 do recharts (ex: 0.52 = 52%)
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const pct = percent * 100;
  if (pct < 4) return null;
  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${pct.toFixed(1)}%`}
    </text>
  );
};

export default function ProductsPieChart({ 
  products, 
  sector = null,
  type = 'sales',
  topN = 5
}) {
  const chartData = useMemo(() => {
    if (!products || products.length === 0) {
      return [];
    }

    // Filtrar por setor se fornecido
    let filteredProducts = products;
    if (sector) {
      filteredProducts = products.filter(p => p.setor === sector);
    }

    // Ordenar por valor (maior → menor)
    const sortedProducts = [...filteredProducts].sort((a, b) => 
      parseFloat(b.total_valor) - parseFloat(a.total_valor)
    );

    // Pegar top N
    const topProducts = sortedProducts.slice(0, topN);
    const othersProducts = sortedProducts.slice(topN);

    // Calcular total
    const total = sortedProducts.reduce((sum, p) => sum + parseFloat(p.total_valor), 0);

    // Criar dados do gráfico
    const data = topProducts.map(product => ({
      name: product.produto_nome || product.nome,
      value: parseFloat(product.total_valor),
      percent: total > 0 ? ((parseFloat(product.total_valor) / total) * 100).toFixed(1) : 0
    }));

    // Adicionar "Outros" se houver
    if (othersProducts.length > 0) {
      const othersValue = othersProducts.reduce((sum, p) => sum + parseFloat(p.total_valor), 0);
      
      data.push({
        name: 'Outros',
        value: othersValue,
        percent: total > 0 ? ((othersValue / total) * 100).toFixed(1) : 0,
        products: othersProducts.map(p => ({
          nome: p.produto_nome || p.nome,
          valor: parseFloat(p.total_valor)
        }))
      });
    }

    return data;
  }, [products, sector, topN]);

  if (!products || products.length === 0) {
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

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-500">
            {sector ? `Nenhum produto encontrado para ${sector}` : 'Nenhum produto encontrado'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const title = sector ? 
    `Top ${topN} Produtos - ${sector}` : 
    `Distribuição de ${type === 'sales' ? 'Vendas' : 'Perdas'}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {sector && (
            <Badge variant="outline">{sector}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius="38%"
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
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
                formatter={(value, entry) => {
                  const isOthers = value === 'Outros';
                  const otherCount = entry.payload.products?.length || 0;
                  return (
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>
                      {value}{isOthers && otherCount > 0 && ` (${otherCount})`}: <strong>R$ {(entry.payload.value / 1000).toFixed(1)}k</strong>
                    </span>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}