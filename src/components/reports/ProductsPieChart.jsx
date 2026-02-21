import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = [
  '#3b82f6', // Azul
  '#f59e0b', // Laranja
  '#22c55e', // Verde
  '#ef4444', // Vermelho
  '#a855f7', // Roxo
  '#64748b'  // Cinza (Outros)
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
          Percentual: <span className="font-semibold text-slate-900">{data.payload.percent}%</span>
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

const renderLabel = (entry) => {
  return `${entry.percent}%`;
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
            <PieChart>
              <Pie
                data={chartData}
                cx="35%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
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
                formatter={(value, entry) => {
                  const isOthers = value === 'Outros';
                  const otherCount = entry.payload.products?.length || 0;
                  
                  return (
                    <span className="text-sm font-medium">
                      {value}
                      {isOthers && otherCount > 0 && ` (${otherCount})`}: 
                      <span className="font-bold"> R$ {(entry.payload.value / 1000).toFixed(1)}k</span>
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
