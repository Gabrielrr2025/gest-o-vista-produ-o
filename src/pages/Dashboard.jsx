import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { subDays, isWithinInterval, parseISO } from "date-fns";
import { ShoppingCart, AlertTriangle, TrendingUp, Target, Package, BarChart3 } from "lucide-react";
import KPICard from "../components/common/KPICard";
import DateRangePicker from "../components/common/DateRangePicker";
import SectorFilter from "../components/common/SectorFilter";
import SalesChart from "../components/dashboard/SalesChart";
import SectorChart from "../components/dashboard/SectorChart";
import AssertivityChart from "../components/dashboard/AssertivityChart";
import TopProductsTable from "../components/dashboard/TopProductsTable";

export default function Dashboard() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 29),
    to: new Date()
  });
  const [selectedSector, setSelectedSector] = useState(null);

  const { data: salesRecords = [] } = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list()
  });

  const { data: lossRecords = [] } = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list()
  });

  const { data: productionRecords = [] } = useQuery({
    queryKey: ['productionRecords'],
    queryFn: () => base44.entities.ProductionRecord.list()
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

    const lossRate = totalProduction > 0 ? (totalLosses / totalProduction) * 100 : 0;

    return {
      totalSales,
      totalLosses,
      totalProduction,
      uniqueProducts,
      avgAssertiveness,
      lossRate
    };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Visão geral da operação</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
        </div>
      </div>

      <SectorFilter selectedSector={selectedSector} setSelectedSector={setSelectedSector} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Total Vendas"
          value={kpis.totalSales.toLocaleString('pt-BR')}
          subtitle="unidades"
          icon={ShoppingCart}
          color="blue"
        />
        <KPICard
          title="Total Perdas"
          value={kpis.totalLosses.toLocaleString('pt-BR')}
          subtitle="unidades"
          icon={AlertTriangle}
          color="red"
        />
        <KPICard
          title="Produção Sugerida"
          value={kpis.totalProduction.toLocaleString('pt-BR')}
          subtitle="venda + perda"
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title="Assertividade"
          value={`${kpis.avgAssertiveness.toFixed(1)}%`}
          subtitle="média do período"
          icon={Target}
          color="purple"
        />
        <KPICard
          title="% Perda"
          value={`${kpis.lossRate.toFixed(1)}%`}
          subtitle="do total"
          icon={BarChart3}
          color="orange"
        />
        <KPICard
          title="Produtos Ativos"
          value={kpis.uniqueProducts}
          subtitle="com movimento"
          icon={Package}
          color="cyan"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart data={filteredData.sales} title="Vendas por Período" />
        </div>
        <div>
          <AssertivityChart value={kpis.avgAssertiveness} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectorChart 
          salesData={filteredData.sales} 
          lossData={filteredData.losses} 
        />
        <TopProductsTable 
          salesData={filteredData.sales} 
          lossData={filteredData.losses} 
        />
      </div>
    </div>
  );
}