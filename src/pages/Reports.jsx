import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileSpreadsheet, TrendingUp, TrendingDown, AlertCircle, AlertTriangle } from "lucide-react";
import { format, subYears, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, getHours, getDay, getWeek } from "date-fns";
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
  
  // Período principal - PADRÃO: Janeiro 2026 (onde tem dados)
  const [dateRange, setDateRange] = useState(() => {
    return {
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 31)
    };
  });

  // Ano selecionado para o gráfico anual
  const [selectedYear, setSelectedYear] = useState(2026);

  // Comparação de anos
  const [compareYearsEnabled, setCompareYearsEnabled] = useState(false);
  const [compareYear, setCompareYear] = useState(2025);

  // Controles
  const [topN, setTopN] = useState(10);

  // Filtros de tempo
  const [timeFilter, setTimeFilter] = useState('day');

  // Estados de seleção
  const [selectedSector, setSelectedSector] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Modal
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

  // Parâmetros API
  const apiParams = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    return {
      startDate: format(dateRange.from, 'yyyy-MM-dd'),
      endDate: format(dateRange.to, 'yyyy-MM-dd'),
      topN
    };
  }, [dateRange, topN]);

  const lastYearParams = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    const lastYearFrom = subYears(dateRange.from, 1);
    const lastYearTo = subYears(dateRange.to, 1);
    return {
      startDate: format(lastYearFrom, 'yyyy-MM-dd'),
      endDate: format(lastYearTo, 'yyyy-MM-dd'),
      topN
    };
  }, [dateRange, topN]);

  const yearParams = useMemo(() => {
    return {
      startDate: format(startOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'),
      endDate: format(endOfYear(new Date(selectedYear, 11, 31)), 'yyyy-MM-dd'),
      topN: 100
    };
  }, [selectedYear]);

  // Parâmetros para ano de comparação
  const compareYearParams = useMemo(() => {
    if (!compareYearsEnabled) return null;
    return {
      startDate: format(startOfYear(new Date(compareYear, 0, 1)), 'yyyy-MM-dd'),
      endDate: format(endOfYear(new Date(compareYear, 11, 31)), 'yyyy-MM-dd'),
      topN: 100
    };
  }, [compareYear, compareYearsEnabled]);

  // QUERIES
  const salesQuery = useQuery({
    queryKey: ['salesReport', apiParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSalesReport', apiParams);
      return response.data;
    },
    enabled: hasAccess && !!apiParams
  });

  const lossesQuery = useQuery({
    queryKey: ['lossesReport', apiParams],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('Getlossesreport', apiParams);
        return response.data;
      } catch (error) {
        return {
          data: { lossesBySector: [], lossesByProduct: [], lossesBySectorProduct: [], rawData: [], totalGeral: 0 }
        };
      }
    },
    enabled: hasAccess && !!apiParams,
    retry: false
  });

  const lastYearSalesQuery = useQuery({
    queryKey: ['salesReportLastYear', lastYearParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSalesReport', lastYearParams);
      return response.data;
    },
    enabled: hasAccess && !!lastYearParams
  });

  const yearSalesQuery = useQuery({
    queryKey: ['salesReportYear', yearParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSalesReport', yearParams);
      return response.data;
    },
    enabled: hasAccess && !!yearParams
  });

  const yearLossesQuery = useQuery({
    queryKey: ['lossesReportYear', yearParams],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('Getlossesreport', yearParams);
        return response.data;
      } catch (error) {
        return {
          data: { lossesBySector: [], lossesByProduct: [], lossesBySectorProduct: [], rawData: [], totalGeral: 0 }
        };
      }
    },
    enabled: hasAccess && !!yearParams,
    retry: false
  });

  // Queries para ano de comparação
  const compareYearSalesQuery = useQuery({
    queryKey: ['salesReportCompareYear', compareYearParams],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSalesReport', compareYearParams);
      return response.data;
    },
    enabled: hasAccess && !!compareYearParams && compareYearsEnabled
  });

  const compareYearLossesQuery = useQuery({
    queryKey: ['lossesReportCompareYear', compareYearParams],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('Getlossesreport', compareYearParams);
        return response.data;
      } catch (error) {
        return {
          data: { lossesBySector: [], lossesByProduct: [], lossesBySectorProduct: [], rawData: [], totalGeral: 0 }
        };
      }
    },
    enabled: hasAccess && !!compareYearParams && compareYearsEnabled,
    retry: false
  });

  const salesData = salesQuery.data?.data;
  const lossesData = lossesQuery.data?.data;
  const lastYearSalesData = lastYearSalesQuery.data?.data;
  const hasLossesData = lossesData && lossesData.totalGeral > 0;

  // Totais anuais
  const yearSalesTotal = useMemo(() => {
    const data = yearSalesQuery.data?.data;
    return data?.totalGeral || 0;
  }, [yearSalesQuery.data]);

  const yearLossesTotal = useMemo(() => {
    const data = yearLossesQuery.data?.data;
    return data?.totalGeral || 0;
  }, [yearLossesQuery.data]);

  const yearAverageLossRate = useMemo(() => {
    if (yearSalesTotal === 0) return 0;
    return (yearLossesTotal / yearSalesTotal) * 100;
  }, [yearSalesTotal, yearLossesTotal]);

  // Comparação de anos
  const compareYearSalesTotal = useMemo(() => {
    if (!compareYearsEnabled) return 0;
    const data = compareYearSalesQuery.data?.data;
    return data?.totalGeral || 0;
  }, [compareYearSalesQuery.data, compareYearsEnabled]);

  const compareYearLossesTotal = useMemo(() => {
    if (!compareYearsEnabled) return 0;
    const data = compareYearLossesQuery.data?.data;
    return data?.totalGeral || 0;
  }, [compareYearLossesQuery.data, compareYearsEnabled]);

  const yearOverYearChange = useMemo(() => {
    if (!compareYearsEnabled || compareYearSalesTotal === 0) return null;
    return ((yearSalesTotal - compareYearSalesTotal) / compareYearSalesTotal) * 100;
  }, [yearSalesTotal, compareYearSalesTotal, compareYearsEnabled]);

  const yearOverYearGrowth = useMemo(() => {
    if (!salesData || !lastYearSalesData) return null;
    const current = salesData.totalGeral;
    const previous = lastYearSalesData.totalGeral;
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }, [salesData, lastYearSalesData]);

  const averageLossRate = useMemo(() => {
    if (!salesData || !lossesData || !hasLossesData) return null;
    if (salesData.totalGeral === 0) return 0;
    return (lossesData.totalGeral / salesData.totalGeral) * 100;
  }, [salesData, lossesData, hasLossesData]);

  const monthlyChartData = useMemo(() => {
    const yearSales = yearSalesQuery.data?.data?.rawData || [];
    const yearLosses = yearLossesQuery.data?.data?.rawData || [];
    
    // Dados do ano de comparação (se habilitado)
    const compareYearSales = compareYearsEnabled ? (compareYearSalesQuery.data?.data?.rawData || []) : [];
    const compareYearLosses = compareYearsEnabled ? (compareYearLossesQuery.data?.data?.rawData || []) : [];
    
    if (yearSales.length === 0) return [];

    const monthlyData = new Map();
    const monthOrder = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    monthOrder.forEach(month => {
      monthlyData.set(month, { 
        month, 
        sales: 0, 
        losses: 0,
        compareSales: 0,
        compareLosses: 0
      });
    });

    // Processar vendas do ano atual
    yearSales.forEach(row => {
      const date = new Date(row.data);
      const monthIndex = date.getMonth();
      const month = monthOrder[monthIndex];
      monthlyData.get(month).sales += parseFloat(row.valor_reais || 0);
    });

    // Processar perdas do ano atual
    yearLosses.forEach(row => {
      const date = new Date(row.data);
      const monthIndex = date.getMonth();
      const month = monthOrder[monthIndex];
      monthlyData.get(month).losses += parseFloat(row.valor_reais || 0);
    });

    // Processar vendas do ano de comparação
    if (compareYearsEnabled) {
      compareYearSales.forEach(row => {
        const date = new Date(row.data);
        const monthIndex = date.getMonth();
        const month = monthOrder[monthIndex];
        monthlyData.get(month).compareSales += parseFloat(row.valor_reais || 0);
      });

      compareYearLosses.forEach(row => {
        const date = new Date(row.data);
        const monthIndex = date.getMonth();
        const month = monthOrder[monthIndex];
        monthlyData.get(month).compareLosses += parseFloat(row.valor_reais || 0);
      });
    }

    // Calcular % de perda
    const result = Array.from(monthlyData.values()).map(item => ({
      ...item,
      lossRate: item.sales > 0 ? (item.losses / item.sales) * 100 : 0,
      compareLossRate: item.compareSales > 0 ? (item.compareLosses / item.compareSales) * 100 : 0
    }));

    return result;
  }, [yearSalesQuery.data, yearLossesQuery.data, compareYearsEnabled, compareYearSalesQuery.data, compareYearLossesQuery.data]);

  const sectorsWithLosses = useMemo(() => {
    if (!salesData?.salesBySector) return [];
    return salesData.salesBySector.map(sector => {
      const lossSector = lossesData?.lossesBySector?.find(l => l.setor === sector.setor);
      return {
        ...sector,
        total_losses: lossSector ? parseFloat(lossSector.total_valor) : 0
      };
    });
  }, [salesData, lossesData]);

  const filteredProducts = useMemo(() => {
    if (!salesData) return [];
    if (!selectedSector) {
      return salesData.salesByProduct || [];
    }
    const allProducts = salesData.salesBySectorProduct || [];
    return allProducts.filter(p => p.setor === selectedSector).slice(0, topN);
  }, [salesData, selectedSector, topN]);

  const dailyEvolutionData = useMemo(() => {
    if (!salesData?.rawData) return [];

    const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    const salesByGroup = {};

    // Processar VENDAS
    salesData.rawData.forEach(row => {
      try {
        const dateStr = row.data.split('T')[0];
        const fullDate = parseISO(row.data);
        let groupKey;
        let groupLabel;

        switch (timeFilter) {
          case 'hour':
            const hour = getHours(fullDate);
            groupKey = `${hour}`;
            groupLabel = `${hour.toString().padStart(2, '0')}h`;
            break;

          case 'day':
            groupKey = dateStr;
            groupLabel = format(fullDate, 'dd/MM');
            break;

          case 'weekday':
            const weekday = getDay(fullDate);
            groupKey = `${weekday}`;
            groupLabel = WEEKDAY_NAMES[weekday];
            break;

          case 'week':
            const week = getWeek(fullDate, { weekStartsOn: 1 });
            groupKey = `${week}`;
            groupLabel = `Semana ${week}`;
            break;

          case 'month':
            const month = format(fullDate, 'yyyy-MM');
            groupKey = month;
            groupLabel = format(fullDate, 'MMM/yy');
            break;

          default:
            groupKey = dateStr;
            groupLabel = format(fullDate, 'dd/MM');
        }

        if (!salesByGroup[groupKey]) {
          salesByGroup[groupKey] = {
            key: groupKey,
            label: groupLabel,
            vendas: 0,
            perdas: 0
          };
        }

        salesByGroup[groupKey].vendas += parseFloat(row.valor_reais || 0);
      } catch (error) {
        console.error('Erro ao processar vendas:', error);
      }
    });

    // Processar PERDAS
    if (lossesData?.rawData) {
      lossesData.rawData.forEach(row => {
        try {
          const dateStr = row.data.split('T')[0];
          const fullDate = parseISO(row.data);
          let groupKey;

          switch (timeFilter) {
            case 'hour':
              groupKey = `${getHours(fullDate)}`;
              break;
            case 'day':
              groupKey = dateStr;
              break;
            case 'weekday':
              groupKey = `${getDay(fullDate)}`;
              break;
            case 'week':
              groupKey = `${getWeek(fullDate, { weekStartsOn: 1 })}`;
              break;
            case 'month':
              groupKey = format(fullDate, 'yyyy-MM');
              break;
            default:
              groupKey = dateStr;
          }

          if (salesByGroup[groupKey]) {
            salesByGroup[groupKey].perdas += parseFloat(row.valor_reais || 0);
          }
        } catch (error) {
          console.error('Erro ao processar perdas:', error);
        }
      });
    }

    // Converter para array e ordenar
    const chartArray = Object.values(salesByGroup)
      .map(group => ({
        data: group.label,
        sortKey: group.key,
        vendas: group.vendas,
        perdas: group.perdas
      }))
      .sort((a, b) => {
        if (timeFilter === 'weekday' || timeFilter === 'hour') {
          return parseInt(a.sortKey) - parseInt(b.sortKey);
        }
        return a.sortKey.localeCompare(b.sortKey);
      });

    return chartArray;
  }, [salesData, lossesData, timeFilter]);

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

  const isLoadingPeriod = salesQuery.isLoading || lossesQuery.isLoading;
  const isLoadingYear = yearSalesQuery.isLoading || yearLossesQuery.isLoading;

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Relatórios de Vendas</h1>
          <p className="text-slate-600 mt-1">Análise integrada de vendas e perdas</p>
        </div>
        {salesData && (
          <Button 
            onClick={handleExportExcel} 
            size="lg" 
            className="shadow-md bg-green-600 hover:bg-green-700 text-white"
          >
            <FileSpreadsheet className="w-5 h-5 mr-2" />
            Exportar Excel
          </Button>
        )}
      </div>

      {/* Aviso perdas */}
      {!hasLossesData && salesData && (
        <Card className="bg-amber-50 border-2 border-amber-300">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Dados de perdas não encontrados</p>
                <p className="text-sm text-amber-800 mt-1">
                  O sistema não conseguiu carregar dados de perdas para o período selecionado.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controle do Ano + Comparação */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Label className="text-base font-semibold text-slate-700">Visão Anual:</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32 h-11 text-base shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="compareYears"
                  checked={compareYearsEnabled}
                  onCheckedChange={setCompareYearsEnabled}
                />
                <Label htmlFor="compareYears" className="text-sm font-medium cursor-pointer">
                  Comparar
                </Label>
              </div>

              {compareYearsEnabled && (
                <Select value={compareYear.toString()} onValueChange={(v) => setCompareYear(parseInt(v))}>
                  <SelectTrigger className="w-32 h-11 text-base shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                    <SelectItem value="2021">2021</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARDS DE RESUMO ANUAL */}
      {yearSalesTotal > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Faturamento Anual */}
          <Card className="bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 border-2 border-green-300 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-base text-green-700 font-bold mb-1 uppercase tracking-wide">
                    Faturamento
                  </p>
                  <p className="text-4xl font-bold text-green-900 mb-2">
                    R$ {(yearSalesTotal / 1000).toFixed(0)}k
                  </p>
                  {yearOverYearChange !== null && (
                    <div className={`flex items-center gap-1 mt-2 text-lg font-bold ${
                      yearOverYearChange > 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {yearOverYearChange > 0 ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : (
                        <TrendingDown className="w-5 h-5" />
                      )}
                      <span>
                        {yearOverYearChange > 0 ? '+' : ''}
                        {yearOverYearChange.toFixed(1)}% vs {compareYear}
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-green-200 p-2 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Perdas Anual */}
          <Card className="bg-gradient-to-br from-red-50 via-red-100 to-rose-100 border-2 border-red-300 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-base text-red-700 font-bold mb-1 uppercase tracking-wide">
                    Perdas
                  </p>
                  <p className="text-4xl font-bold text-red-900 mb-2">
                    R$ {(yearLossesTotal / 1000).toFixed(0)}k
                  </p>
                  <p className="text-lg text-red-600 mt-1 font-bold">
                    Taxa média: {yearAverageLossRate.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-red-200 p-2 rounded-lg">
                  <TrendingDown className="w-8 h-8 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Média Mensal */}
          <Card className="bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 border-2 border-blue-300 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-base text-blue-700 font-bold mb-1 uppercase tracking-wide">
                    Média Mensal de Vendas
                  </p>
                  <p className="text-4xl font-bold text-blue-900 mb-2">
                    R$ {(yearSalesTotal / 12 / 1000).toFixed(0)}k
                  </p>
                  <p className="text-lg text-blue-600 mt-1 font-bold">
                    Melhor mês: Dezembro
                  </p>
                </div>
                <div className="bg-blue-200 p-2 rounded-lg">
                  <svg className="w-8 h-8 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* GRÁFICO MENSAL */}
      {isLoadingYear ? (
        <Card className="shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-slate-600">Carregando dados do ano...</p>
            </div>
          </CardContent>
        </Card>
      ) : monthlyChartData.length > 0 ? (
        <Card className="shadow-lg border-slate-200">
          <CardContent className="pt-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Faturamento Mensal vs Perdas - {selectedYear}
                {compareYearsEnabled && (
                  <span className="text-lg font-normal text-slate-600 ml-2">
                    comparado com {compareYear}
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-600">
                {compareYearsEnabled 
                  ? `Comparação ${selectedYear} vs ${compareYear} • Clique nos meses para detalhar`
                  : 'Visão completa do ano • Clique nos meses para detalhar'
                }
              </p>
            </div>
            
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={monthlyChartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="colorLosses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="colorCompareSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.15}/>
                  </linearGradient>
                  <linearGradient id="colorCompareLosses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.15}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 13, fill: '#64748b' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  yAxisId="left"
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 13, fill: '#64748b' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                />
                {hasLossesData && (
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    domain={[0, 20]}
                    tick={{ fontSize: 13, fill: '#64748b' }}
                    tickLine={{ stroke: '#cbd5e1' }}
                  />
                )}
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value, name, props) => {
                    // Formatação de % de perda
                    if (props.dataKey === 'lossRate') {
                      return [`${value.toFixed(1)}%`, '% Perda'];
                    }
                    
                    // Formatação em reais
                    const formatted = `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    
                    // Identificar pelo dataKey
                    if (props.dataKey === 'sales') {
                      return [formatted, 'Faturamento'];
                    }
                    if (props.dataKey === 'losses') {
                      return [formatted, 'Perdas'];
                    }
                    
                    return [formatted, name];
                  }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                
                {/* Barras do ano de comparação (se ativo) */}
                {compareYearsEnabled && (
                  <>
                    <Bar 
                      yAxisId="left"
                      dataKey="compareSales" 
                      name={`Faturamento ${compareYear}`}
                      fill="url(#colorCompareSales)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    />
                    {hasLossesData && (
                      <Bar 
                        yAxisId="left"
                        dataKey="compareLosses" 
                        name={`Perdas ${compareYear}`}
                        fill="url(#colorCompareLosses)"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={60}
                      />
                    )}
                  </>
                )}
                
                {/* Barras do ano atual */}
                <Bar 
                  yAxisId="left"
                  dataKey="sales" 
                  name={`Faturamento ${selectedYear}`}
                  fill="url(#colorSales)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={60}
                />
                {hasLossesData && (
                  <>
                    <Bar 
                      yAxisId="left"
                      dataKey="losses" 
                      name={`Perdas ${selectedYear}`}
                      fill="url(#colorLosses)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="lossRate" 
                      name={`% Perda ${selectedYear}`}
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b', r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardContent className="py-16 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Nenhum dado disponível para o ano {selectedYear}</p>
          </CardContent>
        </Card>
      )}

      {/* Divisor */}
      <div className="relative py-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t-2 border-slate-300"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-6 py-2 bg-slate-100 text-sm font-semibold text-slate-700 rounded-full shadow-sm">
            Análise Detalhada
          </span>
        </div>
      </div>

      {/* Controles do Período */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="pt-6">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Análise por Período Personalizado</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-base font-medium text-slate-700">Período de Análise</Label>
              <DateRangePicker 
                value={dateRange}
                onChange={setDateRange}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium text-slate-700">Produtos a Exibir</Label>
              <Select value={topN.toString()} onValueChange={(v) => setTopN(parseInt(v))}>
                <SelectTrigger className="h-11 shadow-sm">
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
          </div>
        </CardContent>
      </Card>

      {isLoadingPeriod ? (
        <Card className="shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-slate-600">Carregando dados do período...</p>
            </div>
          </CardContent>
        </Card>
      ) : salesData ? (
        <>
          {/* CARDS DE RESUMO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 border-2 border-green-300 shadow-xl">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-green-700 font-semibold mb-2 uppercase tracking-wide">
                      Faturamento Total
                    </p>
                    <p className="text-5xl font-bold text-green-900 mb-3">
                      R$ {(salesData.totalGeral / 1000).toFixed(1)}k
                    </p>
                    <p className="text-sm text-green-700 font-medium">
                      {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                    </p>
                    {yearOverYearGrowth !== null && (
                      <div className={`flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full inline-flex text-xs font-bold ${
                        yearOverYearGrowth > 0 
                          ? 'bg-green-200 text-green-800' 
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {yearOverYearGrowth > 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span>
                          {yearOverYearGrowth > 0 ? '+' : ''}
                          {yearOverYearGrowth.toFixed(1)}% vs ano anterior
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="bg-green-200 p-3 rounded-xl">
                    <TrendingUp className="w-10 h-10 text-green-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {hasLossesData ? (
              <Card className="bg-gradient-to-br from-red-50 via-red-100 to-rose-100 border-2 border-red-300 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-red-700 font-semibold mb-2 uppercase tracking-wide">
                        Perdas Totais
                      </p>
                      <p className="text-5xl font-bold text-red-900 mb-3">
                        R$ {(lossesData.totalGeral / 1000).toFixed(1)}k
                      </p>
                      <p className="text-sm text-red-700 font-medium">
                        {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                      </p>
                      {averageLossRate !== null && (
                        <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full inline-flex text-xs font-bold bg-red-200 text-red-800">
                          <span>Taxa média: {averageLossRate.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-red-200 p-3 rounded-xl">
                      <TrendingDown className="w-10 h-10 text-red-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-100 border-2 border-slate-300 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-200 p-3 rounded-xl">
                      <AlertCircle className="w-10 h-10 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 font-semibold uppercase tracking-wide">
                        Perdas
                      </p>
                      <p className="text-lg font-semibold text-slate-700 mt-1">
                        Dados não disponíveis
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* CARDS SETORES */}
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              Vendas por Setor
              {selectedSector && (
                <span className="ml-3 text-sm font-normal text-slate-600">
                  • Clique novamente no setor para ver todos os produtos
                </span>
              )}
            </h3>

            <Sectorcards
              sectors={sectorsWithLosses}
              compareSectors={null}
              selectedSector={selectedSector}
              onSectorClick={handleSectorClick}
              totalGeral={salesData.totalGeral}
              showLosses={hasLossesData}
            />
          </div>

          {/* GRÁFICOS */}
          {!selectedSector && dailyEvolutionData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Evolução Temporal</h3>
                    
                    {/* Filtro de tempo */}
                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Por dia</SelectItem>
                        <SelectItem value="hour">Por hora</SelectItem>
                        <SelectItem value="weekday">Por dia da semana</SelectItem>
                        <SelectItem value="week">Por semana</SelectItem>
                        <SelectItem value="month">Por mês</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={dailyEvolutionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="data" 
                          tick={{ fontSize: 12, fill: '#64748b' }}
                        />
                        <YAxis 
                          tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                          formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        />
                        <Legend iconType="circle" />
                        <Line 
                          type="monotone" 
                          dataKey="vendas" 
                          name="Vendas" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          dot={false}
                        />
                        {hasLossesData && (
                          <Line 
                            type="monotone" 
                            dataKey="perdas" 
                            name="Perdas" 
                            stroke="#ef4444" 
                            strokeWidth={3}
                            dot={false}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <SectorDistributionChart
                  sectors={salesData.salesBySector}
                  type="sales"
                />
              </div>
          )}

          {selectedSector && salesData.rawData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectorEvolutionChart
                rawData={salesData.rawData}
                rawLossesData={lossesData?.rawData}
                sector={selectedSector}
                type="sales"
              />

              <ProductsPieChart
                products={salesData.salesBySectorProduct}
                sector={selectedSector}
                type="sales"
                topN={5}
              />
            </div>
          )}

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
        <Card className="shadow-lg">
          <CardContent className="py-16 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">Selecione um período para visualizar os dados</p>
          </CardContent>
        </Card>
      )}

      {salesData && (
        <ProductComparisonModal
          isOpen={comparisonModalOpen}
          onClose={() => setComparisonModalOpen(false)}
          initialProduct={comparisonInitialProduct}
          initialDateRange={dateRange}
          type="sales"
        />
      )}
    </div>
  );
}