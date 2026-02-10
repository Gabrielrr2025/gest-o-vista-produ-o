import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
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
import MultiPeriodComparison from "../components/reports/MultiPeriodComparison";
import LineChart from "../components/reports/LineChart";
import PieChartReport from "../components/reports/PieChartReport";

const REPORT_TYPES = [
  { value: 'sales', label: 'Vendas' },
  { value: 'losses', label: 'Perdas' }
];

const SECTORS = ['Padaria', 'Confeitaria', 'Salgados', 'Frios', 'Restaurante', 'Minimercado'];

export default function Reports() {
  const [hasAccess, setHasAccess] = useState(false);
  const [reportType, setReportType] = useState('sales');
  const [selectedSector, setSelectedSector] = useState('all');
  
  // Período base - PADRÃO: Mês passado completo
  const [basePeriod, setBasePeriod] = useState(() => {
    const lastMonth = subMonths(new Date(), 1);
    return {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth)
    };
  });

  // Períodos de comparação
  const [comparePeriods, setComparePeriods] = useState([]);

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

  // Construir array de períodos para a API
  const periods = useMemo(() => {
    const periodsArray = [];

    // Período base
    if (basePeriod?.from && basePeriod?.to) {
      periodsArray.push({
        startDate: format(basePeriod.from, 'yyyy-MM-dd'),
        endDate: format(basePeriod.to, 'yyyy-MM-dd'),
        label: 'Período Base'
      });
    }

    // Períodos de comparação
    comparePeriods.forEach((period, index) => {
      if (period.range?.from && period.range?.to) {
        periodsArray.push({
          startDate: format(period.range.from, 'yyyy-MM-dd'),
          endDate: format(period.range.to, 'yyyy-MM-dd'),
          label: `Período ${index + 2}`
        });
      }
    });

    return periodsArray;
  }, [basePeriod, comparePeriods]);

  // Buscar dados
  const reportQuery = useQuery({
    queryKey: ['reportData', periods, reportType, selectedSector],
    queryFn: async () => {
      const response = await base44.functions.invoke('getReportData', {
        periods,
        reportType,
        sector: selectedSector
      });
      return response.data;
    },
    enabled: hasAccess && periods.length > 0
  });

  const periodsData = reportQuery.data?.periods || [];
  const basePeriodData = periodsData[0]?.data || null;

  // Calcular variação percentual
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  // Exportar Excel
  const handleExportExcel = () => {
    if (!basePeriodData) return;

    try {
      const excelData = Object.entries(basePeriodData.totalByProduct).map(([id, data]) => {
        const row = {
          'Produto': data.nome,
          'Setor': data.setor,
          'Unidade': data.unidade
        };

        // Adicionar coluna para cada período
        periodsData.forEach((period, idx) => {
          const periodProduct = period.data.totalByProduct[id];
          row[period.label] = periodProduct ? 
            `R$ ${periodProduct.valor_reais.toFixed(2)}` : 
            'R$ 0,00';
        });

        return row;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

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
            Análise financeira com comparações entre períodos
          </p>
        </div>
        <Button onClick={handleExportExcel} disabled={!basePeriodData}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Comparação de Múltiplos Períodos */}
          <MultiPeriodComparison
            basePeriod={basePeriod}
            onBasePeriodChange={setBasePeriod}
            onPeriodsChange={setComparePeriods}
          />
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {reportQuery.isLoading ? (
        <div className="text-center py-12 text-slate-500">
          Carregando dados...
        </div>
      ) : basePeriodData ? (
        <>
          {/* Cards KPI */}
          <div className={`grid grid-cols-1 gap-4 ${periodsData.length > 2 ? 'md:grid-cols-4' : periodsData.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            {periodsData.map((period, idx) => {
              const isBase = idx === 0;
              const change = !isBase && periodsData[0] ? 
                calculateChange(
                  period.data.totalGeral.valor_reais,
                  periodsData[0].data.totalGeral.valor_reais
                ) : null;

              return (
                <Card key={idx}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      {period.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-bold">
                        R$ {period.data.totalGeral.valor_reais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      {change !== null && (
                        <div className={`flex items-center text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {change > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(period.period.start), 'dd/MM')} - {format(new Date(period.period.end), 'dd/MM/yyyy')}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Linha */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução Temporal</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart 
                  periodsData={periodsData}
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
                  data={basePeriodData.totalBySecor}
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
                    {periodsData.map((period, idx) => (
                      <TableHead key={idx} className="text-right">
                        {period.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(basePeriodData.totalByProduct)
                    .sort((a, b) => b[1].valor_reais - a[1].valor_reais)
                    .map(([id, baseData]) => {
                      return (
                        <TableRow key={id}>
                          <TableCell className="font-medium">{baseData.nome}</TableCell>
                          <TableCell>{baseData.setor}</TableCell>
                          {periodsData.map((period, idx) => {
                            const periodProduct = period.data.totalByProduct[id];
                            const value = periodProduct?.valor_reais || 0;
                            
                            // Calcular variação em relação ao período base
                            const change = idx > 0 && baseData ? 
                              calculateChange(value, baseData.valor_reais) : null;

                            return (
                              <TableCell key={idx} className="text-right">
                                <div>
                                  <span className="font-medium">
                                    R$ {value.toFixed(2)}
                                  </span>
                                  {change !== null && (
                                    <div className={`text-xs flex items-center justify-end gap-1 mt-1 ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                      {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                      {Math.abs(change).toFixed(1)}%
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
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
          Selecione um período para visualizar os dados
        </div>
      )}
    </div>
  );
}
