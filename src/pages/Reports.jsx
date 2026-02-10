import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import DateRangePicker from "../components/reports/DateRangePicker";
import LineChart from "../components/reports/LineChart";
import PieChartReport from "../components/reports/PieChartReport";

const REPORT_TYPES = [
  { value: 'sales', label: 'Vendas' },
  { value: 'losses', label: 'Perdas' }
];

const COMPARE_OPTIONS = [
  { value: 'none', label: 'Não comparar' },
  { value: 'previous', label: 'Período anterior' }
];

const SECTORS = ['Padaria', 'Confeitaria', 'Salgados', 'Frios', 'Restaurante', 'Minimercado'];

export default function Reports() {
  const [hasAccess, setHasAccess] = useState(false);
  const [reportType, setReportType] = useState('sales');
  const [compareOption, setCompareOption] = useState('none');
  const [selectedSector, setSelectedSector] = useState('all');
  
  // Date range - PADRÃO: Mês passado completo
  const [dateRange, setDateRange] = useState(() => {
    const lastMonth = subMonths(new Date(), 1);
    return {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth)
    };
  });

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

  // Calcular datas baseado no dateRange
  const { startDate, endDate, compareStartDate, compareEndDate } = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return {
        startDate: null,
        endDate: null,
        compareStartDate: null,
        compareEndDate: null
      };
    }

    const start = dateRange.from;
    const end = dateRange.to;
    let compareStart = null;
    let compareEnd = null;

    if (compareOption === 'previous') {
      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      compareStart = new Date(start);
      compareStart.setDate(compareStart.getDate() - diffDays - 1);
      compareEnd = new Date(start);
      compareEnd.setDate(compareEnd.getDate() - 1);
    }

    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      compareStartDate: compareStart ? format(compareStart, 'yyyy-MM-dd') : null,
      compareEndDate: compareEnd ? format(compareEnd, 'yyyy-MM-dd') : null
    };
  }, [dateRange, compareOption]);

  // Buscar dados
  const reportQuery = useQuery({
    queryKey: ['reportData', startDate, endDate, compareStartDate, compareEndDate, reportType, selectedSector],
    queryFn: async () => {
      const response = await base44.functions.invoke('getReportData', {
        startDate,
        endDate,
        compareStartDate,
        compareEndDate,
        reportType,
        sector: selectedSector
      });
      return response.data;
    },
    enabled: hasAccess && !!startDate && !!endDate
  });

  const reportData = reportQuery.data?.data || null;
  const compareData = reportQuery.data?.compareData || null;

  // Calcular variação
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  // Exportar Excel
  const handleExportExcel = () => {
    if (!reportData) return;

    try {
      const excelData = Object.entries(reportData.totalByProduct).map(([id, data]) => ({
        'Produto': data.nome,
        'Setor': data.setor,
        'Quantidade': data.quantidade.toFixed(2),
        'Unidade': data.unidade,
        'Valor (R$)': data.valor_reais.toFixed(2)
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      const colWidths = [
        { wch: 30 },
        { wch: 15 },
        { wch: 12 },
        { wch: 10 },
        { wch: 12 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

      const fileName = `Relatorio_${reportType}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
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
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500 mt-1">
            Análise de vendas e perdas com comparações
          </p>
        </div>
        <Button onClick={handleExportExcel} disabled={!reportData}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período</Label>
              <DateRangePicker 
                value={dateRange} 
                onChange={setDateRange}
              />
            </div>

            <div className="space-y-2">
              <Label>Comparar Com</Label>
              <Select value={compareOption} onValueChange={setCompareOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {SECTORS.map(sector => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {startDate && endDate && (
            <div className="mt-4 text-sm text-slate-600">
              Período: {format(new Date(startDate), 'dd/MM/yyyy')} a {format(new Date(endDate), 'dd/MM/yyyy')}
              {compareStartDate && (
                <> · Comparando com: {format(new Date(compareStartDate), 'dd/MM/yyyy')} a {format(new Date(compareEndDate), 'dd/MM/yyyy')}</>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards Resumo */}
      {reportQuery.isLoading ? (
        <div className="text-center py-12 text-slate-500">
          Carregando dados...
        </div>
      ) : reportData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Quantidade Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold">
                    {reportData.totalGeral.quantidade.toFixed(2)}
                  </div>
                  {compareData && (() => {
                    const change = calculateChange(
                      reportData.totalGeral.quantidade,
                      compareData.totalGeral.quantidade
                    );
                    return change !== null ? (
                      <div className={`flex items-center text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                        {Math.abs(change).toFixed(1)}%
                      </div>
                    ) : null;
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Valor Total (R$)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold">
                    R$ {reportData.totalGeral.valor_reais.toFixed(2)}
                  </div>
                  {compareData && (() => {
                    const change = calculateChange(
                      reportData.totalGeral.valor_reais,
                      compareData.totalGeral.valor_reais
                    );
                    return change !== null ? (
                      <div className={`flex items-center text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                        {Math.abs(change).toFixed(1)}%
                      </div>
                    ) : null;
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Produtos Diferentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.keys(reportData.totalByProduct).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Gráfico de Linha */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução Temporal</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart 
                  data={reportData.raw}
                  compareData={compareData?.raw}
                  reportType={reportType}
                />
              </CardContent>
            </Card>

            {/* Gráfico de Pizza */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por Setor</CardTitle>
              </CardHeader>
              <CardContent>
                <PieChartReport 
                  data={reportData.totalBySecor}
                  reportType={reportType}
                />
              </CardContent>
            </Card>
          </div>

          {/* Tabela Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento por Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Valor (R$)</TableHead>
                    {compareData && <TableHead className="text-right">Variação</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(reportData.totalByProduct)
                    .sort((a, b) => b[1].valor_reais - a[1].valor_reais)
                    .map(([id, data]) => {
                      const compareValue = compareData?.totalByProduct[id];
                      const change = compareValue ? calculateChange(data.quantidade, compareValue.quantidade) : null;
                      
                      return (
                        <TableRow key={id}>
                          <TableCell className="font-medium">{data.nome}</TableCell>
                          <TableCell>{data.setor}</TableCell>
                          <TableCell className="text-right">
                            {data.quantidade.toFixed(2)} {data.unidade}
                          </TableCell>
                          <TableCell className="text-right">
                            R$ {data.valor_reais.toFixed(2)}
                          </TableCell>
                          {compareData && (
                            <TableCell className="text-right">
                              {change !== null ? (
                                <span className={`flex items-center justify-end gap-1 ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                  {change > 0 ? <TrendingUp className="w-4 h-4" /> : change < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                  {Math.abs(change).toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 text-slate-500">
          Nenhum dado encontrado para o período selecionado
        </div>
      )}
    </div>
  );
}
