import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { subDays, format } from "date-fns";
import { ShoppingCart, AlertTriangle, Target, BarChart3, Weight, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SectorFilter from "../components/common/SectorFilter";
import SQLDataProvider from "../components/import/SQLDataProvider";
import SalesVsLossChart from "../components/dashboard/SalesVsLossChart";
import AssertivityBySectorChart from "../components/dashboard/AssertivityBySectorChart";
import TopProductsBySector from "../components/dashboard/TopProductsBySector";
import AssertivityVsSalesChart from "../components/dashboard/AssertivityVsSalesChart";

export default function Dashboard() {
  const [weeksBack, setWeeksBack] = useState(1);
  const [selectedSector, setSelectedSector] = useState(null);
  const [sqlData, setSqlData] = useState({ sales: [], losses: [] });

  const dateRange = useMemo(() => ({
    from: subDays(new Date(), (weeksBack * 7) - 1),
    to: new Date()
  }), [weeksBack]);

  const productionQuery = useQuery({
    queryKey: ['productionRecords'],
    queryFn: () => base44.entities.ProductionRecord.list()
  });

  const productionRecords = productionQuery.data || [];

  const filteredData = useMemo(() => {
    const filterBySector = (records) => {
      return records.filter(record => !selectedSector || record.sector === selectedSector);
    };

    // Filtrar por data também
    const startTime = dateRange.from ? new Date(dateRange.from).getTime() : null;
    const endTime = dateRange.to ? new Date(dateRange.to).setHours(23, 59, 59, 999) : null;

    const filterByDate = (records) => {
      if (!startTime || !endTime) return records;
      return records.filter(record => {
        const recordTime = new Date(record.date).getTime();
        return recordTime >= startTime && recordTime <= endTime;
      });
    };

    return {
      sales: filterByDate(filterBySector(sqlData.sales)),
      losses: filterByDate(filterBySector(sqlData.losses)),
      production: filterBySector(productionRecords)
    };
  }, [sqlData, productionRecords, selectedSector, dateRange]);

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const products = productsQuery.data || [];
  const productMap = useMemo(() => new Map(products.map(p => [p.name, p])), [products]);

  const kpis = useMemo(() => {
    // Separar por unidade
    const salesKG = filteredData.sales.filter(r => {
      const prod = productMap.get(r.product_name);
      return prod?.unit === 'kilo';
    });
    const salesUN = filteredData.sales.filter(r => {
      const prod = productMap.get(r.product_name);
      return prod?.unit !== 'kilo';
    });

    const lossesKG = filteredData.losses.filter(r => {
      const prod = productMap.get(r.product_name);
      return prod?.unit === 'kilo';
    });
    const lossesUN = filteredData.losses.filter(r => {
      const prod = productMap.get(r.product_name);
      return prod?.unit !== 'kilo';
    });

    const totalSalesKG = salesKG.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalSalesUN = salesUN.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalLossesKG = lossesKG.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalLossesUN = lossesUN.reduce((sum, r) => sum + (r.quantity || 0), 0);

    const lossRateKG = totalSalesKG > 0 ? (totalLossesKG / totalSalesKG) * 100 : 0;
    const lossRateUN = totalSalesUN > 0 ? (totalLossesUN / totalSalesUN) * 100 : 0;

    const productionWithAssertiveness = filteredData.production.filter(p => p.assertiveness !== undefined);
    const avgAssertiveness = productionWithAssertiveness.length > 0
      ? productionWithAssertiveness.reduce((sum, p) => sum + (p.assertiveness || 0), 0) / productionWithAssertiveness.length
      : 0;

    return {
      kg: { sales: totalSalesKG, losses: totalLossesKG, lossRate: lossRateKG },
      un: { sales: totalSalesUN, losses: totalLossesUN, lossRate: lossRateUN },
      avgAssertiveness
    };
  }, [filteredData, productMap]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Visão geral da operação</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <SQLDataProvider 
            startDate={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null}
            endDate={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null}
            onDataLoaded={setSqlData}
          />
          <Select value={weeksBack.toString()} onValueChange={(v) => setWeeksBack(parseInt(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Semana</SelectItem>
              <SelectItem value="4">4 Semanas</SelectItem>
              <SelectItem value="8">8 Semanas</SelectItem>
              <SelectItem value="13">13 Semanas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SectorFilter selectedSector={selectedSector} setSelectedSector={setSelectedSector} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPIs Unidades */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Unidades</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingCart className="w-7 h-7 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{kpis.un.sales.toLocaleString('pt-BR')}</div>
                <p className="text-sm opacity-90 mt-1">Vendas</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-500 to-pink-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-7 h-7 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{kpis.un.losses.toLocaleString('pt-BR')}</div>
                <p className="text-sm opacity-90 mt-1">Perdas</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-7 h-7 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{kpis.un.lossRate.toFixed(1)}%</div>
                <p className="text-sm opacity-90 mt-1">Taxa de Perda</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-7 h-7 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{kpis.avgAssertiveness.toFixed(1)}%</div>
                <p className="text-sm opacity-90 mt-1">Assertividade</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* KPIs Quilos */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Weight className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Quilos</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingCart className="w-7 h-7 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{kpis.kg.sales.toFixed(1)} kg</div>
                <p className="text-sm opacity-90 mt-1">Vendas</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-400 to-pink-500 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-7 h-7 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{kpis.kg.losses.toFixed(1)} kg</div>
                <p className="text-sm opacity-90 mt-1">Perdas</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-400 to-orange-500 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-7 h-7 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{kpis.kg.lossRate.toFixed(1)}%</div>
                <p className="text-sm opacity-90 mt-1">Taxa de Perda</p>
              </CardContent>
            </Card>
          </div>
        </div>
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