import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
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
  // Buscar evolução do produto (vendas)
  const salesEvolutionQuery = useQuery({
    queryKey: ['productEvolution', 'sales', initialProduct?.produto_id, initialDateRange],
    queryFn: async () => {
      if (!initialProduct || !initialDateRange?.from || !initialDateRange?.to) return null;

      const response = await base44.functions.invoke('getProductEvolution', {
        produtoId: initialProduct.produto_id,
        startDate: format(initialDateRange.from, 'yyyy-MM-dd'),
        endDate: format(initialDateRange.to, 'yyyy-MM-dd'),
        type: 'sales'
      });
      
      return response.data;
    },
    enabled: isOpen && !!initialProduct && !!initialDateRange?.from && !!initialDateRange?.to
  });

  // Buscar evolução do produto (perdas)
  const lossesEvolutionQuery = useQuery({
    queryKey: ['productEvolution', 'losses', initialProduct?.produto_id, initialDateRange],
    queryFn: async () => {
      if (!initialProduct || !initialDateRange?.from || !initialDateRange?.to) return null;

      const response = await base44.functions.invoke('getProductEvolution', {
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
    const salesData = salesEvolutionQuery.data?.evolution || [];
    const lossesData = lossesEvolutionQuery.data?.evolution || [];

    if (salesData.length === 0 && lossesData.length === 0) return [];

    // Criar mapa de todas as datas únicas
    const dateMap = new Map();
    
    salesData.forEach(item => {
      const dateKey = format(new Date(item.data), 'yyyy-MM-dd');
      dateMap.set(dateKey, {
        data: format(new Date(item.data), 'dd/MM'),
        vendas: parseFloat(item.total_valor || 0),
        perdas: 0
      });
    });

    lossesData.forEach(item => {
      const dateKey = format(new Date(item.data), 'yyyy-MM-dd');
      if (dateMap.has(dateKey)) {
        dateMap.get(dateKey).perdas = parseFloat(item.total_valor || 0);
      } else {
        dateMap.set(dateKey, {
          data: format(new Date(item.data), 'dd/MM'),
          vendas: 0,
          perdas: parseFloat(item.total_valor || 0)
        });
      }
    });

    return Array.from(dateMap.values()).sort((a, b) => {
      const [dayA, monthA] = a.data.split('/');
      const [dayB, monthB] = b.data.split('/');
      return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)) - 
             new Date(2024, parseInt(monthB) - 1, parseInt(dayB));
    });
  }, [salesEvolutionQuery.data, lossesEvolutionQuery.data]);

  // Calcular totais de perdas
  const totalLosses = useMemo(() => {
    return lossesEvolutionQuery.data?.totalValue || 0;
  }, [lossesEvolutionQuery.data]);

  const totalLossesQty = useMemo(() => {
    return lossesEvolutionQuery.data?.totalQty || 0;
  }, [lossesEvolutionQuery.data]);

  const isLoading = salesEvolutionQuery.isLoading || lossesEvolutionQuery.isLoading;

  if (!initialProduct) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                {initialProduct.produto_nome}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{initialProduct.setor}</Badge>
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
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-700 font-medium">Vendas Totais</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                R$ {(parseFloat(initialProduct.total_valor) / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-green-600 mt-1">
                {parseFloat(initialProduct.total_quantidade).toFixed(1)} {initialProduct.unidade}
              </p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm text-red-700 font-medium">Perdas Totais</p>
              <p className="text-2xl font-bold text-red-900 mt-1">
                R$ {(totalLosses / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-red-600 mt-1">
                {totalLossesQty.toFixed(1)} {initialProduct.unidade}
              </p>
            </div>
          </div>

          {/* Gráfico de Barras + Linha */}
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">
              Carregando evolução do produto...
            </div>
          ) : chartData.length > 0 ? (
            <div>
              <h3 className="text-lg font-semibold mb-4">Evolução de Vendas e Perdas</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="data" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="vendas" 
                    name="Vendas" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="perdas" 
                    name="Perdas" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
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