import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function ProductComparisonModal({ 
  isOpen, 
  onClose, 
  initialProduct,
  initialDateRange,
  type = 'sales'
}) {
  // Buscar evolução do produto (VENDAS)
  const salesEvolutionQuery = useQuery({
    queryKey: ['productEvolution', 'sales', initialProduct?.produto_id, initialDateRange],
    queryFn: async () => {
      if (!initialProduct || !initialDateRange?.from || !initialDateRange?.to) return null;

      const response = await base44.functions.invoke('Getproductevolution', {
        produtoId: initialProduct.produto_id,
        startDate: format(initialDateRange.from, 'yyyy-MM-dd'),
        endDate: format(initialDateRange.to, 'yyyy-MM-dd'),
        type: 'sales'
      });
      
      return response.data;
    },
    enabled: isOpen && !!initialProduct && !!initialDateRange?.from && !!initialDateRange?.to
  });

  // Buscar evolução do produto (PERDAS)
  const lossesEvolutionQuery = useQuery({
    queryKey: ['productEvolution', 'losses', initialProduct?.produto_id, initialDateRange],
    queryFn: async () => {
      if (!initialProduct || !initialDateRange?.from || !initialDateRange?.to) return null;

      const response = await base44.functions.invoke('Getproductevolution', {
        produtoId: initialProduct.produto_id,
        startDate: format(initialDateRange.from, 'yyyy-MM-dd'),
        endDate: format(initialDateRange.to, 'yyyy-MM-dd'),
        type: 'losses'
      });
      
      return response.data;
    },
    enabled: isOpen && !!initialProduct && !!initialDateRange?.from && !!initialDateRange?.to
  });

  // Combinar dados de vendas e perdas
  const chartData = useMemo(() => {
    const salesData = salesEvolutionQuery.data?.data?.evolution || [];
    const lossesData = lossesEvolutionQuery.data?.data?.evolution || [];

    if (salesData.length === 0) return [];

    // Criar mapa de perdas por data
    const lossesMap = new Map();
    lossesData.forEach(loss => {
      lossesMap.set(loss.data, parseFloat(loss.valor || 0));
    });

    // Combinar com vendas
    return salesData.map(salePoint => ({
      data: format(new Date(salePoint.data), 'dd/MM'),
      vendas: parseFloat(salePoint.valor || 0),
      perdas: lossesMap.get(salePoint.data) || 0
    }));
  }, [salesEvolutionQuery.data, lossesEvolutionQuery.data]);

  const isLoading = salesEvolutionQuery.isLoading || lossesEvolutionQuery.isLoading;

  const salesStats = salesEvolutionQuery.data?.data?.stats;
  const lossesStats = lossesEvolutionQuery.data?.data?.stats;

  if (!initialProduct) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {initialProduct.produto_nome}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-base">{initialProduct.setor}</Badge>
                {initialDateRange && (
                  <span className="text-sm text-slate-600">
                    {format(initialDateRange.from, 'dd/MM/yyyy')} - {format(initialDateRange.to, 'dd/MM/yyyy')}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Vendas */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-700 font-semibold uppercase mb-1">Vendas Totais</p>
                    <p className="text-3xl font-bold text-green-900">
                      R$ {((salesStats?.totalValor || 0) / 1000).toFixed(1)}k
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {(salesStats?.totalQuantidade || 0).toFixed(1)} {initialProduct.unidade}
                    </p>
                  </div>
                  <div className="bg-green-200 p-2 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-green-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card Perdas */}
            <Card className="bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-red-700 font-semibold uppercase mb-1">Perdas Totais</p>
                    <p className="text-3xl font-bold text-red-900">
                      R$ {((lossesStats?.totalValor || 0) / 1000).toFixed(1)}k
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {(lossesStats?.totalQuantidade || 0).toFixed(1)} {initialProduct.unidade}
                    </p>
                  </div>
                  <div className="bg-red-200 p-2 rounded-lg">
                    <TrendingDown className="w-8 h-8 text-red-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card Taxa de Perda */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-300">
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs text-amber-700 font-semibold uppercase mb-1">Taxa de Perda</p>
                  <p className="text-3xl font-bold text-amber-900">
                    {salesStats?.totalValor > 0 
                      ? ((lossesStats?.totalValor || 0) / salesStats.totalValor * 100).toFixed(1)
                      : '0.0'}%
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    do valor vendido
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Barras + Linha */}
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">
              Carregando evolução do produto...
            </div>
          ) : chartData.length > 0 ? (
            <Card className="shadow-lg">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Evolução de Vendas e Perdas</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="data" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                    />
                    <Legend iconType="circle" />
                    <Bar 
                      dataKey="vendas" 
                      name="Vendas" 
                      fill="url(#colorVendas)"
                      radius={[8, 8, 0, 0]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="perdas" 
                      name="Perdas" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', r: 4, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Nenhum dado disponível para o período selecionado
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
