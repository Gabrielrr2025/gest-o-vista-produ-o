import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Filter, FileText } from "lucide-react";
import { subDays, isWithinInterval, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DateRangePicker from "../components/common/DateRangePicker";
import SectorBadge from "../components/common/SectorBadge";
import AutoSQLSync from "../components/import/AutoSQLSync";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [selectedSector, setSelectedSector] = useState(null);
  const [reportType, setReportType] = useState("resumo");

  const salesQuery = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list()
  });

  const lossQuery = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list()
  });

  const productionQuery = useQuery({
    queryKey: ['productionRecords'],
    queryFn: () => base44.entities.ProductionRecord.list()
  });

  const salesRecords = salesQuery.data || [];
  const lossRecords = lossQuery.data || [];
  const productionRecords = productionQuery.data || [];

  const filteredData = useMemo(() => {
    const filterByDateAndSector = (records) => {
      return records.filter(record => {
        try {
          const recordDate = parseISO(record.date);
          const inDateRange = isWithinInterval(recordDate, { start: dateRange.from, end: dateRange.to });
          const inSector = !selectedSector || record.sector === selectedSector;
          return inDateRange && inSector;
        } catch {
          return false;
        }
      });
    };

    return {
      sales: filterByDateAndSector(salesRecords),
      losses: filterByDateAndSector(lossRecords),
      production: filterByDateAndSector(productionRecords)
    };
  }, [salesRecords, lossRecords, productionRecords, dateRange, selectedSector]);

  const reportData = useMemo(() => {
    const totalSales = filteredData.sales.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const totalLosses = filteredData.losses.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const lossRate = totalSales + totalLosses > 0 ? (totalLosses / (totalSales + totalLosses)) * 100 : 0;
    
    const productionWithData = filteredData.production.filter(p => p.assertiveness != null);
    const avgAssertivity = productionWithData.length > 0
      ? productionWithData.reduce((sum, p) => sum + (p.assertiveness || 0), 0) / productionWithData.length
      : 100;

    // Performance por setor
    const sectorPerformance = {};
    const sectors = ['Padaria', 'Salgados', 'Confeitaria', 'Minimercado', 'Restaurante', 'Frios'];
    
    sectors.forEach(sector => {
      const sectorSales = filteredData.sales.filter(s => s.sector === sector);
      const sectorLosses = filteredData.losses.filter(l => l.sector === sector);
      const sectorProduction = filteredData.production.filter(p => p.sector === sector);
      
      const sales = sectorSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const losses = sectorLosses.reduce((sum, l) => sum + (l.quantity || 0), 0);
      const orders = sales + losses;
      
      const productionWithAssert = sectorProduction.filter(p => p.assertiveness != null);
      const assertivity = productionWithAssert.length > 0
        ? productionWithAssert.reduce((sum, p) => sum + (p.assertiveness || 0), 0) / productionWithAssert.length
        : 0;
      
      sectorPerformance[sector] = { sales, losses, orders, assertivity };
    });

    // Top produtos
    const productStats = {};
    filteredData.sales.forEach(s => {
      if (!productStats[s.product_name]) {
        productStats[s.product_name] = { name: s.product_name, sector: s.sector, sales: 0, losses: 0 };
      }
      productStats[s.product_name].sales += s.quantity || 0;
    });
    
    filteredData.losses.forEach(l => {
      if (!productStats[l.product_name]) {
        productStats[l.product_name] = { name: l.product_name, sector: l.sector, sales: 0, losses: 0 };
      }
      productStats[l.product_name].losses += l.quantity || 0;
    });

    const topProducts = Object.values(productStats)
      .map(p => ({
        ...p,
        lossRate: p.sales + p.losses > 0 ? (p.losses / (p.sales + p.losses)) * 100 : 0,
        assertivity: 100 - (p.sales + p.losses > 0 ? (p.losses / (p.sales + p.losses)) * 100 : 0)
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    return { totalSales, totalLosses, lossRate, avgAssertivity, sectorPerformance, topProducts };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500 mt-1">Análise de desempenho e métricas</p>
        </div>
        <AutoSQLSync 
          startDate={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null}
          endDate={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null}
          onSyncComplete={() => {
            salesQuery.refetch();
            lossQuery.refetch();
            productionQuery.refetch();
          }}
        />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-lg">Filtros do Relatório</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Período</label>
              <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Setor</label>
              <Select value={selectedSector || "all"} onValueChange={(v) => setSelectedSector(v === "all" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  <SelectItem value="Padaria">Padaria</SelectItem>
                  <SelectItem value="Salgados">Salgados</SelectItem>
                  <SelectItem value="Confeitaria">Confeitaria</SelectItem>
                  <SelectItem value="Minimercado">Minimercado</SelectItem>
                  <SelectItem value="Restaurante">Restaurante</SelectItem>
                  <SelectItem value="Frios">Frios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Tipo de Relatório</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resumo">Resumo Executivo</SelectItem>
                  <SelectItem value="detalhado">Detalhado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pré-visualização */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-lg">Pré-visualização do Relatório</CardTitle>
          </div>
          <p className="text-sm text-slate-500">
            Período: {format(dateRange.from, "dd 'de' MMM", { locale: ptBR })} - {format(dateRange.to, "dd 'de' MMM', ' yyyy", { locale: ptBR })}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resumo do Período */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Resumo do Período</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-100 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Total Vendas</div>
                <div className="text-2xl font-bold text-slate-900">{reportData.totalSales}</div>
              </div>
              <div className="bg-slate-100 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Total Perdas</div>
                <div className="text-2xl font-bold text-red-600">{reportData.totalLosses}</div>
              </div>
              <div className="bg-slate-100 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Taxa de Perda</div>
                <div className="text-2xl font-bold text-slate-900">
                  {isNaN(reportData.lossRate) ? "N/A" : `${reportData.lossRate.toFixed(1)}%`}
                </div>
              </div>
              <div className="bg-slate-100 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Assertividade</div>
                <div className="text-2xl font-bold text-green-600">
                  {reportData.avgAssertivity.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">pedido / (venda + perda)</div>
              </div>
            </div>
          </div>

          {/* Performance por Setor */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Performance por Setor</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Perdas</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Assertividade</TableHead>
                  <TableHead className="text-right">Tendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(reportData.sectorPerformance).map(([sector, data]) => (
                  <TableRow key={sector}>
                    <TableCell><SectorBadge sector={sector} /></TableCell>
                    <TableCell className="text-right">{data.sales}</TableCell>
                    <TableCell className="text-right text-red-600">{data.losses}</TableCell>
                    <TableCell className="text-right">{data.orders}</TableCell>
                    <TableCell className="text-right">
                      {data.assertivity > 0 ? `${data.assertivity.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-slate-500">-</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Top Produtos */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Top Produtos</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Perdas</TableHead>
                  <TableHead className="text-right">Taxa Perda</TableHead>
                  <TableHead className="text-right">Assertividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.topProducts.map((product, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell><SectorBadge sector={product.sector} /></TableCell>
                    <TableCell className="text-right">{product.sales}</TableCell>
                    <TableCell className="text-right text-red-600">{product.losses}</TableCell>
                    <TableCell className="text-right">
                      <span className={product.lossRate > 10 ? "text-red-600" : product.lossRate > 5 ? "text-yellow-600" : "text-green-600"}>
                        {product.lossRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {product.assertivity.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
                {reportData.topProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                      Nenhum dado disponível
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}