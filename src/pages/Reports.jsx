import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, subWeeks, subMonths, startOfYear, parseISO, getWeek, getMonth, getYear } from "date-fns";
import SalesLossChart from "../components/reports/SalesLossChart";
import LossRateChart from "../components/reports/LossRateChart";
import RevenueChart from "../components/reports/RevenueChart";
import SummaryTable from "../components/reports/SummaryTable";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [filters, setFilters] = useState({
    period: '4weeks',
    startDate: format(subWeeks(new Date(), 4), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    comparisonType: 'weeks',
    sector: 'all',
    product: 'all'
  });

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

  const { data: salesData = [] } = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list(),
    enabled: hasAccess
  });

  const { data: lossData = [] } = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list(),
    enabled: hasAccess
  });

  const handlePeriodChange = (value) => {
    const today = new Date();
    let start;
    
    if (value !== 'custom') {
      switch(value) {
        case 'week':
          start = subWeeks(today, 1);
          break;
        case '4weeks':
          start = subWeeks(today, 4);
          break;
        case 'month':
          start = subMonths(today, 1);
          break;
        case '3months':
          start = subMonths(today, 3);
          break;
        case 'year':
          start = startOfYear(today);
          break;
        default:
          start = subWeeks(today, 4);
      }
      
      setFilters({
        ...filters,
        period: value,
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd')
      });
    } else {
      setFilters({
        ...filters,
        period: 'custom'
      });
    }
  };

  // Processar dados do gráfico
  const chartData = useMemo(() => {
    // Criar mapa de preços
    const priceMap = {};
    products.forEach(product => {
      priceMap[product.id] = product.price || 0;
    });

    // Filtrar por período
    const filteredSales = salesData.filter(record => {
      const recordDate = new Date(record.date);
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      if (recordDate < startDate || recordDate > endDate) return false;
      if (filters.sector !== 'all' && record.sector !== filters.sector) return false;
      if (filters.product !== 'all' && record.product_id !== filters.product) return false;
      
      return true;
    });

    const filteredLosses = lossData.filter(record => {
      const recordDate = new Date(record.date);
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      if (recordDate < startDate || recordDate > endDate) return false;
      if (filters.sector !== 'all' && record.sector !== filters.sector) return false;
      if (filters.product !== 'all' && record.product_id !== filters.product) return false;
      
      return true;
    });

    // Agrupar dados conforme tipo de comparação
    const grouped = {};

    if (filters.comparisonType === 'weeks') {
      filteredSales.forEach(record => {
        const week = `Semana ${record.week_number}`;
        if (!grouped[week]) grouped[week] = { sales: 0, losses: 0, revenue: 0 };
        grouped[week].sales += record.quantity || 0;
        grouped[week].revenue += (record.quantity || 0) * (priceMap[record.product_id] || 0);
      });
      filteredLosses.forEach(record => {
        const week = `Semana ${record.week_number}`;
        if (!grouped[week]) grouped[week] = { sales: 0, losses: 0, revenue: 0 };
        grouped[week].losses += record.quantity || 0;
      });
    } else if (filters.comparisonType === 'months') {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      filteredSales.forEach(record => {
        const month = monthNames[record.month - 1];
        if (!grouped[month]) grouped[month] = { sales: 0, losses: 0, revenue: 0 };
        grouped[month].sales += record.quantity || 0;
        grouped[month].revenue += (record.quantity || 0) * (priceMap[record.product_id] || 0);
      });
      filteredLosses.forEach(record => {
        const month = monthNames[record.month - 1];
        if (!grouped[month]) grouped[month] = { sales: 0, losses: 0, revenue: 0 };
        grouped[month].losses += record.quantity || 0;
      });
    } else if (filters.comparisonType === 'products') {
      filteredSales.forEach(record => {
        const productName = record.product_name;
        if (!grouped[productName]) grouped[productName] = { sales: 0, losses: 0, revenue: 0 };
        grouped[productName].sales += record.quantity || 0;
        grouped[productName].revenue += (record.quantity || 0) * (priceMap[record.product_id] || 0);
      });
      filteredLosses.forEach(record => {
        const productName = record.product_name;
        if (!grouped[productName]) grouped[productName] = { sales: 0, losses: 0, revenue: 0 };
        grouped[productName].losses += record.quantity || 0;
      });
    } else if (filters.comparisonType === 'sectors') {
      filteredSales.forEach(record => {
        const sector = record.sector;
        if (!grouped[sector]) grouped[sector] = { sales: 0, losses: 0, revenue: 0 };
        grouped[sector].sales += record.quantity || 0;
        grouped[sector].revenue += (record.quantity || 0) * (priceMap[record.product_id] || 0);
      });
      filteredLosses.forEach(record => {
        const sector = record.sector;
        if (!grouped[sector]) grouped[sector] = { sales: 0, losses: 0, revenue: 0 };
        grouped[sector].losses += record.quantity || 0;
      });
    }

    return Object.entries(grouped).map(([period, data]) => ({
      period,
      sales: data.sales,
      losses: data.losses,
      revenue: data.revenue
    }));
  }, [salesData, lossData, filters, products]);

  const handleApplyFilters = () => {
    // Filtros já estão aplicados automaticamente via useMemo
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
        `${format(new Date(filters.startDate), 'dd/MM/yyyy')} a ${format(new Date(filters.endDate), 'dd/MM/yyyy')}`,
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
        'weeks': 'Por Semanas',
        'months': 'Por Meses',
        'products': 'Por Produtos',
        'sectors': 'Por Setores'
      };
      
      pdf.text(`• Tipo de comparação: ${comparisonLabels[filters.comparisonType]}`, margin, yPos);
      yPos += 7;
      pdf.text(`• Setor: ${filters.sector === 'all' ? 'Todos os setores' : filters.sector}`, margin, yPos);
      
      if (filters.product !== 'all') {
        yPos += 7;
        const selectedProduct = products.find(p => p.id === filters.product);
        pdf.text(`• Produto: ${selectedProduct?.name || 'N/A'}`, margin, yPos);
      }

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
                  value={filters.period} 
                  onValueChange={handlePeriodChange}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Última semana</SelectItem>
                    <SelectItem value="4weeks">Últimas 4 semanas</SelectItem>
                    <SelectItem value="month">Último mês</SelectItem>
                    <SelectItem value="3months">Últimos 3 meses</SelectItem>
                    <SelectItem value="year">Ano atual</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>

                {filters.period === 'custom' && (
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

              {/* TIPO DE COMPARAÇÃO */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Comparar por</Label>
                <Select 
                  value={filters.comparisonType} 
                  onValueChange={(value) => setFilters({...filters, comparisonType: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weeks">Semanas</SelectItem>
                    <SelectItem value="months">Meses</SelectItem>
                    <SelectItem value="products">Produtos</SelectItem>
                    <SelectItem value="sectors">Setores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SETOR */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Filtrar por setor</Label>
                <Select 
                  value={filters.sector} 
                  onValueChange={(value) => setFilters({...filters, sector: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos os setores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    <SelectItem value="Padaria">Padaria</SelectItem>
                    <SelectItem value="Confeitaria">Confeitaria</SelectItem>
                    <SelectItem value="Salgados">Salgados</SelectItem>
                    <SelectItem value="Frios">Frios</SelectItem>
                    <SelectItem value="Restaurante">Restaurante</SelectItem>
                    <SelectItem value="Minimercado">Minimercado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PRODUTO */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Filtrar por produto</Label>
                <Select 
                  value={filters.product} 
                  onValueChange={(value) => setFilters({...filters, product: value})}
                  disabled={filters.comparisonType !== 'products'}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filters.comparisonType !== 'products' && (
                  <p className="text-xs text-slate-500 mt-1">
                    Disponível ao selecionar "Produtos"
                  </p>
                )}
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
          <div id="sales-loss-chart">
            <SalesLossChart data={chartData} />
          </div>
          <div id="loss-rate-chart">
            <LossRateChart data={chartData} />
          </div>
          <div id="revenue-chart">
            <RevenueChart data={chartData} products={products} />
          </div>
          <SummaryTable data={chartData} products={products} />
        </div>
      </div>
    </div>
  );
}