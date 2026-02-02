import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, BarChart2, PieChart } from "lucide-react";
import { subDays, isWithinInterval, parseISO, format, getWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import DateRangePicker from "../components/common/DateRangePicker";
import SectorFilter from "../components/common/SectorFilter";
import SectorBadge, { SECTORS } from "../components/common/SectorBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartPie, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 29),
    to: new Date()
  });
  const [selectedSector, setSelectedSector] = useState(null);
  const [reportType, setReportType] = useState("overview");

  const { data: salesRecords = [] } = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list()
  });

  const { data: lossRecords = [] } = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list()
  });

  const filteredData = useMemo(() => {
    const filterByDateAndSector = (records) => {
      return records.filter(record => {
        const recordDate = parseISO(record.date);
        const inDateRange = isWithinInterval(recordDate, { start: dateRange.from, end: dateRange.to });
        const inSector = !selectedSector || record.sector === selectedSector;
        return inDateRange && inSector;
      });
    };

    return {
      sales: filterByDateAndSector(salesRecords),
      losses: filterByDateAndSector(lossRecords)
    };
  }, [salesRecords, lossRecords, dateRange, selectedSector]);

  const reportData = useMemo(() => {
    // By Sector
    const bySector = SECTORS.map(sector => {
      const sectorSales = filteredData.sales.filter(r => r.sector === sector);
      const sectorLosses = filteredData.losses.filter(r => r.sector === sector);
      const totalSales = sectorSales.reduce((sum, r) => sum + (r.quantity || 0), 0);
      const totalLosses = sectorLosses.reduce((sum, r) => sum + (r.quantity || 0), 0);
      return {
        sector,
        vendas: totalSales,
        perdas: totalLosses,
        total: totalSales + totalLosses,
        lossRate: totalSales + totalLosses > 0 ? ((totalLosses / (totalSales + totalLosses)) * 100).toFixed(1) : 0
      };
    }).filter(s => s.total > 0);

    // By Week
    const byWeek = {};
    [...filteredData.sales, ...filteredData.losses].forEach(record => {
      const week = `S${record.week_number || getWeek(parseISO(record.date))}`;
      if (!byWeek[week]) {
        byWeek[week] = { week, vendas: 0, perdas: 0 };
      }
    });
    filteredData.sales.forEach(r => {
      const week = `S${r.week_number || getWeek(parseISO(r.date))}`;
      byWeek[week].vendas += r.quantity || 0;
    });
    filteredData.losses.forEach(r => {
      const week = `S${r.week_number || getWeek(parseISO(r.date))}`;
      byWeek[week].perdas += r.quantity || 0;
    });

    // By Product
    const byProduct = {};
    filteredData.sales.forEach(r => {
      if (!byProduct[r.product_name]) {
        byProduct[r.product_name] = { name: r.product_name, sector: r.sector, vendas: 0, perdas: 0 };
      }
      byProduct[r.product_name].vendas += r.quantity || 0;
    });
    filteredData.losses.forEach(r => {
      if (!byProduct[r.product_name]) {
        byProduct[r.product_name] = { name: r.product_name, sector: r.sector, vendas: 0, perdas: 0 };
      }
      byProduct[r.product_name].perdas += r.quantity || 0;
    });

    return {
      bySector,
      byWeek: Object.values(byWeek).sort((a, b) => parseInt(a.week.slice(1)) - parseInt(b.week.slice(1))),
      byProduct: Object.values(byProduct)
        .map(p => ({ ...p, lossRate: ((p.perdas / (p.vendas + p.perdas)) * 100).toFixed(1) }))
        .sort((a, b) => b.vendas - a.vendas)
    };
  }, [filteredData]);

  const exportReport = () => {
    let headers, rows;
    
    if (reportType === "sector") {
      headers = ["Setor", "Vendas", "Perdas", "Total", "% Perda"];
      rows = reportData.bySector.map(s => [s.sector, s.vendas, s.perdas, s.total, s.lossRate + "%"]);
    } else if (reportType === "week") {
      headers = ["Semana", "Vendas", "Perdas"];
      rows = reportData.byWeek.map(w => [w.week, w.vendas, w.perdas]);
    } else {
      headers = ["Produto", "Setor", "Vendas", "Perdas", "% Perda"];
      rows = reportData.byProduct.map(p => [p.name, p.sector, p.vendas, p.perdas, p.lossRate + "%"]);
    }

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${reportType}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500 mt-1">Análise detalhada de vendas, perdas e desempenho</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
          <Button variant="outline" onClick={exportReport}>
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <SectorFilter selectedSector={selectedSector} setSelectedSector={setSelectedSector} />
        
        <div className="flex gap-2">
          <Button
            variant={reportType === "overview" ? "default" : "outline"}
            size="sm"
            onClick={() => setReportType("overview")}
          >
            <BarChart2 className="w-4 h-4 mr-1" /> Visão Geral
          </Button>
          <Button
            variant={reportType === "sector" ? "default" : "outline"}
            size="sm"
            onClick={() => setReportType("sector")}
          >
            <PieChart className="w-4 h-4 mr-1" /> Por Setor
          </Button>
          <Button
            variant={reportType === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setReportType("week")}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Por Semana
          </Button>
        </div>
      </div>

      {reportType === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Setor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartPie>
                    <Pie
                      data={reportData.bySector}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ sector, percent }) => `${sector} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="vendas"
                    >
                      {reportData.bySector.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Vendas vs Perdas por Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.byWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="vendas" fill="#3b82f6" name="Vendas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="perdas" fill="#ef4444" name="Perdas" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === "sector" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Relatório por Setor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Perdas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% Perda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.bySector.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell><SectorBadge sector={row.sector} /></TableCell>
                    <TableCell className="text-right font-medium">{row.vendas.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right text-red-600">{row.perdas.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{row.total.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${
                        parseFloat(row.lossRate) > 10 ? "text-red-600" : 
                        parseFloat(row.lossRate) > 5 ? "text-orange-600" : "text-green-600"
                      }`}>
                        {row.lossRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {reportType === "week" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Relatório por Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.byWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="vendas" fill="#3b82f6" name="Vendas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="perdas" fill="#ef4444" name="Perdas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Produto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Produto</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Perdas</TableHead>
                  <TableHead className="text-right">% Perda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.byProduct.slice(0, 50).map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell><SectorBadge sector={row.sector} /></TableCell>
                    <TableCell className="text-right">{row.vendas.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right text-red-600">{row.perdas.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${
                        parseFloat(row.lossRate) > 10 ? "text-red-600" : 
                        parseFloat(row.lossRate) > 5 ? "text-orange-600" : "text-green-600"
                      }`}>
                        {row.lossRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}