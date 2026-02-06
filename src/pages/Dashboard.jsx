import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { subDays, isWithinInterval, parseISO } from "date-fns";
import { ShoppingCart, AlertTriangle, TrendingUp, Target, Package, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import KPICard from "../components/common/KPICard";
import DateRangePicker from "../components/common/DateRangePicker";
import SectorFilter from "../components/common/SectorFilter";
import AutoSQLSync from "../components/import/AutoSQLSync";
import SalesVsLossChart from "../components/dashboard/SalesVsLossChart";
import AssertivityBySectorChart from "../components/dashboard/AssertivityBySectorChart";
import TopProductsBySector from "../components/dashboard/TopProductsBySector";
import AssertivityVsSalesChart from "../components/dashboard/AssertivityVsSalesChart";

export default function Dashboard() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 29),
    to: new Date()
  });
  const [selectedSector, setSelectedSector] = useState(null);

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

  const kpis = useMemo(() => {
    const totalSales = filteredData.sales.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalLosses = filteredData.losses.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalProduction = totalSales + totalLosses;
    
    const uniqueProducts = new Set([
      ...filteredData.sales.map(r => r.product_name),
      ...filteredData.losses.map(r => r.product_name)
    ]).size;

    const productionWithAssertiveness = filteredData.production.filter(p => p.assertiveness !== undefined);
    const avgAssertiveness = productionWithAssertiveness.length > 0
      ? productionWithAssertiveness.reduce((sum, p) => sum + (p.assertiveness || 0), 0) / productionWithAssertiveness.length
      : 0;

    const lossRate = totalSales > 0 ? (totalLosses / totalSales) * 100 : 0;

    return {
      totalSales,
      totalLosses,
      uniqueProducts,
      avgAssertiveness,
      lossRate
    };
  }, [filteredData]);

  const queryClient = useQueryClient();
  
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Visão geral da operação</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <AutoSQLSync 
            startDate={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null}
            endDate={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null}
            onSyncComplete={() => {
              salesQuery.refetch();
              lossQuery.refetch();
              productionQuery.refetch();
            }}
          />
          <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
        </div>
      </div>

      <SectorFilter selectedSector={selectedSector} setSelectedSector={setSelectedSector} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className="w-8 h-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold">{kpis.totalSales.toLocaleString('pt-BR')}</div>
            <p className="text-sm opacity-90 mt-1">Total de Vendas</p>
            <p className="text-xs opacity-75 mt-1">unidades no período</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500 to-pink-600 text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold">{kpis.totalLosses.toLocaleString('pt-BR')}</div>
            <p className="text-sm opacity-90 mt-1">Total de Perdas</p>
            <p className="text-xs opacity-75 mt-1">unidades no período</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-8 h-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold">{kpis.lossRate.toFixed(1)}%</div>
            <p className="text-sm opacity-90 mt-1">Taxa de Perda</p>
            <p className="text-xs opacity-75 mt-1">perda / venda</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 opacity-80" />
            </div>
            <div className="text-3xl font-bold">{kpis.avgAssertiveness.toFixed(1)}%</div>
            <p className="text-sm opacity-90 mt-1">Assertividade</p>
            <p className="text-xs opacity-75 mt-1">pedido ÷ (venda + perda)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesVsLossChart salesData={filteredData.sales} lossData={filteredData.losses} />
        <AssertivityBySectorChart salesData={filteredData.sales} lossData={filteredData.losses} productionData={filteredData.production} />
      </div>

      <TopProductsBySector 
        salesData={filteredData.sales} 
        lossData={filteredData.losses}
        selectedSector={selectedSector}
      />

      <AssertivityVsSalesChart 
        salesData={filteredData.sales} 
        lossData={filteredData.losses}
        productionData={filteredData.production}
      />
    </div>
  );
}