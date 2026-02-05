import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, BarChart2, PieChart, Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { subDays, isWithinInterval, parseISO, format, getWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import DateRangePicker from "../components/common/DateRangePicker";
import SectorFilter from "../components/common/SectorFilter";
import SectorBadge, { SECTORS } from "../components/common/SectorBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartPie, Pie, Cell, Legend } from 'recharts';
import ProductDetailDialog from "../components/reports/ProductDetailDialog";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 29),
    to: new Date()
  });
  const [selectedSector, setSelectedSector] = useState(null);
  const [reportType, setReportType] = useState("overview");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productSortOrder, setProductSortOrder] = useState("desc"); // desc = maior venda primeiro, asc = alfabético

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

    const productList = Object.values(byProduct)
      .map(p => ({ ...p, lossRate: ((p.perdas / (p.vendas + p.perdas)) * 100).toFixed(1) }));

    return {
      bySector,
      byWeek: Object.values(byWeek).sort((a, b) => parseInt(a.week.slice(1)) - parseInt(b.week.slice(1))),
      byProduct: productList
    };
  }, [filteredData]);

  const filteredProducts = useMemo(() => {
    let filtered = reportData.byProduct;
    
    // Aplicar busca
    if (productSearch) {
      const search = productSearch.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    }

    // Aplicar ordenação
    if (productSortOrder === "asc") {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered = [...filtered].sort((a, b) => b.vendas - a.vendas);
    }

    return filtered;
  }, [reportData.byProduct, productSearch, productSortOrder]);

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
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">Distribuição por Setor</CardTitle>
              <p className="text-xs text-slate-600 mt-1">Proporção de vendas entre os setores</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartPie>
                    <Pie
                      data={reportData.bySector}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ sector, percent }) => `${sector} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="vendas"
                    >
                      {reportData.bySector.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                    />
                  </RechartPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">Vendas vs Perdas por Semana</CardTitle>
              <p className="text-xs text-slate-600 mt-1">Comparação entre vendas e perdas ao longo das semanas</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.byWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="vendas" fill="#3b82f6" name="Vendas" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="perdas" fill="#ef4444" name="Perdas" radius={[8, 8, 0, 0]} />
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
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">Relatório por Semana</CardTitle>
            <p className="text-xs text-slate-600 mt-1">Desempenho semanal de vendas e perdas</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.byWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="vendas" fill="#3b82f6" name="Vendas" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="perdas" fill="#ef4444" name="Perdas" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Detalhamento por Produto</CardTitle>
              <p className="text-xs text-slate-600 mt-1">Clique em qualquer produto para ver análise detalhada</p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar produto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>
                    <button 
                      className="flex items-center gap-1 hover:text-slate-900"
                      onClick={() => setProductSortOrder(productSortOrder === "asc" ? "desc" : "asc")}
                    >
                      Produto
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Perdas</TableHead>
                  <TableHead className="text-right">% Perda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((row, index) => (
                  <TableRow 
                    key={index} 
                    className="hover:bg-slate-100 cursor-pointer"
                    onClick={() => {
                      setSelectedProduct(row);
                      setDetailDialogOpen(true);
                    }}
                  >
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

      <ProductDetailDialog
        product={selectedProduct}
        salesRecords={salesRecords}
        lossRecords={lossRecords}
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
      />
    </div>
  );
}