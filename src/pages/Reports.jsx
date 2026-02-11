import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import DateRangePicker from "../components/reports/DateRangePicker";
import Sectorcards from "../components/reports/Sectorcards";
import Productranking from "../components/reports/Productranking";
import Productevolution from "../components/reports/Productevolution";
import GeneralEvolutionChart from "../components/reports/GeneralEvolutionChart";
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

  // Comparação
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareDateRange, setCompareDateRange] = useState(null);

  // Controles
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' ou 'losses'
  const [topN, setTopN] = useState(10);

  // Estados de seleção (drill-down)
  const [selectedSector, setSelectedSector] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductName, setSelectedProductName] = useState(null);

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
      compareStartDate: compareEnabled && compareDateRange?.from ? 
        format(compareDateRange.from, 'yyyy-MM-dd') : null,
      compareEndDate: compareEnabled && compareDateRange?.to ? 
        format(compareDateRange.to, 'yyyy-MM-dd') : null,
      topN
    };
  }, [dateRange, compareEnabled, compareDateRange, topN]);

  // Buscar dados de VENDAS
  const salesQuery = useQuery({
    queryKey: ['salesReport', apiParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSalesReport', apiParams);
      return response.data;
    },
    enabled: hasAccess && !!apiParams && activeTab === 'sales'
  });

  // Buscar dados de PERDAS
  const lossesQuery = useQuery({
    queryKey: ['lossesReport', apiParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getLossesReport', apiParams);
      return response.data;
    },
    enabled: hasAccess && !!apiParams && activeTab === 'losses'
  });

  // Buscar evolução do produto selecionado
  const evolutionQuery = useQuery({
    queryKey: ['productEvolution', selectedProduct, apiParams, activeTab],
    queryFn: async () => {
      const response = await base44.functions.invoke('getProductEvolution', {
        produtoId: selectedProduct,
        ...apiParams,
        type: activeTab
      });
      return response.data;
    },
    enabled: !!selectedProduct && !!apiParams
  });

  // Dados ativos baseado na aba
  const activeQuery = activeTab === 'sales' ? salesQuery : lossesQuery;
  const reportData = activeQuery.data?.data;
  const compareData = activeQuery.data?.compareData;

  // Produtos filtrados por setor selecionado
  const filteredProducts = useMemo(() => {
    if (!reportData) return [];
    
    if (!selectedSector) {
      return reportData.salesByProduct || reportData.lossesByProduct || [];
    }

    const allProducts = reportData.salesBySectorProduct || reportData.lossesBySectorProduct || [];
    return allProducts
      .filter(p => p.setor === selectedSector)
      .slice(0, topN);
  }, [reportData, selectedSector, topN, activeTab]);

  // Handlers
  const handleSectorClick = (sector) => {
    setSelectedSector(sector === selectedSector ? null : sector);
    setSelectedProduct(null);
    setSelectedProductName(null);
  };

  const handleProductClick = (produtoId, produtoNome) => {
    console.log('🖱️ Clicou no produto:', { produtoId, produtoNome });
    console.log('📋 Produtos disponíveis:', filteredProducts);
    
    // Buscar dados completos do produto
    const productData = filteredProducts.find(p => p.produto_id === produtoId);
    
    console.log('📦 Produto encontrado:', productData);
    
    if (productData) {
      setComparisonInitialProduct(productData);
      setComparisonModalOpen(true);
    } else {
      console.error('❌ Produto não encontrado no filteredProducts!');
      toast.error('Erro ao abrir comparação');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedSector(null);
    setSelectedProduct(null);
    setSelectedProductName(null);
  };

  // Exportar Excel
  const handleExportExcel = () => {
    if (!reportData) return;

    try {
      const products = reportData.salesByProduct || reportData.lossesByProduct || [];
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

      XLSX.utils.book_append_sheet(wb, ws, activeTab === 'sales' ? 'Vendas' : 'Perdas');

      const fileName = `Relatorio_${activeTab}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios Interativos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Análise detalhada com drill-down por setor e produto
          </p>
        </div>
        <Button onClick={handleExportExcel} disabled={!reportData}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
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

            {/* Comparação */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="compare"
                  checked={compareEnabled}
                  onCheckedChange={setCompareEnabled}
                />
                <Label htmlFor="compare">Comparar com outro período</Label>
              </div>
              {compareEnabled && (
                <DateRangePicker 
                  value={compareDateRange}
                  onChange={setCompareDateRange}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Vendas vs Perdas */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Vendas
          </TabsTrigger>
          <TabsTrigger value="losses" className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Perdas
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo */}
        <TabsContent value={activeTab} className="space-y-6 mt-6">
          {activeQuery.isLoading ? (
            <div className="text-center py-12 text-slate-500">
              Carregando dados...
            </div>
          ) : reportData ? (
            <>
              {/* NÍVEL 1: Cards de Setores */}
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  {activeTab === 'sales' ? 'Vendas' : 'Perdas'} por Setor
                  {selectedSector && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      (Clique novamente no setor para ver todos os produtos)
                    </span>
                  )}
                </h3>

                {/* TOTAL GERAL */}
                <Card className="mb-6 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-700 font-medium mb-1">
                          {activeTab === 'sales' ? 'FATURAMENTO TOTAL' : 'PERDAS TOTAIS'}
                        </p>
                        <p className="text-4xl font-bold text-blue-900">
                          R$ {(reportData.totalGeral / 1000).toFixed(1)}k
                        </p>
                        <p className="text-sm text-blue-600 mt-1">
                          {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                        </p>
                      </div>
                      {compareData && (() => {
                        const change = ((reportData.totalGeral - compareData.totalGeral) / compareData.totalGeral) * 100;
                        return (
                          <div className={`flex items-center gap-2 text-2xl font-bold ${
                            change > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {change > 0 ? <TrendingUp className="w-8 h-8" /> : <TrendingDown className="w-8 h-8" />}
                            {Math.abs(change).toFixed(1)}%
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>

                <Sectorcards
                  sectors={activeTab === 'sales' ? 
                    reportData.salesBySector : 
                    reportData.lossesBySector
                  }
                  compareSectors={compareData ? (
                    activeTab === 'sales' ? 
                      compareData.salesBySector : 
                      compareData.lossesBySector
                  ) : null}
                  selectedSector={selectedSector}
                  onSectorClick={handleSectorClick}
                  totalGeral={reportData.totalGeral}
                />
              </div>

              {/* GRÁFICOS GERAIS (antes de selecionar setor) */}
              {!selectedSector && reportData.rawData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Gráfico de Linha - Evolução Geral */}
                  <GeneralEvolutionChart
                    rawData={reportData.rawData}
                    compareRawData={compareData?.rawData}
                    dateRange={dateRange}
                    compareDateRange={compareDateRange}
                    type={activeTab}
                  />

                  {/* Gráfico de Pizza - Distribuição por Setor */}
                  <SectorDistributionChart
                    sectors={activeTab === 'sales' ? 
                      reportData.salesBySector : 
                      reportData.lossesBySector
                    }
                    type={activeTab}
                  />
                </div>
              )}

              {/* GRÁFICOS DO SETOR (quando setor está selecionado) */}
              {selectedSector && reportData.rawData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Gráfico de Linha - Evolução do Setor */}
                  <SectorEvolutionChart
                    rawData={reportData.rawData}
                    sector={selectedSector}
                    type={activeTab}
                  />

                  {/* Gráfico de Pizza - Top 5 Produtos + Outros */}
                  <ProductsPieChart
                    products={activeTab === 'sales' ? 
                      reportData.salesBySectorProduct : 
                      reportData.lossesBySectorProduct
                    }
                    sector={selectedSector}
                    type={activeTab}
                    topN={5}
                  />
                </div>
              )}

              {/* NÍVEL 2: Ranking de Produtos */}
              {filteredProducts.length > 0 && (
                <Productranking
                  products={filteredProducts}
                  selectedSector={selectedSector}
                  selectedProduct={selectedProduct}
                  onProductClick={handleProductClick}
                  type={activeTab}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Selecione um período para visualizar os dados
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Comparação de Produtos */}
      {reportData && (
        <ProductComparisonModal
          isOpen={comparisonModalOpen}
          onClose={() => setComparisonModalOpen(false)}
          initialProduct={comparisonInitialProduct}
          initialDateRange={dateRange}
          allProducts={activeTab === 'sales' ? 
            (reportData.salesBySectorProduct || []) : 
            (reportData.lossesBySectorProduct || [])
          }
          type={activeTab}
        />
      )}
    </div>
  );
}