import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, TrendingUp, TrendingDown, AlertCircle, AlertTriangle, FileText } from "lucide-react";
import { format, subYears, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
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

  // Controles
  const [topN, setTopN] = useState(10);

  // Filtros de tempo
  const [timeFilter, setTimeFilter] = useState('all');
  const [selectedWeekday, setSelectedWeekday] = useState(null);

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

  const salesData = salesQuery.data?.data;
  const lossesData = lossesQuery.data?.data;
  const lastYearSalesData = lastYearSalesQuery.data?.data;
  const hasLossesData = lossesData && lossesData.totalGeral > 0;

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
    if (yearSales.length === 0) return [];

    const monthlyData = new Map();
    const monthOrder = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    monthOrder.forEach(month => {
      monthlyData.set(month, { month, sales: 0, losses: 0 });
    });

    yearSales.forEach(row => {
      const date = new Date(row.data);
      const monthIndex = date.getMonth();
      const month = monthOrder[monthIndex];
      monthlyData.get(month).sales += parseFloat(row.valor_reais || 0);
    });

    yearLosses.forEach(row => {
      const date = new Date(row.data);
      const monthIndex = date.getMonth();
      const month = monthOrder[monthIndex];
      monthlyData.get(month).losses += parseFloat(row.valor_reais || 0);
    });

    const result = Array.from(monthlyData.values()).map(item => ({
      ...item,
      lossRate: item.sales > 0 ? (item.losses / item.sales) * 100 : 0
    }));

    return result;
  }, [yearSalesQuery.data, yearLossesQuery.data]);

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

    let filteredSalesData = salesData.rawData;
    let filteredLossesData = lossesData?.rawData || [];

    // Aplicar filtros de tempo
    if (timeFilter === 'weekday') {
      filteredSalesData = filteredSalesData.filter(row => {
        const day = new Date(row.data).getDay();
        return day >= 1 && day <= 5;
      });
      filteredLossesData = filteredLossesData.filter(row => {
        const day = new Date(row.data).getDay();
        return day >= 1 && day <= 5;
      });
    } else if (timeFilter === 'weekend') {
      filteredSalesData = filteredSalesData.filter(row => {
        const day = new Date(row.data).getDay();
        return day === 0 || day === 6;
      });
      filteredLossesData = filteredLossesData.filter(row => {
        const day = new Date(row.data).getDay();
        return day === 0 || day === 6;
      });
    } else if (timeFilter === 'specific' && selectedWeekday !== null) {
      filteredSalesData = filteredSalesData.filter(row => {
        const day = new Date(row.data).getDay();
        return day === selectedWeekday;
      });
      filteredLossesData = filteredLossesData.filter(row => {
        const day = new Date(row.data).getDay();
        return day === selectedWeekday;
      });
    }

    const salesByDate = new Map();
    filteredSalesData.forEach(row => {
      const date = format(new Date(row.data), 'dd/MM');
      const current = salesByDate.get(date) || 0;
      salesByDate.set(date, current + parseFloat(row.valor_reais || 0));
    });

    const lossesByDate = new Map();
    filteredLossesData.forEach(row => {
      const date = format(new Date(row.data), 'dd/MM');
      const current = lossesByDate.get(date) || 0;
      lossesByDate.set(date, current + parseFloat(row.valor_reais || 0));
    });

    const allDates = new Set([...salesByDate.keys(), ...lossesByDate.keys()]);
    return Array.from(allDates).map(date => ({
      data: date,
      vendas: salesByDate.get(date) || 0,
      perdas: lossesByDate.get(date) || 0
    })).sort((a, b) => {
      const [dayA, monthA] = a.data.split('/').map(Number);
      const [dayB, monthB] = b.data.split('/').map(Number);
      return monthA - monthB || dayA - dayB;
    });
  }, [salesData, lossesData, timeFilter, selectedWeekday]);

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

  const handleExportPDF = async () => {
    if (!salesData || !lossesData) return;
    
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text('Relatório de Vendas e Perdas', 14, 20);
      
      doc.setFontSize(12);
      doc.text(`Período: ${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`, 14, 30);
      
      doc.setFontSize(14);
      doc.text('Resumo', 14, 45);
      doc.autoTable({
        startY: 50,
        head: [['Métrica', 'Valor']],
        body: [
          ['Faturamento Total', `R$ ${salesData.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ['Perdas Totais', `R$ ${lossesData.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ['Taxa de Perda', `${averageLossRate ? averageLossRate.toFixed(1) : '0'}%`]
        ]
      });
      
      const finalY = doc.lastAutoTable.finalY || 80;
      doc.text('Top 10 Produtos', 14, finalY + 15);
      
      const products = salesData.salesByProduct.slice(0, 10);
      doc.autoTable({
        startY: finalY + 20,
        head: [['#', 'Produto', 'Setor', 'Vendas (R$)']],
        body: products.map((p, idx) => [
          idx + 1,
          p.produto_nome,
          p.setor,
          parseFloat(p.total_valor).toFixed(2)
        ])
      });
      
      doc.save(`Relatorio_Vendas_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
      toast.success("PDF exportado!");
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error("Erro ao exportar PDF. Instale: npm install jspdf jspdf-autotable");
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
          <div className="flex gap-3">
            <Button 
              onClick={handleExportExcel} 
              size="lg" 
              className="shadow-md bg-green-600 hover:bg-green-700 text-white"
            >
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              Exportar Excel
            </Button>
            
            <Button 
              onClick={handleExportPDF} 
              size="lg" 
              className="shadow-md bg-red-600 hover:bg-red-700 text-white"
            >
              <FileText className="w-5 h-5 mr-2" />
              Exportar PDF
            </Button>
          </div>
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

      {/* Controle do Ano */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label className="text-base font-semibold text-slate-700">Visão Anual:</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-40 h-11 text-base shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
                Faturamento Mensal vs Perdas - Ano {selectedYear}
              </h2>
              <p className="text-sm text-slate-600">
                Visão completa do ano • Clique nos meses para detalhar
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
                  formatter={(value, name) => {
                    if (name === 'lossRate' || name === '% Perda') {
                      return [`${value.toFixed(1)}%`, '% Perda'];
                    }
                    const formatted = `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    return [formatted, name === 'sales' ? 'Faturamento' : 'Perdas'];
                  }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar 
                  yAxisId="left"
                  dataKey="sales" 
                  name="Faturamento" 
                  fill="url(#colorSales)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={60}
                />
                {hasLossesData && (
                  <>
                    <Bar 
                      yAxisId="left"
                      dataKey="losses" 
                      name="Perdas" 
                      fill="url(#colorLosses)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="lossRate" 
                      name="% Perda" 
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
                    <h3 className="text-lg font-semibold text-slate-900">Evolução Diária</h3>
                    
                    {/* Filtro de tempo DENTRO do card */}
                    <div className="flex items-center gap-2">
                      <Select value={timeFilter} onValueChange={setTimeFilter}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="weekday">Dias úteis</SelectItem>
                          <SelectItem value="weekend">Fim de semana</SelectItem>
                          <SelectItem value="specific">Dia específico</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {timeFilter === 'specific' && (
                        <Select 
                          value={selectedWeekday?.toString()} 
                          onValueChange={(v) => setSelectedWeekday(parseInt(v))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Dia" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Dom</SelectItem>
                            <SelectItem value="1">Seg</SelectItem>
                            <SelectItem value="2">Ter</SelectItem>
                            <SelectItem value="3">Qua</SelectItem>
                            <SelectItem value="4">Qui</SelectItem>
                            <SelectItem value="5">Sex</SelectItem>
                            <SelectItem value="6">Sáb</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
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
            </>
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
