import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";
import { format, subYears, startOfYear, endOfYear, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
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
import DateRangePicker from "../components/reports/DateRangePicker";
import Sectorcards from "../components/reports/Sectorcards";
import Productranking from "../components/reports/Productranking";
import SectorDistributionChart from "../components/reports/SectorDistributionChart";
import SectorEvolutionChart from "../components/reports/SectorEvolutionChart";
import ProductsPieChart from "../components/reports/ProductsPieChart";
import ProductComparisonModal from "../components/reports/ProductComparisonModal";

export default function Reports() {
  const [hasAccess, setHasAccess] = useState(false);
  
  // Período principal - PADRÃO: Mês passado
  const [dateRange, setDateRange] = useState(() => {
    const lastMonth = subMonths(new Date(), 1);
    return {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth)
    };
  });

  // Comparação ano anterior
  const [compareYearEnabled, setCompareYearEnabled] = useState(true);

  // Controles
  const [topN, setTopN] = useState(10);

  // Estados de seleção (drill-down)
  const [selectedSector, setSelectedSector] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Modal de comparação
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [comparisonInitialProduct, setComparisonInitialProduct] = useState(null);

  // Verificar acesso
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        if (user.role === 'admin' || user.reports_access === true) {
          setHasAccess(true);
        } else {
          toast.error("Você não tem permissão para acessar relatórios");
          setTimeout(() => window.location.href = '/', 2000);
        }
      } catch (error) {
        window.location.href = '/';
      }
    };
    checkAuth();
  }, []);

  // Preparar parâmetros para API
  const apiParams = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;

    return {
      startDate: format(dateRange.from, 'yyyy-MM-dd'),
      endDate: format(dateRange.to, 'yyyy-MM-dd'),
      topN
    };
  }, [dateRange, topN]);

  // Parâmetros do ano anterior (para comparação)
  const lastYearParams = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !compareYearEnabled) return null;

    const lastYearFrom = subYears(dateRange.from, 1);
    const lastYearTo = subYears(dateRange.to, 1);

    return {
      startDate: format(lastYearFrom, 'yyyy-MM-dd'),
      endDate: format(lastYearTo, 'yyyy-MM-dd'),
      topN
    };
  }, [dateRange, topN, compareYearEnabled]);

  // Buscar dados de VENDAS
  const salesQuery = useQuery({
    queryKey: ['salesReport', apiParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSalesReport', apiParams);
      return response.data;
    },
    enabled: hasAccess && !!apiParams
  });

  // Buscar dados de PERDAS
  const lossesQuery = useQuery({
    queryKey: ['lossesReport', apiParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getLossesReport', apiParams);
      return response.data;
    },
    enabled: hasAccess && !!apiParams
  });

  // Buscar dados do ano anterior (para comparação)
  const lastYearSalesQuery = useQuery({
    queryKey: ['salesReportLastYear', lastYearParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSalesReport', lastYearParams);
      return response.data;
    },
    enabled: hasAccess && !!lastYearParams && compareYearEnabled
  });

  const salesData = salesQuery.data?.data;
  const lossesData = lossesQuery.data?.data;
  const lastYearSalesData = lastYearSalesQuery.data?.data;

  // Calcular % de crescimento vs ano anterior
  const yearOverYearGrowth = useMemo(() => {
    if (!salesData || !lastYearSalesData) return null;
    const current = salesData.totalGeral;
    const previous = lastYearSalesData.totalGeral;
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }, [salesData, lastYearSalesData]);

  // Calcular taxa média de perda
  const averageLossRate = useMemo(() => {
    if (!salesData || !lossesData) return null;
    if (salesData.totalGeral === 0) return 0;
    return (lossesData.totalGeral / salesData.totalGeral) * 100;
  }, [salesData, lossesData]);

  // Processar dados para o gráfico mensal (ano completo)
  const monthlyChartData = useMemo(() => {
    if (!salesData?.rawData || !lossesData?.rawData) return [];

    // Agrupar por mês
    const monthlyData = new Map();

    salesData.rawData.forEach(row => {
      const month = format(new Date(row.data), 'MMM');
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { month, sales: 0, losses: 0 });
      }
      monthlyData.get(month).sales += parseFloat(row.total_valor || 0);
    });

    lossesData.rawData.forEach(row => {
      const month = format(new Date(row.data), 'MMM');
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { month, sales: 0, losses: 0 });
      }
      monthlyData.get(month).losses += parseFloat(row.total_valor || 0);
    });

    // Calcular % de perda
    const result = Array.from(monthlyData.values()).map(item => ({
      ...item,
      lossRate: item.sales > 0 ? (item.losses / item.sales) * 100 : 0
    }));

    return result;
  }, [salesData, lossesData]);

  // Combinar dados de setores (vendas + perdas)
  const sectorsWithLosses = useMemo(() => {
    if (!salesData?.salesBySector || !lossesData?.lossesBySector) return [];

    return salesData.salesBySector.map(sector => {
      const lossSector = lossesData.lossesBySector.find(l => l.setor === sector.setor);
      return {
        ...sector,
        total_losses: lossSector ? parseFloat(lossSector.total_valor) : 0
      };
    });
  }, [salesData, lossesData]);

  // Produtos filtrados por setor selecionado
  const filteredProducts = useMemo(() => {
    if (!salesData) return [];
    
    if (!selectedSector) {
      return salesData.salesByProduct || [];
    }

    const allProducts = salesData.salesBySectorProduct || [];
    return allProducts
      .filter(p => p.setor === selectedSector)
      .slice(0, topN);
  }, [salesData, selectedSector, topN]);

  // Handlers
  const handleSectorClick = (sector) => {
    setSelectedSector(sector === selectedSector ? null : sector);
    setSelectedProduct(null);
  };

  const handleProductClick = (produtoId, produtoNome) => {
    const productData = filteredProducts.find(p => p.produto_id === produtoId);
    
    if (productData) {
      setComparisonInitialProduct(productData);
      setComparisonModalOpen(true);
    } else {
      toast.error('Erro ao abrir comparação');
    }
  };

  // Exportar Excel
  const handleExportExcel = () => {
    if (!salesData) return;

    try {
      const products = salesData.salesByProduct || [];
      const excelData = products.map((p, idx) => ({
        'Ranking': idx + 1,
        'Produto': p.produto_nome,
        'Setor': p.setor,
        'Valor (R$)': parseFloat(p.total_valor).toFixed(2),
        'Quantidade': parseFloat(p.total_quantidade).toFixed(2),
        'Unidade': p.unidade
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      XLSX.utils.book_append_sheet(wb, ws, 'Vendas');

      const fileName = `Relatorio_Vendas_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Excel exportado!");
    } catch (error) {
      toast.error("Erro ao exportar Excel");
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">Verificando permissões...</p>
      </div>
    );
  }

  const isLoading = salesQuery.isLoading || lossesQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios de Vendas</h1>
          <p className="text-slate-600">Análise integrada de vendas e perdas</p>
        </div>
        {salesData && (
          <Button onClick={handleExportExcel} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        )}
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Período Principal */}
            <div className="space-y-2">
              <Label>Período de Análise</Label>
              <DateRangePicker 
                value={dateRange}
                onChange={setDateRange}
              />
            </div>

            {/* Top N */}
            <div className="space-y-2">
              <Label>Produtos a Exibir</Label>
              <Select value={topN.toString()} onValueChange={(v) => setTopN(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="30">Top 30</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                  <SelectItem value="100">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Comparação Ano Anterior */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="compareYear"
                  checked={compareYearEnabled}
                  onCheckedChange={setCompareYearEnabled}
                />
                <Label htmlFor="compareYear">Comparar com ano anterior</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">
          Carregando dados...
        </div>
      ) : salesData && lossesData ? (
        <>
          {/* GRÁFICO MENSAL - FATURAMENTO VS PERDAS */}
          {monthlyChartData.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Faturamento Mensal vs Perdas</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Ano {format(dateRange.from, 'yyyy')} - Clique para detalhar
                </p>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis 
                      yAxisId="left"
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                      domain={[0, 20]}
                    />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'lossRate') return `${value.toFixed(1)}%`;
                        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                      }}
                      labelFormatter={(label) => `Mês: ${label}`}
                    />
                    <Legend />
                    <Bar 
                      yAxisId="left"
                      dataKey="sales" 
                      name="Faturamento" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="losses" 
                      name="Perdas" 
                      fill="#ef4444" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="lossRate" 
                      name="% Perda" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* CARDS DE RESUMO - FATURAMENTO E PERDAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card Faturamento Total */}
            <Card className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 font-medium mb-1">
                      FATURAMENTO TOTAL
                    </p>
                    <p className="text-4xl font-bold text-green-900">
                      R$ {(salesData.totalGeral / 1000).toFixed(1)}k
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                    </p>
                    {/* Variação vs Ano Anterior */}
                    {yearOverYearGrowth !== null && (
                      <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
                        yearOverYearGrowth > 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {yearOverYearGrowth > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>
                          {yearOverYearGrowth > 0 ? '+' : ''}
                          {yearOverYearGrowth.toFixed(1)}% vs ano anterior
                        </span>
                      </div>
                    )}
                  </div>
                  <TrendingUp className="w-12 h-12 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            {/* Card Perdas Total */}
            <Card className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-700 font-medium mb-1">
                      PERDAS TOTAIS
                    </p>
                    <p className="text-4xl font-bold text-red-900">
                      R$ {(lossesData.totalGeral / 1000).toFixed(1)}k
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                    </p>
                    {/* Taxa Média de Perda */}
                    {averageLossRate !== null && (
                      <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-red-700">
                        <span>Taxa média: {averageLossRate.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  <TrendingDown className="w-12 h-12 text-red-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CARDS DE SETORES COM PERDAS */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Vendas por Setor
              {selectedSector && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  (Clique novamente no setor para ver todos os produtos)
                </span>
              )}
            </h3>

            <Sectorcards
              sectors={sectorsWithLosses}
              compareSectors={null}
              selectedSector={selectedSector}
              onSectorClick={handleSectorClick}
              totalGeral={salesData.totalGeral}
              showLosses={true}
            />
          </div>

          {/* GRÁFICOS GERAIS (antes de selecionar setor) */}
          {!selectedSector && salesData.rawData && lossesData.rawData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Linha - Evolução com Perdas */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Evolução Diária</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart
                      data={salesData.rawData.map((sRow, idx) => {
                        const lRow = lossesData.rawData[idx];
                        return {
                          data: format(new Date(sRow.data), 'dd/MM'),
                          vendas: parseFloat(sRow.total_valor || 0),
                          perdas: lRow ? parseFloat(lRow.total_valor || 0) : 0
                        };
                      })}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" />
                      <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="vendas" 
                        name="Vendas" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="perdas" 
                        name="Perdas" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Pizza - Distribuição por Setor */}
              <SectorDistributionChart
                sectors={salesData.salesBySector}
                type="sales"
              />
            </div>
          )}

          {/* GRÁFICOS DO SETOR (quando setor está selecionado) */}
          {selectedSector && salesData.rawData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Linha - Evolução do Setor */}
              <SectorEvolutionChart
                rawData={salesData.rawData}
                sector={selectedSector}
                type="sales"
              />

              {/* Gráfico de Pizza - Top 5 Produtos + Outros */}
              <ProductsPieChart
                products={salesData.salesBySectorProduct}
                sector={selectedSector}
                type="sales"
                topN={5}
              />
            </div>
          )}

          {/* RANKING DE PRODUTOS */}
          {filteredProducts.length > 0 && (
            <Productranking
              products={filteredProducts}
              selectedSector={selectedSector}
              selectedProduct={selectedProduct}
              onProductClick={handleProductClick}
              type="sales"
            />
          )}
        </>
      ) : (
        <div className="text-center py-12 text-slate-500">
          Selecione um período para visualizar os dados
        </div>
      )}

      {/* Modal de Comparação de Produtos */}
      {salesData && (
        <ProductComparisonModal
          isOpen={comparisonModalOpen}
          onClose={() => setComparisonModalOpen(false)}
          initialProduct={comparisonInitialProduct}
          initialDateRange={dateRange}
          allProducts={salesData.salesBySectorProduct || []}
          type="sales"
        />
      )}
    </div>
  );
}
