import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, FileSpreadsheet, Package, Percent, Layers, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, subYears } from "date-fns";
import SalesLossChart from "../components/reports/SalesLossChart";
import LossRateChart from "../components/reports/LossRateChart";
import RevenueChart from "../components/reports/RevenueChart";
import SummaryTable from "../components/reports/SummaryTable";
import KPICard from "../components/common/KPICard";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [kpiView, setKpiView] = useState('operational');
  const [filters, setFilters] = useState({
    preset: 'currentWeek',
    startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    granularity: 'week',
    compareMode: 'none'
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  // Verificar permissão de acesso
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        
        // MASTER sempre tem acesso
        if (user.role === 'admin') {
          setCurrentUser(user);
          setHasAccess(true);
          return;
        }
        
        // Outros usuários: verificar permissão reports_access
        if (user.reports_access === true) {
          setCurrentUser(user);
          setHasAccess(true);
        } else {
          toast.error("Você não tem permissão para acessar esta área");
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      } catch (error) {
        window.location.href = '/';
      }
    };
    checkAuth();
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: hasAccess
  });

  const handlePresetChange = (value) => {
    const today = new Date();
    let start = filters.startDate;
    let end = filters.endDate;

    switch (value) {
      case 'currentWeek':
        start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'previousWeek': {
        const previousWeek = subWeeks(today, 1);
        start = format(startOfWeek(previousWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(previousWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      }
      case 'currentMonth':
        start = format(startOfMonth(today), 'yyyy-MM-dd');
        end = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'previousMonth': {
        const previousMonth = subMonths(today, 1);
        start = format(startOfMonth(previousMonth), 'yyyy-MM-dd');
        end = format(endOfMonth(previousMonth), 'yyyy-MM-dd');
        break;
      }
      case 'currentYear':
        start = format(startOfYear(today), 'yyyy-MM-dd');
        end = format(endOfYear(today), 'yyyy-MM-dd');
        break;
      case 'previousYear': {
        const previousYear = subYears(today, 1);
        start = format(startOfYear(previousYear), 'yyyy-MM-dd');
        end = format(endOfYear(previousYear), 'yyyy-MM-dd');
        break;
      }
      case 'custom':
      default:
        break;
    }

    setFilters((prev) => ({
      ...prev,
      preset: value,
      startDate: value === 'custom' ? prev.startDate : start,
      endDate: value === 'custom' ? prev.endDate : end
    }));
  };

  // Buscar dados do relatório do backend (vw_movimentacoes)
  const { data: reportDataRaw = {} } = useQuery({
    queryKey: ['reportData', appliedFilters.startDate, appliedFilters.endDate, appliedFilters.granularity, appliedFilters.compareMode],
    queryFn: async () => {
      const result = await base44.functions.invoke('getReportData', {
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        granularity: appliedFilters.granularity,
        compareMode: appliedFilters.compareMode
      });
      return result.data || {};
    },
    enabled: hasAccess
  });

  // Processar dados do gráfico
  const chartData = useMemo(() => {
    // Usar dados do backend
    const summaryData = reportDataRaw.current?.summary || [];
    
    console.log('📊 Dados de relatório processados:', summaryData.length, 'períodos');

    return summaryData.map(row => ({
      periodKey: row.period_key,
      periodLabel: row.period_label,
      period: row.period_key,
      sales: parseFloat(row.vendas_qtd) || 0,
      losses: parseFloat(row.perdas_qtd) || 0,
      lossRate: parseFloat(row.taxa_perda) || 0,
      revenue: parseFloat(row.faturamento) || 0
    }));
  }, [reportDataRaw]);

  const comparisonChartData = useMemo(() => {
    const summaryData = reportDataRaw.comparison?.summary || [];
    return summaryData.map(row => ({
      periodKey: row.period_key,
      periodLabel: row.period_label,
      period: row.period_key,
      sales: parseFloat(row.vendas_qtd) || 0,
      losses: parseFloat(row.perdas_qtd) || 0,
      lossRate: parseFloat(row.taxa_perda) || 0,
      revenue: parseFloat(row.faturamento) || 0
    }));
  }, [reportDataRaw]);

  const calculateTotals = (data) => data.reduce((acc, item) => ({
    sales: acc.sales + item.sales,
    losses: acc.losses + item.losses,
    revenue: acc.revenue + item.revenue
  }), { sales: 0, losses: 0, revenue: 0 });

  const kpiData = useMemo(() => {
    const totals = calculateTotals(chartData);
    const comparisonTotals = appliedFilters.compareMode !== 'none'
      ? calculateTotals(comparisonChartData)
      : null;
    const periods = chartData.length || 1;
    const comparisonPeriods = comparisonChartData.length || 1;
    const lossRate = totals.sales > 0 ? (totals.losses / totals.sales) * 100 : 0;
    const netSales = totals.sales - totals.losses;
    const avgSales = totals.sales / periods;
    const avgLosses = totals.losses / periods;
    const avgRevenue = totals.revenue / periods;
    const comparisonLossRate = comparisonTotals && comparisonTotals.sales > 0
      ? (comparisonTotals.losses / comparisonTotals.sales) * 100
      : null;
    const comparisonNetSales = comparisonTotals
      ? comparisonTotals.sales - comparisonTotals.losses
      : null;
    const comparisonAvgSales = comparisonTotals ? comparisonTotals.sales / comparisonPeriods : null;
    const comparisonAvgLosses = comparisonTotals ? comparisonTotals.losses / comparisonPeriods : null;
    const comparisonAvgRevenue = comparisonTotals ? comparisonTotals.revenue / comparisonPeriods : null;

    return {
      totals,
      comparisonTotals,
      comparisonLossRate,
      comparisonNetSales,
      comparisonAvgSales,
      comparisonAvgLosses,
      comparisonAvgRevenue,
      lossRate,
      netSales,
      avgSales,
      avgLosses,
      avgRevenue
    };
  }, [chartData, comparisonChartData, appliedFilters.compareMode]);

  const formatNumber = (value) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPercent = (value) => `${value.toFixed(1)}%`;

  const getComparisonMeta = (currentValue, comparisonValue, formatter, { positiveGood = true, unitSuffix = "" } = {}) => {
    if (comparisonValue === null || comparisonValue === undefined) {
      return {};
    }
    const delta = currentValue - comparisonValue;
    const percentDelta = comparisonValue !== 0 ? (delta / comparisonValue) * 100 : null;
    const trend = delta === 0
      ? "neutral"
      : (delta > 0 ? (positiveGood ? "up" : "down") : (positiveGood ? "down" : "up"));
    const deltaLabel = `${delta > 0 ? "+" : ""}${formatter(Math.abs(delta))}${unitSuffix}`;
    const percentLabel = percentDelta === null
      ? ""
      : ` (${percentDelta > 0 ? "+" : ""}${percentDelta.toFixed(1)}%)`;
    return { trend, trendValue: `Δ ${deltaLabel}${percentLabel}`.trim() };
  };

  const kpiCards = useMemo(() => {
    const revenuePerKg = kpiData.totals.sales > 0 ? kpiData.totals.revenue / kpiData.totals.sales : 0;
    const estimatedLossValue = revenuePerKg * kpiData.totals.losses;

    const operational = [
      {
        title: "Vendas totais",
        value: `${formatNumber(kpiData.totals.sales)} kg`,
        subtitle: "Volume no período",
        icon: Package,
        color: "blue",
        ...getComparisonMeta(
          kpiData.totals.sales,
          kpiData.comparisonTotals?.sales,
          formatNumber,
          { positiveGood: true, unitSuffix: " kg" }
        )
      },
      {
        title: "Perdas totais",
        value: `${formatNumber(kpiData.totals.losses)} kg`,
        subtitle: "Volume no período",
        icon: TrendingDown,
        color: "red",
        ...getComparisonMeta(
          kpiData.totals.losses,
          kpiData.comparisonTotals?.losses,
          formatNumber,
          { positiveGood: false, unitSuffix: " kg" }
        )
      },
      {
        title: "Saldo líquido",
        value: `${formatNumber(kpiData.netSales)} kg`,
        subtitle: "Vendas - perdas",
        icon: Layers,
        color: "green",
        ...getComparisonMeta(
          kpiData.netSales,
          kpiData.comparisonTotals ? kpiData.comparisonTotals.sales - kpiData.comparisonTotals.losses : null,
          formatNumber,
          { positiveGood: true, unitSuffix: " kg" }
        )
      },
      {
        title: "Taxa de perda",
        value: formatPercent(kpiData.lossRate),
        subtitle: "Perdas / vendas",
        icon: Percent,
        color: "orange",
        ...getComparisonMeta(
          kpiData.lossRate,
          kpiData.comparisonTotals
            ? (kpiData.comparisonTotals.sales > 0
              ? (kpiData.comparisonTotals.losses / kpiData.comparisonTotals.sales) * 100
              : 0)
            : null,
          (value) => value.toFixed(1),
          { positiveGood: false, unitSuffix: " pp" }
        )
      }
    ];

    const efficiency = [
      {
        title: "Média de vendas",
        value: `${formatNumber(kpiData.avgSales)} kg`,
        subtitle: "Por período analisado",
        icon: TrendingUp,
        color: "blue",
        ...getComparisonMeta(
          kpiData.avgSales,
          kpiData.comparisonAvgSales,
          formatNumber,
          { positiveGood: true, unitSuffix: " kg" }
        )
      },
      {
        title: "Média de perdas",
        value: `${formatNumber(kpiData.avgLosses)} kg`,
        subtitle: "Por período analisado",
        icon: TrendingDown,
        color: "red",
        ...getComparisonMeta(
          kpiData.avgLosses,
          kpiData.comparisonAvgLosses,
          formatNumber,
          { positiveGood: false, unitSuffix: " kg" }
        )
      },
      {
        title: "Eficiência",
        value: formatPercent(100 - kpiData.lossRate),
        subtitle: "Aproveitamento",
        icon: Percent,
        color: "green",
        ...getComparisonMeta(
          100 - kpiData.lossRate,
          kpiData.comparisonLossRate !== null ? 100 - kpiData.comparisonLossRate : null,
          (value) => value.toFixed(1),
          { positiveGood: true, unitSuffix: " pp" }
        )
      },
      {
        title: "Saldo médio",
        value: `${formatNumber(kpiData.avgSales - kpiData.avgLosses)} kg`,
        subtitle: "Por período",
        icon: Layers,
        color: "purple",
        ...getComparisonMeta(
          kpiData.avgSales - kpiData.avgLosses,
          kpiData.comparisonAvgSales !== null && kpiData.comparisonAvgLosses !== null
            ? kpiData.comparisonAvgSales - kpiData.comparisonAvgLosses
            : null,
          formatNumber,
          { positiveGood: true, unitSuffix: " kg" }
        )
      }
    ];

    const financial = [
      {
        title: "Faturamento total",
        value: formatCurrency(kpiData.totals.revenue),
        subtitle: "No período",
        icon: DollarSign,
        color: "green",
        ...getComparisonMeta(
          kpiData.totals.revenue,
          kpiData.comparisonTotals?.revenue,
          formatCurrency,
          { positiveGood: true }
        )
      },
      {
        title: "Média de faturamento",
        value: formatCurrency(kpiData.avgRevenue),
        subtitle: "Por período",
        icon: DollarSign,
        color: "blue",
        ...getComparisonMeta(
          kpiData.avgRevenue,
          kpiData.comparisonAvgRevenue,
          formatCurrency,
          { positiveGood: true }
        )
      },
      {
        title: "Receita por kg",
        value: formatCurrency(revenuePerKg),
        subtitle: "Faturamento / volume",
        icon: DollarSign,
        color: "purple",
        ...getComparisonMeta(
          revenuePerKg,
          kpiData.comparisonTotals && kpiData.comparisonTotals.sales > 0
            ? kpiData.comparisonTotals.revenue / kpiData.comparisonTotals.sales
            : null,
          formatCurrency,
          { positiveGood: true }
        )
      },
      {
        title: "Perda estimada",
        value: formatCurrency(estimatedLossValue),
        subtitle: "Valor não aproveitado",
        icon: TrendingDown,
        color: "orange",
        ...getComparisonMeta(
          estimatedLossValue,
          kpiData.comparisonTotals && kpiData.comparisonTotals.sales > 0
            ? (kpiData.comparisonTotals.revenue / kpiData.comparisonTotals.sales) * kpiData.comparisonTotals.losses
            : null,
          formatCurrency,
          { positiveGood: false }
        )
      }
    ];

    return { operational, efficiency, financial };
  }, [kpiData]);

  const handleApplyFilters = () => {
    if (filters.preset === 'custom') {
      if (!filters.startDate || !filters.endDate) {
        toast.error('Selecione data de início e fim para o período personalizado.');
        return;
      }
      if (new Date(filters.startDate) > new Date(filters.endDate)) {
        toast.error('A data inicial deve ser menor ou igual à data final.');
        return;
      }
    }
    setAppliedFilters(filters);
  };

  const handleExportPDF = async () => {
    try {
      toast.info('Gerando PDF...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;

      // Buscar configuração da empresa
      let companyName = 'Gestão à Vista';
      let companyLogo = null;
      try {
        const configData = await base44.entities.SystemConfig.filter({ config_key: 'company_data' });
        if (configData.length > 0) {
          const companyData = JSON.parse(configData[0].config_value);
          companyName = companyData.company_name || companyName;
          companyLogo = companyData.logo_url;
        }
      } catch (error) {
        console.log('Configuração não encontrada');
      }

      // ============ PÁGINA 1: CAPA ============
      let yPos = 40;

      // Logo (se existir)
      if (companyLogo) {
        try {
          pdf.addImage(companyLogo, 'PNG', pageWidth / 2 - 20, yPos, 40, 40);
          yPos += 50;
        } catch (e) {
          console.log('Logo não carregado');
        }
      }

      // Título
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Relatório de Produção', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `${format(new Date(appliedFilters.startDate), 'dd/MM/yyyy')} a ${format(new Date(appliedFilters.endDate), 'dd/MM/yyyy')}`,
        pageWidth / 2,
        yPos,
        { align: 'center' }
      );

      // Filtros aplicados
      yPos += 25;
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Filtros Aplicados:', margin, yPos);
      
      yPos += 8;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      const comparisonLabels = {
        'none': 'Sem comparação',
        'previous': 'Período anterior',
        'yoy': 'Ano contra ano'
      };

      const granularityLabels = {
        'day': 'Diária',
        'week': 'Semanal',
        'month': 'Mensal',
        'year': 'Anual'
      };
      
      pdf.text(`• Granularidade: ${granularityLabels[appliedFilters.granularity]}`, margin, yPos);
      yPos += 7;
      pdf.text(`• Comparação: ${comparisonLabels[appliedFilters.compareMode]}`, margin, yPos);

      // Data de geração
      yPos += 20;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
        pageWidth / 2,
        yPos,
        { align: 'center' }
      );

      // Linha divisória
      yPos += 5;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      pdf.setTextColor(0, 0, 0);

      // ============ PÁGINAS DE GRÁFICOS ============
      
      // Gráfico 1: Vendas x Perdas
      pdf.addPage();
      yPos = margin;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Vendas e Perdas no Período', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      const chart1 = document.querySelector('#sales-loss-chart');
      if (chart1) {
        const canvas1 = await html2canvas(chart1, { 
          scale: 3,
          backgroundColor: '#ffffff',
          logging: false
        });
        const imgData1 = canvas1.toDataURL('image/png');
        const imgWidth1 = pageWidth - 2 * margin;
        const imgHeight1 = (canvas1.height * imgWidth1) / canvas1.width;
        pdf.addImage(imgData1, 'PNG', margin, yPos, imgWidth1, Math.min(imgHeight1, 100));
      }

      // Gráfico 2: Taxa de Perda
      pdf.addPage();
      yPos = margin;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Taxa de Perda no Período', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      const chart2 = document.querySelector('#loss-rate-chart');
      if (chart2) {
        const canvas2 = await html2canvas(chart2, { 
          scale: 3,
          backgroundColor: '#ffffff',
          logging: false
        });
        const imgData2 = canvas2.toDataURL('image/png');
        const imgWidth2 = pageWidth - 2 * margin;
        const imgHeight2 = (canvas2.height * imgWidth2) / canvas2.width;
        pdf.addImage(imgData2, 'PNG', margin, yPos, imgWidth2, Math.min(imgHeight2, 100));
      }

      // Gráfico 3: Faturamento (se houver)
      const chart3 = document.querySelector('#revenue-chart');
      const hasRevenue = products.some(p => p.price > 0);
      
      if (chart3 && hasRevenue) {
        pdf.addPage();
        yPos = margin;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Faturamento no Período', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
        
        const canvas3 = await html2canvas(chart3, { 
          scale: 3,
          backgroundColor: '#ffffff',
          logging: false
        });
        const imgData3 = canvas3.toDataURL('image/png');
        const imgWidth3 = pageWidth - 2 * margin;
        const imgHeight3 = (canvas3.height * imgWidth3) / canvas3.width;
        pdf.addImage(imgData3, 'PNG', margin, yPos, imgWidth3, Math.min(imgHeight3, 100));
      }

      // ============ ÚLTIMA PÁGINA: TABELA RESUMO ============
      pdf.addPage();
      yPos = margin;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumo Detalhado', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Tabela
      const hasPrice = products.some(p => p.price > 0);
      const headers = ['Período', 'Vendas', 'Perdas', 'Taxa', ...(hasPrice ? ['Faturamento'] : [])];
      const colWidths = hasPrice ? [50, 32, 32, 23, 43] : [60, 38, 38, 28];
      
      // Header
      pdf.setFillColor(71, 85, 105);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      
      let xPos = margin;
      headers.forEach((header, i) => {
        pdf.text(header, xPos + 2, yPos + 5.5);
        xPos += colWidths[i];
      });
      
      yPos += 8;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');

      // Dados
      chartData.forEach((row, index) => {
        const rate = row.sales > 0 ? (row.losses / row.sales) * 100 : 0;
        
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          yPos = margin;
        }

        if (index % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
        }

        xPos = margin;
        pdf.text(row.period.substring(0, 22), xPos + 2, yPos + 5);
        xPos += colWidths[0];
        pdf.text(row.sales.toFixed(1), xPos + 2, yPos + 5);
        xPos += colWidths[1];
        pdf.text(row.losses.toFixed(1), xPos + 2, yPos + 5);
        xPos += colWidths[2];
        pdf.text(`${rate.toFixed(1)}%`, xPos + 2, yPos + 5);
        
        if (hasPrice) {
          xPos += colWidths[3];
          pdf.text(`R$ ${row.revenue.toFixed(2)}`, xPos + 2, yPos + 5);
        }

        yPos += 7;
      });

      // Total
      const totals = chartData.reduce((acc, item) => ({
        sales: acc.sales + item.sales,
        losses: acc.losses + item.losses,
        revenue: acc.revenue + item.revenue
      }), { sales: 0, losses: 0, revenue: 0 });
      const totalRate = totals.sales > 0 ? (totals.losses / totals.sales) * 100 : 0;

      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setFillColor(226, 232, 240);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      
      xPos = margin;
      pdf.text('TOTAL', xPos + 2, yPos + 5.5);
      xPos += colWidths[0];
      pdf.text(totals.sales.toFixed(1), xPos + 2, yPos + 5.5);
      xPos += colWidths[1];
      pdf.text(totals.losses.toFixed(1), xPos + 2, yPos + 5.5);
      xPos += colWidths[2];
      pdf.text(`${totalRate.toFixed(1)}%`, xPos + 2, yPos + 5.5);
      
      if (hasPrice) {
        xPos += colWidths[3];
        pdf.text(`R$ ${totals.revenue.toFixed(2)}`, xPos + 2, yPos + 5.5);
      }

      // ============ RODAPÉ EM TODAS AS PÁGINAS ============
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          companyName,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        pdf.text(
          `Página ${i} de ${totalPages}`,
          pageWidth - margin,
          pageHeight - 10,
          { align: 'right' }
        );
      }

      pdf.save(`relatorio_producao_${format(new Date(), 'ddMMyyyy_HHmm')}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const handleExportExcel = () => {
    try {
      const hasPrice = products.some(p => p.price > 0);

      // Preparar dados para a aba "Resumo"
      const summaryData = chartData.map(row => {
        const rate = row.sales > 0 ? (row.losses / row.sales) * 100 : 0;
        const baseRow = {
          'Período': row.period,
          'Vendas (KG)': row.sales.toFixed(2),
          'Perdas (KG)': row.losses.toFixed(2),
          'Taxa Perda (%)': rate.toFixed(2)
        };
        
        if (hasPrice) {
          baseRow['Faturamento (R$)'] = row.revenue.toFixed(2);
        }
        
        return baseRow;
      });

      // Adicionar linha de total
      const totals = chartData.reduce((acc, item) => ({
        sales: acc.sales + item.sales,
        losses: acc.losses + item.losses,
        revenue: acc.revenue + item.revenue
      }), { sales: 0, losses: 0, revenue: 0 });
      const totalRate = totals.sales > 0 ? (totals.losses / totals.sales) * 100 : 0;

      const totalRow = {
        'Período': 'TOTAL',
        'Vendas (KG)': totals.sales.toFixed(2),
        'Perdas (KG)': totals.losses.toFixed(2),
        'Taxa Perda (%)': totalRate.toFixed(2)
      };
      if (hasPrice) {
        totalRow['Faturamento (R$)'] = totals.revenue.toFixed(2);
      }
      summaryData.push(totalRow);

      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(summaryData);

      // Aplicar formatação condicional (largura de colunas)
      const colWidths = [
        { wch: 20 }, // Período
        { wch: 15 }, // Vendas
        { wch: 15 }, // Perdas
        { wch: 15 }, // Taxa
      ];
      if (hasPrice) {
        colWidths.push({ wch: 18 }); // Faturamento
      }
      ws['!cols'] = colWidths;

      // Adicionar aba
      XLSX.utils.book_append_sheet(wb, ws, 'Resumo');

      // Salvar arquivo
      const fileName = `relatorio_producao_${format(new Date(), 'ddMMyyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      toast.error('Erro ao gerar Excel. Tente novamente.');
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <div className="text-slate-500">Verificando permissões...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Relatórios
          </h1>
          <p className="text-sm text-slate-500 mt-1">Análise gerencial e estratégica</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* PAINEL DE FILTROS */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* PERÍODO */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Período</Label>
                <Select 
                  value={filters.preset} 
                  onValueChange={handlePresetChange}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currentWeek">Semana atual</SelectItem>
                    <SelectItem value="previousWeek">Semana anterior</SelectItem>
                    <SelectItem value="currentMonth">Mês atual</SelectItem>
                    <SelectItem value="previousMonth">Mês anterior</SelectItem>
                    <SelectItem value="currentYear">Ano atual</SelectItem>
                    <SelectItem value="previousYear">Ano anterior</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>

                {filters.preset === 'custom' && (
                  <div className="space-y-2 mt-3">
                    <div>
                      <Label className="text-xs text-slate-600">Data Início</Label>
                      <Input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Data Fim</Label>
                      <Input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                        className="h-10"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* GRANULARIDADE */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Granularidade</Label>
                <Select 
                  value={filters.granularity} 
                  onValueChange={(value) => setFilters({...filters, granularity: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione a granularidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Dia</SelectItem>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="month">Mês</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* COMPARAÇÃO */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Comparação</Label>
                <Select 
                  value={filters.compareMode} 
                  onValueChange={(value) => setFilters({...filters, compareMode: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Sem comparação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem comparação</SelectItem>
                    <SelectItem value="previous">Período anterior</SelectItem>
                    <SelectItem value="yoy">Ano contra ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 h-10"
                onClick={handleApplyFilters}
              >
                Aplicar Filtros
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ÁREA DE GRÁFICOS/CONTEÚDO */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">KPIs do relatório</CardTitle>
                <p className="text-sm text-slate-500">Selecione o tipo de indicadores que deseja visualizar.</p>
              </div>
              <Select value={kpiView} onValueChange={setKpiView}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Tipo de KPI" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operacionais</SelectItem>
                  <SelectItem value="efficiency">Eficiência</SelectItem>
                  <SelectItem value="financial">Financeiros</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpiCards[kpiView].map((kpi) => (
                  <KPICard
                    key={kpi.title}
                    title={kpi.title}
                    value={kpi.value}
                    subtitle={kpi.subtitle}
                    icon={kpi.icon}
                    trend={kpi.trend}
                    trendValue={kpi.trendValue}
                    color={kpi.color}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <div id="sales-loss-chart">
            <SalesLossChart data={chartData} comparisonData={comparisonChartData} />
          </div>
          <div id="loss-rate-chart">
            <LossRateChart data={chartData} comparisonData={comparisonChartData} />
          </div>
          <div id="revenue-chart">
            <RevenueChart data={chartData} comparisonData={comparisonChartData} products={products} />
          </div>
          <SummaryTable data={chartData} products={products} />
        </div>
      </div>
    </div>
  );
}
