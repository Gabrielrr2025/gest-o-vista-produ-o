import React, { useState, useMemo } from 'react';
import { useQueries } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  X, 
  FileSpreadsheet,
  BarChart3,
  Package,
  AlertTriangle
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import DateRangePicker from "./DateRangePicker";

export default function SalesComparison() {
  // Estado para períodos
  const [periods, setPeriods] = useState([
    {
      id: 1,
      label: 'Período 1',
      dateRange: {
        from: startOfMonth(subMonths(new Date(), 2)),
        to: endOfMonth(subMonths(new Date(), 2))
      },
      salesColor: '#3b82f6', // blue
      lossesColor: '#ef4444' // red
    },
    {
      id: 2,
      label: 'Período 2',
      dateRange: {
        from: startOfMonth(subMonths(new Date(), 1)),
        to: endOfMonth(subMonths(new Date(), 1))
      },
      salesColor: '#10b981', // green
      lossesColor: '#f59e0b' // orange
    }
  ]);

  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'sectors', 'products'

  // Cores disponíveis para períodos adicionais
  const colorPairs = [
    { sales: '#3b82f6', losses: '#ef4444' }, // blue/red
    { sales: '#10b981', losses: '#f59e0b' }, // green/orange
    { sales: '#8b5cf6', losses: '#ec4899' }, // purple/pink
    { sales: '#06b6d4', losses: '#f97316' }, // cyan/orange
    { sales: '#14b8a6', losses: '#dc2626' }, // teal/red
    { sales: '#6366f1', losses: '#ea580c' }  // indigo/orange
  ];

  // Buscar dados de VENDAS para cada período
  const salesQueries = useQueries({
    queries: periods.map((period) => ({
      queryKey: ['salesComparison', 'sales', period.id, period.dateRange],
      queryFn: async () => {
        const response = await base44.functions.invoke('getSalesReport', {
          startDate: format(period.dateRange.from, 'yyyy-MM-dd'),
          endDate: format(period.dateRange.to, 'yyyy-MM-dd'),
          topN: 100
        });
        return {
          ...response.data,
          periodId: period.id,
          periodLabel: period.label,
          type: 'sales'
        };
      },
      enabled: !!period.dateRange?.from && !!period.dateRange?.to
    }))
  });

  // Buscar dados de PERDAS para cada período
  const lossesQueries = useQueries({
    queries: periods.map((period) => ({
      queryKey: ['salesComparison', 'losses', period.id, period.dateRange],
      queryFn: async () => {
        const response = await base44.functions.invoke('getLossesReport', {
          startDate: format(period.dateRange.from, 'yyyy-MM-dd'),
          endDate: format(period.dateRange.to, 'yyyy-MM-dd'),
          topN: 100
        });
        return {
          ...response.data,
          periodId: period.id,
          periodLabel: period.label,
          type: 'losses'
        };
      },
      enabled: !!period.dateRange?.from && !!period.dateRange?.to
    }))
  });

  // Processar dados para comparação
  const comparisonData = useMemo(() => {
    const salesData = salesQueries.filter(q => q.data).map(q => q.data);
    const lossesData = lossesQueries.filter(q => q.data).map(q => q.data);

    if (salesData.length === 0 || lossesData.length === 0) return null;

    // 1. TOTAIS POR PERÍODO (Vendas + Perdas)
    const totals = periods.map((period) => {
      const sales = salesData.find(d => d.periodId === period.id);
      const losses = lossesData.find(d => d.periodId === period.id);

      return {
        period: period.label,
        periodId: period.id,
        salesColor: period.salesColor,
        lossesColor: period.lossesColor,
        salesTotal: sales?.data.totalGeral || 0,
        lossesTotal: losses?.data.totalGeral || 0,
        lossPercentage: sales?.data.totalGeral 
          ? ((losses?.data.totalGeral || 0) / sales.data.totalGeral * 100).toFixed(1)
          : 0
      };
    });

    // 2. COMPARAÇÃO DE SETORES (Vendas + Perdas)
    const allSectors = [...new Set([
      ...salesData.flatMap(d => (d.data.salesBySector || []).map(s => s.setor)),
      ...lossesData.flatMap(d => (d.data.lossesBySector || []).map(s => s.setor))
    ])];

    const sectorComparison = allSectors.map(sector => {
      const sectorData = { sector };
      
      periods.forEach(period => {
        const sales = salesData.find(d => d.periodId === period.id);
        const losses = lossesData.find(d => d.periodId === period.id);
        
        const salesSector = (sales?.data.salesBySector || []).find(s => s.setor === sector);
        const lossesSector = (losses?.data.lossesBySector || []).find(s => s.setor === sector);
        
        sectorData[`period_${period.id}_sales`] = salesSector ? parseFloat(salesSector.total_valor) : 0;
        sectorData[`period_${period.id}_losses`] = lossesSector ? parseFloat(lossesSector.total_valor) : 0;
      });

      return sectorData;
    }).sort((a, b) => {
      const sumA = Object.keys(a).filter(k => k.includes('_sales')).reduce((s, k) => s + a[k], 0);
      const sumB = Object.keys(b).filter(k => k.includes('_sales')).reduce((s, k) => s + b[k], 0);
      return sumB - sumA;
    });

    // 3. TOP PRODUTOS (Vendas + Perdas)
    const allTopProducts = new Map();
    
    salesData.forEach(data => {
      const products = data.data.salesByProduct || [];
      products.slice(0, 15).forEach(p => {
        if (!allTopProducts.has(p.produto_id)) {
          allTopProducts.set(p.produto_id, {
            produto_id: p.produto_id,
            produto_nome: p.produto_nome,
            setor: p.setor
          });
        }
      });
    });

    const productComparison = Array.from(allTopProducts.values()).map(product => {
      const productData = { ...product };
      
      periods.forEach(period => {
        const sales = salesData.find(d => d.periodId === period.id);
        const losses = lossesData.find(d => d.periodId === period.id);
        
        const salesProd = (sales?.data.salesByProduct || []).find(p => p.produto_id === product.produto_id);
        const lossesProd = (losses?.data.lossesByProduct || []).find(p => p.produto_id === product.produto_id);
        
        productData[`period_${period.id}_sales`] = salesProd ? parseFloat(salesProd.total_valor) : 0;
        productData[`period_${period.id}_losses`] = lossesProd ? parseFloat(lossesProd.total_valor) : 0;
      });

      return productData;
    }).sort((a, b) => {
      const sumA = Object.keys(a).filter(k => k.includes('_sales')).reduce((s, k) => s + a[k], 0);
      const sumB = Object.keys(b).filter(k => k.includes('_sales')).reduce((s, k) => s + b[k], 0);
      return sumB - sumA;
    });

    return {
      totals,
      sectorComparison,
      productComparison,
      periods: periods.length
    };
  }, [salesQueries, lossesQueries, periods]);

  // Handlers
  const handleAddPeriod = () => {
    if (periods.length >= 6) {
      toast.error('Máximo de 6 períodos atingido');
      return;
    }

    const colorPair = colorPairs[periods.length % colorPairs.length];
    const newPeriod = {
      id: Math.max(...periods.map(p => p.id)) + 1,
      label: `Período ${periods.length + 1}`,
      dateRange: {
        from: startOfMonth(subMonths(new Date(), periods.length + 1)),
        to: endOfMonth(subMonths(new Date(), periods.length + 1))
      },
      salesColor: colorPair.sales,
      lossesColor: colorPair.losses
    };

    setPeriods([...periods, newPeriod]);
  };

  const handleRemovePeriod = (id) => {
    if (periods.length <= 2) {
      toast.error('Mínimo de 2 períodos necessários');
      return;
    }
    setPeriods(periods.filter(p => p.id !== id));
  };

  const handleUpdatePeriod = (id, field, value) => {
    setPeriods(periods.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Exportar para Excel
  const handleExportExcel = () => {
    if (!comparisonData) return;

    try {
      const wb = XLSX.utils.book_new();

      // Aba 1: Resumo de Totais
      const totalsSheet = comparisonData.totals.map(t => ({
        'Período': t.period,
        'Vendas Total': t.salesTotal.toFixed(2),
        'Perdas Total': t.lossesTotal.toFixed(2),
        '% Perda': t.lossPercentage + '%'
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totalsSheet), 'Totais');

      // Aba 2: Comparação por Setor
      const sectorsSheet = comparisonData.sectorComparison.map(s => {
        const row = { 'Setor': s.sector };
        periods.forEach(p => {
          row[`${p.label} - Vendas`] = (s[`period_${p.id}_sales`] || 0).toFixed(2);
          row[`${p.label} - Perdas`] = (s[`period_${p.id}_losses`] || 0).toFixed(2);
        });
        return row;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sectorsSheet), 'Setores');

      // Aba 3: Comparação de Produtos
      const productsSheet = comparisonData.productComparison.map(p => {
        const row = { 
          'Produto': p.produto_nome,
          'Setor': p.setor
        };
        periods.forEach(period => {
          row[`${period.label} - Vendas`] = (p[`period_${period.id}_sales`] || 0).toFixed(2);
          row[`${period.label} - Perdas`] = (p[`period_${period.id}_losses`] || 0).toFixed(2);
        });
        return row;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productsSheet), 'Produtos');

      const fileName = `Comparacao_Vendas_Perdas_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Excel exportado com sucesso!");
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error("Erro ao exportar Excel");
    }
  };

  const isLoading = salesQueries.some(q => q.isLoading) || lossesQueries.some(q => q.isLoading);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Comparação de Períodos</h2>
          <p className="text-sm text-slate-600">Compare vendas e perdas entre diferentes períodos</p>
        </div>
        {comparisonData && (
          <Button onClick={handleExportExcel} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        )}
      </div>

      {/* Configuração de Períodos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Períodos para Comparação</CardTitle>
            <Button onClick={handleAddPeriod} size="sm" variant="outline" disabled={periods.length >= 6}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Período
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {periods.map((period, index) => (
              <Card key={period.id} className="border-2 border-slate-200">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* Header do período */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: period.salesColor }}
                            title="Vendas"
                          />
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: period.lossesColor }}
                            title="Perdas"
                          />
                        </div>
                        <input
                          type="text"
                          value={period.label}
                          onChange={(e) => handleUpdatePeriod(period.id, 'label', e.target.value)}
                          className="font-semibold text-sm bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                        />
                      </div>
                      {periods.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemovePeriod(period.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Date Picker */}
                    <DateRangePicker
                      value={period.dateRange}
                      onChange={(newRange) => handleUpdatePeriod(period.id, 'dateRange', newRange)}
                    />

                    {/* Resumo do período */}
                    {salesQueries[index]?.data && lossesQueries[index]?.data && (
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Vendas</span>
                          <span className="font-bold" style={{ color: period.salesColor }}>
                            R$ {(salesQueries[index].data.data.totalGeral / 1000).toFixed(1)}k
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Perdas</span>
                          <span className="font-bold" style={{ color: period.lossesColor }}>
                            R$ {(lossesQueries[index].data.data.totalGeral / 1000).toFixed(1)}k
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            Carregando dados dos períodos...
          </CardContent>
        </Card>
      ) : comparisonData ? (
        <>
          {/* Cards de Totais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {comparisonData.totals.map((total) => (
              <Card key={total.periodId} className="border-2 border-slate-200">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-600">{total.period}</p>
                    
                    {/* Vendas */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" style={{ color: total.salesColor }} />
                        <span className="text-xs text-slate-600">Vendas</span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: total.salesColor }}>
                        R$ {(total.salesTotal / 1000).toFixed(1)}k
                      </p>
                    </div>

                    {/* Perdas */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" style={{ color: total.lossesColor }} />
                        <span className="text-xs text-slate-600">Perdas</span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: total.lossesColor }}>
                        R$ {(total.lossesTotal / 1000).toFixed(1)}k
                      </p>
                    </div>

                    {/* Percentual de Perda */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{total.lossPercentage}% de perda</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs de Visualização */}
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart3 className="w-4 h-4 mr-2" />
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="sectors">
                <Package className="w-4 h-4 mr-2" />
                Por Setor
              </TabsTrigger>
              <TabsTrigger value="products">
                <TrendingUp className="w-4 h-4 mr-2" />
                Por Produto
              </TabsTrigger>
            </TabsList>

            {/* TAB: VISÃO GERAL */}
            <TabsContent value="overview" className="space-y-6">
              {/* Gráfico Comparativo - Vendas vs Perdas por Período */}
              <Card>
                <CardHeader>
                  <CardTitle>Vendas vs Perdas por Período</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={comparisonData.totals}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      <Bar dataKey="salesTotal" name="Vendas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="lossesTotal" name="Perdas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Linha - Tendência */}
              <Card>
                <CardHeader>
                  <CardTitle>Tendência de Vendas e Perdas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={comparisonData.totals}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="salesTotal" 
                        name="Vendas" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="lossesTotal" 
                        name="Perdas" 
                        stroke="#ef4444" 
                        strokeWidth={3}
                        dot={{ fill: '#ef4444', r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: POR SETOR */}
            <TabsContent value="sectors" className="space-y-6">
              {/* Gráfico de Barras - Setores */}
              <Card>
                <CardHeader>
                  <CardTitle>Vendas e Perdas por Setor</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart data={comparisonData.sectorComparison.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="sector" angle={-45} textAnchor="end" height={100} />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      {periods.map(period => (
                        <React.Fragment key={period.id}>
                          <Bar 
                            dataKey={`period_${period.id}_sales`}
                            name={`${period.label} - Vendas`}
                            fill={period.salesColor}
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar 
                            dataKey={`period_${period.id}_losses`}
                            name={`${period.label} - Perdas`}
                            fill={period.lossesColor}
                            radius={[4, 4, 0, 0]}
                          />
                        </React.Fragment>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tabela de Setores */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento por Setor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">Setor</th>
                          {periods.map(period => (
                            <React.Fragment key={period.id}>
                              <th className="text-right py-3 px-4 font-semibold">
                                <div className="flex items-center justify-end gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: period.salesColor }}
                                  />
                                  {period.label} (V)
                                </div>
                              </th>
                              <th className="text-right py-3 px-4 font-semibold">
                                <div className="flex items-center justify-end gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: period.lossesColor }}
                                  />
                                  {period.label} (P)
                                </div>
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.sectorComparison.map((sector, idx) => (
                          <tr key={idx} className="border-b hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium">{sector.sector}</td>
                            {periods.map(period => (
                              <React.Fragment key={period.id}>
                                <td className="text-right py-3 px-4">
                                  R$ {(sector[`period_${period.id}_sales`] || 0).toLocaleString('pt-BR', { 
                                    minimumFractionDigits: 2 
                                  })}
                                </td>
                                <td className="text-right py-3 px-4 text-red-600">
                                  R$ {(sector[`period_${period.id}_losses`] || 0).toLocaleString('pt-BR', { 
                                    minimumFractionDigits: 2 
                                  })}
                                </td>
                              </React.Fragment>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: POR PRODUTO */}
            <TabsContent value="products" className="space-y-6">
              {/* Gráfico de Barras Horizontal - Top Produtos */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Produtos - Vendas e Perdas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart 
                      data={comparisonData.productComparison.slice(0, 10)}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number"
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="produto_nome" 
                        width={180}
                      />
                      <Tooltip 
                        formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      {periods.map(period => (
                        <React.Fragment key={period.id}>
                          <Bar 
                            dataKey={`period_${period.id}_sales`}
                            name={`${period.label} - Vendas`}
                            fill={period.salesColor}
                          />
                          <Bar 
                            dataKey={`period_${period.id}_losses`}
                            name={`${period.label} - Perdas`}
                            fill={period.lossesColor}
                          />
                        </React.Fragment>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tabela de Produtos */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento de Produtos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">Produto</th>
                          <th className="text-left py-3 px-4 font-semibold">Setor</th>
                          {periods.map(period => (
                            <React.Fragment key={period.id}>
                              <th className="text-right py-3 px-4 font-semibold">
                                <div className="flex items-center justify-end gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: period.salesColor }}
                                  />
                                  {period.label} (V)
                                </div>
                              </th>
                              <th className="text-right py-3 px-4 font-semibold">
                                <div className="flex items-center justify-end gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: period.lossesColor }}
                                  />
                                  {period.label} (P)
                                </div>
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.productComparison.slice(0, 20).map((product, idx) => (
                          <tr key={idx} className="border-b hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium">{product.produto_nome}</td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">{product.setor}</Badge>
                            </td>
                            {periods.map(period => (
                              <React.Fragment key={period.id}>
                                <td className="text-right py-3 px-4">
                                  R$ {(product[`period_${period.id}_sales`] || 0).toLocaleString('pt-BR', { 
                                    minimumFractionDigits: 2 
                                  })}
                                </td>
                                <td className="text-right py-3 px-4 text-red-600">
                                  R$ {(product[`period_${period.id}_losses`] || 0).toLocaleString('pt-BR', { 
                                    minimumFractionDigits: 2 
                                  })}
                                </td>
                              </React.Fragment>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            Configure os períodos acima para visualizar a comparação
          </CardContent>
        </Card>
      )}
    </div>
  );
}
